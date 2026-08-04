'use client'

import {
  branchPhoneToNational,
  branchProfileSchema,
  formatLastUpdatedAr,
  formatWeeklyHoursSummaryAr,
  getErrorMessage,
  getProfileErrorAr,
  nationalToBranchPhone,
  parseBranchHours,
  toArabicDigits,
} from '@instahealth/core'
import {
  CARD_SECTIONS,
  INPUT_AFFIX,
  INPUT_BASE,
  INPUT_ERROR,
  INPUT_HELP,
  resolveTokenCss,
  type BranchStatusKey,
} from '@instahealth/design-tokens'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'

import { signOut } from '../../app/login/actions'
import {
  fetchBranchProfile,
  updateBranchProfile,
  type BranchProfile,
} from '../../lib/profile/branch-profile'
import { createClient } from '../../lib/supabase/client'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { BranchStatusBadge } from '../ui/StatusBadge'
import { Toast } from '../ui/Toast'

// The branch profile screen «بيانات الفرع» (P05), rebuilt to
// `Provider Dashboard - Branch Details.dc.html`: editable contact/address card
// beside the 380px locked «تديرها إنستاهيلث» card, phone fields as 🇪🇬 +20 +
// the NATIONAL part, a dark saved-toast, and the contract's chips/badges.
// Behavior is the shipped P05 contract unchanged: the field split, core's
// schema mirror, `update_branch_profile` as the only write path, pending
// spanning write + confirming refetch.

interface Drafts {
  phone: string
  whatsapp: string
  addressAr: string
  addressEn: string
}

/** Drafts hold what the DESK SEES — national phone forms — and are composed
 * back to the stored 0-leading shape only at the schema/RPC edge. */
function draftsFrom(profile: BranchProfile): Drafts {
  return {
    phone: profile.phone === null ? '' : branchPhoneToNational(profile.phone),
    whatsapp: profile.whatsapp === null ? '' : branchPhoneToNational(profile.whatsapp),
    addressAr: profile.addressAr ?? '',
    addressEn: profile.addressEn ?? '',
  }
}

/** Server refusals that belong under a specific field, not in the top alert. */
const REJECTION_FIELD: Record<string, keyof Drafts> = {
  invalid_phone: 'phone',
  invalid_whatsapp: 'whatsapp',
  invalid_address: 'addressAr',
}

function branchStatus(profile: BranchProfile): BranchStatusKey {
  if (profile.holidayMode) return 'holiday'
  return profile.isActive ? 'active' : 'inactive'
}

export function BranchProfileView({
  branchId,
  displayName,
  initialProfile,
  initialLoadFailed,
}: {
  branchId: string
  displayName: string
  initialProfile: BranchProfile | null
  initialLoadFailed: boolean
}) {
  const supabase = useMemo(() => createClient(), [])
  const queryClient = useQueryClient()

  const query = useQuery<BranchProfile>({
    queryKey: ['branch-profile', branchId],
    queryFn: () => fetchBranchProfile(supabase, branchId),
    initialData: initialProfile ?? undefined,
    // ⚠ ZERO — NOT the provider's global 60s default, and 'always' on mount:
    // after client-side navigation the server payload may come from the Router
    // Cache, so the mount must revalidate (the #28 lesson, §6a).
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
  const profile = query.data ?? null

  // null = "mirror the server". A background refetch must never clobber what
  // the desk is typing, so drafts fork from the server copy on first edit and
  // fold back (null) on save or cancel.
  const [drafts, setDrafts] = useState<Drafts | null>(null)
  const [pending, setPending] = useState(false)
  const [errorAr, setErrorAr] = useState<string | null>(null)
  const [toastAr, setToastAr] = useState<string | null>(null)
  const [serverFieldErrors, setServerFieldErrors] = useState<Partial<Record<keyof Drafts, string>>>(
    {},
  )
  // Re-entry guard is a REF: a second click arriving before React re-renders
  // reads stale state and sails through (§6a).
  const savingRef = useRef(false)

  const values = drafts ?? (profile !== null ? draftsFrom(profile) : null)
  const dirty =
    drafts !== null &&
    profile !== null &&
    JSON.stringify(drafts) !== JSON.stringify(draftsFrom(profile))

  const parsed = useMemo(
    () =>
      values === null
        ? null
        : branchProfileSchema.safeParse({
            phone: nationalToBranchPhone(values.phone),
            whatsapp: nationalToBranchPhone(values.whatsapp),
            addressAr: values.addressAr,
            addressEn: values.addressEn,
          }),
    [values],
  )

  const fieldError = useCallback(
    (field: keyof Drafts): string | null => {
      const serverError = serverFieldErrors[field]
      if (serverError !== undefined) return serverError
      if (parsed === null || parsed.success || !dirty) return null
      const issue = parsed.error.issues.find((candidate) => {
        const path = String(candidate.path[0] ?? '')
        return path === field || (field === 'addressAr' && path === '')
      })
      return issue === undefined ? null : getErrorMessage(issue.message, 'ar')
    },
    [serverFieldErrors, parsed, dirty],
  )

  const setField = useCallback(
    (field: keyof Drafts, value: string) => {
      if (profile === null) return
      setDrafts((current) => ({ ...(current ?? draftsFrom(profile)), [field]: value }))
      setServerFieldErrors((current) => {
        if (current[field] === undefined) return current
        const next = { ...current }
        delete next[field]
        return next
      })
      setErrorAr(null)
    },
    [profile],
  )

  const handleSave = useCallback(async () => {
    if (savingRef.current || parsed === null || profile === null || !parsed.success) return

    savingRef.current = true
    setPending(true)
    setErrorAr(null)
    try {
      const result = await updateBranchProfile(supabase, parsed.data)
      if (result.kind === 'ok' || result.kind === 'unchanged') {
        // Pending spans the write AND the confirming refetch — the values on
        // screen after this line come from the server, not from the draft
        // (§6a: no optimistic paint of a saved fact).
        await queryClient.refetchQueries({ queryKey: ['branch-profile', branchId] })
        setDrafts(null)
        setToastAr(
          result.kind === 'unchanged' ? 'لم يتغيّر شيء.' : 'تم حفظ بيانات الفرع — ظهرت للمرضى الآن',
        )
      } else {
        const reason = result.kind === 'rejected' ? result.reason : 'unknown'
        const field = REJECTION_FIELD[reason]
        if (field !== undefined) {
          setServerFieldErrors((current) => ({ ...current, [field]: getProfileErrorAr(reason) }))
        }
        // The design surfaces a save refusal as a top-of-form Alert as well as
        // the field treatment («لم نتمكن من الحفظ — …»).
        setErrorAr(`لم نتمكن من الحفظ — ${getProfileErrorAr(reason)}`)
      }
    } finally {
      savingRef.current = false
      setPending(false)
    }
  }, [parsed, profile, supabase, queryClient, branchId])

  const handleCancel = useCallback(() => {
    setDrafts(null)
    setServerFieldErrors({})
    setErrorAr(null)
  }, [])

  const dismissToast = useCallback(() => setToastAr(null), [])

  const now = new Date()
  const updatedLabel = profile !== null ? formatLastUpdatedAr(profile.lastChangedAt, now) : null
  const hours = profile !== null ? parseBranchHours(profile.operatingHours) : null
  const canSave = dirty && parsed !== null && parsed.success

  return (
    <>
      <header
        style={{
          flexShrink: 0,
          background: 'var(--ih-neutral-0)',
          borderBottom: '1px solid var(--ih-neutral-200)',
          boxShadow: 'var(--ih-shadow-sm)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          minHeight: 56,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ih-neutral-800)' }}>
            بيانات الفرع
          </div>
          {profile !== null ? (
            <div style={{ fontSize: 12.5, color: 'var(--ih-neutral-500)' }}>{profile.nameAr}</div>
          ) : null}
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            paddingInlineEnd: 16,
            borderInlineEnd: '1px solid var(--ih-neutral-200)',
            whiteSpace: 'nowrap',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'var(--ih-primary-50)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--ih-primary-700)',
            }}
          >
            {displayName.trim().charAt(0)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ih-neutral-700)' }}>
              {displayName}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                data-testid="logout"
                style={{
                  fontSize: 11,
                  color: 'var(--ih-neutral-500)',
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                تسجيل خروج
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Non-scrolling relative wrapper: the Toast anchors to the VISIBLE
          bottom of the content area, not to a scroll position. */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {toastAr !== null ? (
          <Toast testId="profile-saved" onDismiss={dismissToast}>
            {toastAr}
          </Toast>
        ) : null}

        <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {profile === null ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-ih-neutral-200 bg-white p-10 text-center">
              <div className="text-sm text-ih-neutral-700">
                {initialLoadFailed || query.isError
                  ? 'تعذّر تحميل بيانات الفرع — تحقق من الاتصال وحاول مرة أخرى.'
                  : 'جارٍ التحميل…'}
              </div>
              <Button variant="outline" onClick={() => void query.refetch()}>
                إعادة المحاولة
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              {/* ── editable card ─────────────────────────────────────────── */}
              <Card padding={0} style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <SectionHeader
                  title="بيانات التواصل والعنوان"
                  subtitle={
                    <span
                      data-testid="profile-updated"
                      style={updatedLabel === null ? { color: '#92600A' } : undefined}
                    >
                      {updatedLabel === null ? 'لم يُحدَّث بعد' : `آخر تحديث: ${updatedLabel}`}
                    </span>
                  }
                  chip={<Chip tone="outlinedPrimary">✎ قابلة للتعديل</Chip>}
                />

                <div
                  style={{
                    padding: `${CARD_SECTIONS.bodyPaddingY}px ${CARD_SECTIONS.bodyPaddingX}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 18,
                  }}
                >
                  {errorAr !== null ? (
                    <Alert type="error" testId="profile-error">
                      {errorAr}
                    </Alert>
                  ) : (
                    <div
                      data-testid="profile-notice"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        background: 'var(--ih-info-bg)',
                        border: '1px solid rgba(2,128,144,0.25)',
                        borderRadius: 8,
                        padding: '10px 14px',
                      }}
                    >
                      <span style={{ fontSize: 14, flexShrink: 0 }} aria-hidden="true">
                        ℹ
                      </span>
                      <span
                        style={{ fontSize: 12.5, color: 'var(--ih-primary-800)', lineHeight: 1.6 }}
                      >
                        رقم الهاتف والعنوان يظهران للمرضى في التطبيق فوراً بعد الحفظ.
                      </span>
                    </div>
                  )}

                  <PhoneField
                    id="profile-phone"
                    label="هاتف الفرع"
                    placeholder="2 2XXX XXXX"
                    value={values?.phone ?? ''}
                    disabled={pending}
                    error={fieldError('phone')}
                    helper="الرقم الأرضي أو الخط الساخن للفرع"
                    onChange={(value) => setField('phone', value)}
                  />
                  <PhoneField
                    id="profile-whatsapp"
                    label="واتساب"
                    optional
                    placeholder="10 XXXX XXXX"
                    value={values?.whatsapp ?? ''}
                    disabled={pending}
                    error={fieldError('whatsapp')}
                    helper="رقم محمول — يظهر كزر مراسلة للمرضى"
                    onChange={(value) => setField('whatsapp', value)}
                  />
                  <TextAreaField
                    id="profile-address-ar"
                    label="العنوان بالعربية"
                    value={values?.addressAr ?? ''}
                    disabled={pending}
                    error={fieldError('addressAr')}
                    helper="اكتب علامة مميزة قريبة — تساعد المرضى في الوصول"
                    onChange={(value) => setField('addressAr', value)}
                  />
                  <TextAreaField
                    id="profile-address-en"
                    label="العنوان بالإنجليزية"
                    optional
                    ltr
                    placeholder="North 90th Street, opposite Cairo Festival City, Fifth Settlement, New Cairo"
                    value={values?.addressEn ?? ''}
                    disabled={pending}
                    error={fieldError('addressEn')}
                    onChange={(value) => setField('addressEn', value)}
                  />
                </div>

                <div
                  style={{
                    padding: `${CARD_SECTIONS.footerPaddingY}px ${CARD_SECTIONS.footerPaddingX}px`,
                    borderTop: `1px solid ${resolveTokenCss(CARD_SECTIONS.dividerColor)}`,
                    background: resolveTokenCss(CARD_SECTIONS.footerBackground),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--ih-neutral-600)' }}>
                    التعديلات غير المحفوظة تُفقد عند مغادرة الصفحة.
                  </span>
                  <div style={{ flexShrink: 0, display: 'flex', gap: 8 }}>
                    <Button
                      variant="ghost"
                      onClick={handleCancel}
                      disabled={!dirty || pending}
                      style={{ color: 'var(--ih-neutral-600)' }}
                    >
                      تراجع
                    </Button>
                    <Button
                      data-testid="profile-save"
                      disabled={!canSave}
                      loading={pending}
                      onClick={() => void handleSave()}
                    >
                      حفظ التغييرات
                    </Button>
                  </div>
                </div>
              </Card>

              {/* ── locked card ───────────────────────────────────────────────
                Read-only BY DECISION and, since REFACTOR 2/N, by construction:
                no client write path to these columns exists
                (DECISION-slot-allocation-ownership, migration 20260803160517).
                Zero operable controls below. */}
              <Card
                padding={0}
                style={{ width: 380, flexShrink: 0, overflow: 'hidden' }}
                testId="profile-gated"
              >
                <SectionHeader
                  title="تديرها إنستاهيلث"
                  subtitle="بيانات متفق عليها في العقد"
                  chip={<Chip tone="outlinedNeutral">🔒 للعرض فقط</Chip>}
                />
                <div style={{ padding: '4px 20px 8px' }}>
                  <ManagedRow label="اسم الفرع" value={profile.nameAr} />
                  <ManagedRow
                    label="المنطقة"
                    value={
                      [profile.district, profile.governorate].filter(Boolean).join('، ') || '—'
                    }
                  />
                  <ManagedRow
                    label="ساعات العمل"
                    value={hours === null ? '—' : formatWeeklyHoursSummaryAr(hours)}
                  />
                  {/* The handoff appends «· كل ٣٠ دقيقة» from slot_duration_minutes.
                    Deliberately OMITTED: since the capacity rewrite that column no
                    longer describes the grid spacing (PROGRESS Known risks), and
                    P04 already refused to render it as spacing. */}
                  <ManagedRow
                    label="عدد المواعيد اليومية"
                    value={`${toArabicDigits(String(profile.slotAllocation))} مواعيد يومياً`}
                  />
                  <ManagedRow
                    label="حالة الفرع"
                    value={<BranchStatusBadge status={branchStatus(profile)} />}
                  />
                </div>
                <div
                  style={{
                    padding: `${CARD_SECTIONS.footerPaddingY}px ${CARD_SECTIONS.footerPaddingX}px`,
                    background: resolveTokenCss(CARD_SECTIONS.footerBackground),
                    borderTop: `1px solid ${resolveTokenCss(CARD_SECTIONS.dividerColor)}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 12.5, color: 'var(--ih-neutral-700)', lineHeight: 1.6 }}>
                    لتعديل هذه البيانات تواصل مع إنستاهيلث
                  </span>
                  <a
                    data-testid="profile-support"
                    href="mailto:partners@instahealth.eg"
                    dir="ltr"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      textDecoration: 'none',
                      textAlign: 'right',
                    }}
                  >
                    partners@instahealth.eg
                  </a>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>
    </>
  )
}

// ── sectioned-card pieces (metrics from the CARD_SECTIONS contract) ─────────

function SectionHeader({
  title,
  subtitle,
  chip,
}: {
  title: string
  subtitle: React.ReactNode
  chip: React.ReactNode
}) {
  return (
    <div
      style={{
        padding: `${CARD_SECTIONS.headerPaddingY}px ${CARD_SECTIONS.headerPaddingX}px`,
        borderBottom: `1px solid ${resolveTokenCss(CARD_SECTIONS.dividerColor)}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ih-neutral-800)' }}>{title}</div>
        <div style={{ fontSize: 12, color: 'var(--ih-neutral-600)' }}>{subtitle}</div>
      </div>
      {chip}
    </div>
  )
}

function ManagedRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid var(--ih-neutral-100)',
      }}
    >
      <span style={{ fontSize: 12.5, color: 'var(--ih-neutral-600)', flexShrink: 0 }}>{label}</span>
      {typeof value === 'string' ? (
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: 'var(--ih-neutral-800)',
            textAlign: 'left',
            unicodeBidi: 'isolate',
          }}
        >
          {value}
        </span>
      ) : (
        value
      )}
    </div>
  )
}

// ── fields (metrics from the INPUT_* contract) ──────────────────────────────

function FieldShell({
  label,
  optional,
  helper,
  error,
  children,
}: {
  label: string
  optional?: boolean
  helper?: string
  error: string | null
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: INPUT_HELP.gap }}>
      <label
        style={{
          fontSize: INPUT_BASE.labelFontSize,
          fontWeight: INPUT_BASE.labelFontWeight,
          color: resolveTokenCss(INPUT_BASE.labelColor),
        }}
      >
        {label}
        {optional === true ? (
          <span style={{ fontWeight: 500, color: 'var(--ih-neutral-500)' }}> (اختياري)</span>
        ) : null}
      </label>
      {children}
      {error !== null ? (
        <span
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: INPUT_HELP.fontSize,
            fontWeight: INPUT_HELP.errorFontWeight,
            color: INPUT_HELP.errorColor,
          }}
        >
          <span aria-hidden="true">⚠</span> {error}
        </span>
      ) : helper !== undefined ? (
        <span style={{ fontSize: INPUT_HELP.fontSize, color: resolveTokenCss(INPUT_HELP.color) }}>
          {helper}
        </span>
      ) : null}
    </div>
  )
}

function PhoneField({
  id,
  label,
  optional,
  placeholder,
  value,
  disabled,
  error,
  helper,
  onChange,
}: {
  id: string
  label: string
  optional?: boolean
  placeholder: string
  value: string
  disabled: boolean
  error: string | null
  helper: string
  onChange: (value: string) => void
}) {
  const hasError = error !== null
  return (
    <FieldShell label={label} optional={optional} helper={helper} error={error}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
        <div
          aria-hidden="true"
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: INPUT_AFFIX.gap,
            padding: `0 ${INPUT_AFFIX.paddingX}px`,
            minHeight: INPUT_BASE.minHeight,
            border: `${INPUT_BASE.borderWidth}px solid ${resolveTokenCss(INPUT_BASE.borderColor)}`,
            borderRadius: INPUT_BASE.borderRadius,
            background: resolveTokenCss(INPUT_AFFIX.background),
            fontSize: INPUT_AFFIX.fontSize,
            fontWeight: INPUT_AFFIX.fontWeight,
            color: resolveTokenCss(INPUT_AFFIX.color),
            whiteSpace: 'nowrap',
          }}
        >
          <span>🇪🇬</span>
          <span dir="ltr">+20</span>
        </div>
        <input
          id={id}
          data-testid={id}
          dir="ltr"
          inputMode="tel"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          onChange={(event) => onChange(event.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            boxSizing: 'border-box',
            minHeight: INPUT_BASE.minHeight,
            padding: `0 ${INPUT_AFFIX.paddingX}px`,
            border: `${INPUT_BASE.borderWidth}px solid ${
              hasError
                ? resolveTokenCss(INPUT_ERROR.borderColor)
                : resolveTokenCss(INPUT_BASE.borderColor)
            }`,
            borderRadius: INPUT_BASE.borderRadius,
            background: hasError
              ? resolveTokenCss(INPUT_ERROR.background)
              : resolveTokenCss(INPUT_BASE.background),
            fontFamily: 'var(--font-atkinson), sans-serif',
            fontSize: INPUT_BASE.fontSize,
            letterSpacing: '0.03em',
            color: resolveTokenCss(INPUT_BASE.color),
            textAlign: 'left',
            outline: 'none',
            transition: 'border-color 180ms',
          }}
        />
      </div>
    </FieldShell>
  )
}

function TextAreaField({
  id,
  label,
  optional,
  ltr,
  placeholder,
  value,
  disabled,
  error,
  helper,
  onChange,
}: {
  id: string
  label: string
  optional?: boolean
  ltr?: boolean
  placeholder?: string
  value: string
  disabled: boolean
  error: string | null
  helper?: string
  onChange: (value: string) => void
}) {
  const hasError = error !== null
  return (
    <FieldShell label={label} optional={optional} helper={helper} error={error}>
      <textarea
        id={id}
        data-testid={id}
        dir={ltr === true ? 'ltr' : undefined}
        rows={2}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-invalid={hasError || undefined}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: `11px ${INPUT_BASE.paddingX}px`,
          border: `${INPUT_BASE.borderWidth}px solid ${
            hasError
              ? resolveTokenCss(INPUT_ERROR.borderColor)
              : resolveTokenCss(INPUT_BASE.borderColor)
          }`,
          borderRadius: INPUT_BASE.borderRadius,
          background: hasError
            ? resolveTokenCss(INPUT_ERROR.background)
            : resolveTokenCss(INPUT_BASE.background),
          fontFamily: ltr === true ? 'var(--font-atkinson), sans-serif' : 'inherit',
          fontSize: INPUT_BASE.fontSize,
          lineHeight: 1.6,
          color: resolveTokenCss(INPUT_BASE.color),
          resize: 'none',
          textAlign: ltr === true ? 'left' : undefined,
          outline: 'none',
          transition: 'border-color 180ms',
        }}
      />
    </FieldShell>
  )
}
