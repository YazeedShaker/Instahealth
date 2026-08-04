'use client'

import {
  branchProfileSchema,
  DAY_LABELS_AR,
  formatDayHoursAr,
  formatLastUpdatedAr,
  getErrorMessage,
  getProfileErrorAr,
  parseBranchHours,
  toArabicDigits,
  WEEK_DAY_ORDER,
} from '@instahealth/core'
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
import { Input } from '../ui/Input'

// The branch profile screen «بيانات الفرع» (P05). ⚠ No design-bundle screen
// exists for this surface (the bundle's "Provider Profile" is the PATIENT
// branch screen, F04) — built from the design-system contract and the P01–P04
// dashboard idiom; SPEC-P05 records the gap for a future design pass.

interface Drafts {
  phone: string
  whatsapp: string
  addressAr: string
  addressEn: string
}

function draftsFrom(profile: BranchProfile): Drafts {
  return {
    phone: profile.phone ?? '',
    whatsapp: profile.whatsapp ?? '',
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
  const [attempted, setAttempted] = useState(false)
  const [errorAr, setErrorAr] = useState<string | null>(null)
  const [noticeAr, setNoticeAr] = useState<string | null>(null)
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
            phone: values.phone,
            whatsapp: values.whatsapp,
            addressAr: values.addressAr,
            addressEn: values.addressEn,
          }),
    [values],
  )

  const fieldError = useCallback(
    (field: keyof Drafts): string | null => {
      const serverError = serverFieldErrors[field]
      if (serverError !== undefined) return serverError
      if (parsed === null || parsed.success) return null
      if (!dirty && !attempted) return null
      const issue = parsed.error.issues.find((candidate) => {
        const path = String(candidate.path[0] ?? '')
        return path === field || (field === 'addressAr' && path === '')
      })
      return issue === undefined ? null : getErrorMessage(issue.message, 'ar')
    },
    [serverFieldErrors, parsed, dirty, attempted],
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
      setNoticeAr(null)
    },
    [profile],
  )

  const handleSave = useCallback(async () => {
    if (savingRef.current || parsed === null || profile === null) return
    setAttempted(true)
    setErrorAr(null)
    if (!parsed.success) return

    savingRef.current = true
    setPending(true)
    try {
      const result = await updateBranchProfile(supabase, parsed.data)
      if (result.kind === 'ok' || result.kind === 'unchanged') {
        // Pending spans the write AND the confirming refetch — the values on
        // screen after this line come from the server, not from the draft
        // (§6a: no optimistic paint of a saved fact).
        await queryClient.refetchQueries({ queryKey: ['branch-profile', branchId] })
        setDrafts(null)
        setAttempted(false)
        setNoticeAr(
          result.kind === 'unchanged'
            ? 'لم يتغيّر شيء.'
            : 'تم حفظ بيانات الفرع — تظهر للمرضى فوراً.',
        )
      } else {
        const reason = result.kind === 'rejected' ? result.reason : 'unknown'
        const field = REJECTION_FIELD[reason]
        if (field !== undefined) {
          setServerFieldErrors((current) => ({ ...current, [field]: getProfileErrorAr(reason) }))
        } else {
          setErrorAr(getProfileErrorAr(reason))
        }
      }
    } finally {
      savingRef.current = false
      setPending(false)
    }
  }, [parsed, profile, supabase, queryClient, branchId])

  const handleCancel = useCallback(() => {
    setDrafts(null)
    setAttempted(false)
    setServerFieldErrors({})
    setErrorAr(null)
  }, [])

  const now = new Date()
  const updatedLabel = profile !== null ? formatLastUpdatedAr(profile.lastChangedAt, now) : null
  const hours = profile !== null ? parseBranchHours(profile.operatingHours) : null

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

      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 14 }} aria-hidden="true">
              ℹ
            </span>
            <span style={{ fontSize: 12.5, color: 'var(--ih-primary-800)', lineHeight: 1.6 }}>
              رقم الهاتف والعنوان يظهران للمرضى في التطبيق فور الحفظ.
            </span>
          </div>

          {errorAr !== null ? (
            <Alert type="error" testId="profile-error">
              {errorAr}
            </Alert>
          ) : null}
          {noticeAr !== null && errorAr === null ? (
            <Alert type="success" testId="profile-saved">
              {noticeAr}
            </Alert>
          ) : null}

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
            <>
              <Card padding={20}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ih-neutral-800)' }}
                    >
                      بيانات التواصل والعنوان
                    </div>
                    {/* NULL means never edited — say so, never invent a date. */}
                    <div
                      data-testid="profile-updated"
                      style={{
                        fontSize: 11.5,
                        color: updatedLabel === null ? '#92600A' : 'var(--ih-neutral-500)',
                      }}
                    >
                      {updatedLabel === null ? 'لم يُحدَّث بعد' : `آخر تحديث: ${updatedLabel}`}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '14px 16px',
                    }}
                  >
                    <Field error={fieldError('phone')}>
                      <Input
                        id="profile-phone"
                        data-testid="profile-phone"
                        label="هاتف الفرع"
                        dir="ltr"
                        inputMode="tel"
                        value={values?.phone ?? ''}
                        disabled={pending}
                        onChange={(event) => setField('phone', event.target.value)}
                      />
                    </Field>
                    <Field error={fieldError('whatsapp')}>
                      <Input
                        id="profile-whatsapp"
                        data-testid="profile-whatsapp"
                        label="واتساب (اختياري — موبايل)"
                        dir="ltr"
                        inputMode="tel"
                        placeholder="01012345678"
                        value={values?.whatsapp ?? ''}
                        disabled={pending}
                        onChange={(event) => setField('whatsapp', event.target.value)}
                      />
                    </Field>
                    <Field error={fieldError('addressAr')}>
                      <Input
                        id="profile-address-ar"
                        data-testid="profile-address-ar"
                        label="العنوان بالعربية"
                        value={values?.addressAr ?? ''}
                        disabled={pending}
                        onChange={(event) => setField('addressAr', event.target.value)}
                        style={{ fontFamily: 'inherit' }}
                      />
                    </Field>
                    <Field error={fieldError('addressEn')}>
                      <Input
                        id="profile-address-en"
                        data-testid="profile-address-en"
                        label="العنوان بالإنجليزية (اختياري)"
                        dir="ltr"
                        value={values?.addressEn ?? ''}
                        disabled={pending}
                        onChange={(event) => setField('addressEn', event.target.value)}
                      />
                    </Field>
                  </div>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    {dirty ? (
                      <Button
                        variant="ghost"
                        onClick={handleCancel}
                        disabled={pending}
                        style={{ color: 'var(--ih-neutral-600)' }}
                      >
                        تراجع
                      </Button>
                    ) : null}
                    <Button
                      data-testid="profile-save"
                      disabled={!dirty}
                      loading={pending}
                      onClick={() => void handleSave()}
                    >
                      حفظ
                    </Button>
                  </div>
                </div>
              </Card>

              {/* InstaHealth-owned facts. Read-only BY DECISION, and since
                  REFACTOR 2/N also by construction: no client write path to
                  these columns exists (DECISION-slot-allocation-ownership,
                  migration 20260803160517). Zero operable controls below. */}
              <Card padding={20} testId="profile-gated">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span aria-hidden="true" style={{ fontSize: 14 }}>
                      🔒
                    </span>
                    <div
                      style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ih-neutral-800)' }}
                    >
                      تديرها إنستاهيلث
                    </div>
                  </div>

                  <GatedRow label="اسم الفرع" value={profile.nameAr} />
                  <GatedRow
                    label="المنطقة"
                    value={
                      [profile.governorate, profile.district].filter(Boolean).join(' · ') || '—'
                    }
                  />
                  <GatedRow
                    label="مواعيد العمل"
                    value={
                      hours === null
                        ? '—'
                        : WEEK_DAY_ORDER.map(
                            (day) => `${DAY_LABELS_AR[day]}: ${formatDayHoursAr(hours[day])}`,
                          ).join(' · ')
                    }
                  />
                  <GatedRow
                    label="حصة المواعيد"
                    value={`${toArabicDigits(String(profile.slotAllocation))} مواعيد يومياً`}
                  />
                  <GatedRow
                    label="حالة الفرع"
                    value={
                      profile.holidayMode ? 'وضع الإجازة مفعّل' : profile.isActive ? 'نشط' : 'موقوف'
                    }
                  />

                  <div
                    style={{
                      borderTop: '1px solid var(--ih-neutral-200)',
                      paddingTop: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div
                      style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ih-neutral-700)' }}
                    >
                      لتعديل هذه البيانات تواصل مع إنستاهيلث
                    </div>
                    <div
                      style={{ fontSize: 11.5, color: 'var(--ih-neutral-500)', lineHeight: 1.6 }}
                    >
                      الاسم والموقع ومواعيد العمل جزء من اتفاق الشراكة، ونعدّلها معك بعد مراجعة
                      سريعة.
                    </div>
                    <a
                      data-testid="profile-support"
                      href="mailto:partners@instahealth.eg"
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: 'var(--ih-primary-600)',
                        textDecoration: 'underline',
                      }}
                    >
                      partners@instahealth.eg
                    </a>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      </main>
    </>
  )
}

function Field({ error, children }: { error: string | null; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {children}
      {error !== null ? (
        <div role="alert" style={{ fontSize: 11.5, color: 'var(--ih-error)', lineHeight: 1.5 }}>
          {error}
        </div>
      ) : null}
    </div>
  )
}

function GatedRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10, alignItems: 'start' }}
    >
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ih-neutral-500)' }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--ih-neutral-800)', lineHeight: 1.7 }}>{value}</div>
    </div>
  )
}
