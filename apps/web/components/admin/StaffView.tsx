'use client'

import {
  emailFieldErrorKey,
  formatCountedAr,
  getErrorMessage,
  toArabicDigits,
  type ArabicCountedNoun,
} from '@instahealth/core'
import { INPUT_ERROR, INPUT_HELP, resolveTokenCss } from '@instahealth/design-tokens'
import { useRouter } from 'next/navigation'
import { useMemo, useRef, useState, useTransition } from 'react'

import {
  createStaffAccountAction,
  disableStaffAccountAction,
  enableStaffAccountAction,
  regenerateTempPasswordAction,
  type StaffActionResult,
} from '../../app/admin/staff-actions'
import type {
  BranchOption,
  DisablePreview,
  StaffAccount,
  StaffCounts,
  StaffDetail,
  StaffState,
} from '../../lib/staff/accounts'
import { Button } from '../ui/Button'
import { AdminHeader } from './AdminHeader'
import { ConsequentialConfirm, type ConfirmRow } from './ConsequentialConfirm'

// A05 — «حسابات المزودين», built to `Admin - Staff Accounts.dc.html`
// (frames A, B, C, C2, D).
//
// ⚠ THE TEMP PASSWORD IS THE A01 RECOVERY-CODES TRAP WEARING A DIFFERENT HAT:
// a server action produces a secret the founder must SEE exactly once. A01 lost
// eight recovery codes to it twice — once to a gate that redirected past the
// display, once to a revalidation that swapped the component TYPE and destroyed
// the state holding them.
//
// Two things make this one safe. ① The password lives in ONE client component's
// state, passed as a PROP, so no render ever changes the element type at that
// position. ② `router.refresh()` fires only when the founder DISMISSES the
// dialog, never on receiving it — a refresh while the secret is on screen is
// exactly what threw the codes away.
//
// It also needs no server-state acknowledgment, unlike A01, because there IS a
// recovery path: regenerate. Losing it costs one click, not the account.

const CAIRO_DATETIME = new Intl.DateTimeFormat('ar-EG', {
  timeZone: 'Africa/Cairo',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})
const CAIRO_DATE = new Intl.DateTimeFormat('ar-EG', {
  timeZone: 'Africa/Cairo',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const fmtWhen = (iso: string | null): string =>
  iso === null ? '—' : CAIRO_DATETIME.format(new Date(iso))
const fmtDay = (iso: string | null): string =>
  iso === null ? '—' : CAIRO_DATE.format(new Date(iso))

const STATE_AR: Record<StaffState, { label: string; color: string; background: string }> = {
  active: { label: '● نشط', color: 'primary.700', background: 'success.bg' },
  never_used: { label: '◍ لم يُستخدم بعد', color: 'warning.text', background: 'warning.bg' },
  disabled: { label: '✕ معطّل', color: 'neutral.600', background: 'neutral.100' },
}

function StateChip({ state }: { state: StaffState }) {
  const tone = STATE_AR[state]
  return (
    <span
      data-testid={`staff-state-${state}`}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold"
      style={{ color: resolveTokenCss(tone.color), background: resolveTokenCss(tone.background) }}
    >
      {tone.label}
    </span>
  )
}

function countsLine(counts: StaffCounts): string {
  return [
    `${toArabicDigits(String(counts.total))} حسابات`,
    `${toArabicDigits(String(counts.active))} نشطة`,
    `${toArabicDigits(String(counts.neverUsed))} لم تُستخدم بعد`,
    `${toArabicDigits(String(counts.disabled))} معطّلة`,
  ].join(' · ')
}

/** Counted noun PHRASES — see `formatCountedAr` in core. The captures showed
 *  «٠ حجزاً» on the escalated disable confirm, where zero takes the plural. */
const AR_UPCOMING_BOOKING: ArabicCountedNoun = {
  singular: 'حجز قادم',
  dual: 'حجزان قادمان',
  plural: 'حجوزات قادمة',
  accusative: 'حجزاً قادماً',
}
const AR_EMPTY_SLOT: ArabicCountedNoun = {
  singular: 'موعد فارغ',
  dual: 'موعدان فارغان',
  plural: 'مواعيد فارغة',
  accusative: 'موعداً فارغاً',
}
const AR_ACTIVE_ACCOUNT: ArabicCountedNoun = {
  singular: 'حساب نشط',
  dual: 'حسابان نشطان',
  plural: 'حسابات نشطة',
  accusative: 'حساباً نشطاً',
}

export function StaffView({
  accounts,
  counts,
  branches,
  detail,
  disablePreview,
}: {
  accounts: readonly StaffAccount[]
  counts: StaffCounts
  branches: readonly BranchOption[]
  detail: StaffDetail | null
  disablePreview: DisablePreview | null
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [errorAr, setErrorAr] = useState<string | null>(null)
  // ⚠ THE ONLY PLACE THE TEMP PASSWORD EVER LIVES. Never written to storage,
  // never put in a URL, never sent to analytics.
  const [issued, setIssued] = useState<{ name: string; email: string; password: string } | null>(
    null,
  )
  const inFlight = useRef(false)

  const run = (
    action: () => Promise<StaffActionResult>,
    onIssued?: (result: StaffActionResult) => void,
  ) => {
    if (inFlight.current) return
    inFlight.current = true
    setErrorAr(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) setErrorAr(result.errorAr)
        // ⚠ NO router.refresh() HERE when a secret came back — it happens when
        // the founder closes the dialog. See the header note.
        else if (result.tempPassword !== undefined) onIssued?.(result)
        else router.refresh()
      } finally {
        inFlight.current = false
      }
    })
  }

  const dismissIssued = () => {
    setIssued(null)
    router.refresh()
  }

  return (
    <>
      {detail === null ? (
        <StaffListScreen
          accounts={accounts}
          counts={counts}
          branches={branches}
          isPending={isPending}
          errorAr={errorAr}
          run={run}
          onIssued={setIssued}
        />
      ) : (
        <StaffDetailScreen
          detail={detail}
          disablePreview={disablePreview}
          isPending={isPending}
          errorAr={errorAr}
          run={run}
          onIssued={setIssued}
          onBack={() => router.push('/admin/staff')}
        />
      )}

      {issued !== null ? <TempPasswordDialog issued={issued} onClose={dismissIssued} /> : null}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// A · the list
// ═══════════════════════════════════════════════════════════════════════════
function StaffListScreen({
  accounts,
  counts,
  branches,
  isPending,
  errorAr,
  run,
  onIssued,
}: {
  accounts: readonly StaffAccount[]
  counts: StaffCounts
  branches: readonly BranchOption[]
  isPending: boolean
  errorAr: string | null
  run: (a: () => Promise<StaffActionResult>, onIssued?: (r: StaffActionResult) => void) => void
  onIssued: (issued: { name: string; email: string; password: string }) => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [providerFilter, setProviderFilter] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const providers = useMemo(
    () => [...new Set(accounts.map((account) => account.providerNameAr))].sort(),
    [accounts],
  )

  const visible = useMemo(
    () =>
      accounts.filter((account) => {
        const needle = query.trim().toLowerCase()
        const matchesQuery =
          needle === '' ||
          (account.nameAr ?? '').toLowerCase().includes(needle) ||
          (account.email ?? '').toLowerCase().includes(needle) ||
          (account.branchNameAr ?? '').toLowerCase().includes(needle)
        const matchesProvider = providerFilter === '' || account.providerNameAr === providerFilter
        const matchesState = stateFilter === '' || account.state === stateFilter
        return matchesQuery && matchesProvider && matchesState
      }),
    [accounts, query, providerFilter, stateFilter],
  )

  return (
    <>
      <AdminHeader title="حسابات المزودين" displayName="مؤسِّس" subtitle={countsLine(counts)} />

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ih-neutral-200 bg-white px-6 py-3">
        <input
          data-testid="staff-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث بالاسم أو البريد أو الفرع"
          aria-label="ابحث بالاسم أو البريد أو الفرع"
          className="min-h-[40px] min-w-[220px] flex-1 rounded-lg border-[1.5px] border-ih-neutral-200 px-3.5 text-[13.5px] text-ih-neutral-800"
        />
        <select
          data-testid="staff-filter-provider"
          aria-label="المزود"
          value={providerFilter}
          onChange={(event) => setProviderFilter(event.target.value)}
          className="min-h-[40px] min-w-[170px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[13.5px] font-semibold text-ih-neutral-800"
        >
          <option value="">كل المزودين</option>
          {providers.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
        <select
          data-testid="staff-filter-state"
          aria-label="الحالة"
          value={stateFilter}
          onChange={(event) => setStateFilter(event.target.value)}
          className="min-h-[40px] min-w-[140px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[13.5px] font-semibold text-ih-neutral-800"
        >
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="never_used">لم يُستخدم بعد</option>
          <option value="disabled">معطّل</option>
        </select>
        <Button size="sm" data-testid="staff-new" onClick={() => setCreateOpen(true)}>
          + حساب جديد
        </Button>
      </div>

      <main data-testid="admin-staff" className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-3">
          {errorAr !== null ? (
            <p
              data-testid="staff-error"
              role="alert"
              className="rounded-lg px-3.5 py-2.5 text-[12.5px]"
              style={{
                background: resolveTokenCss('warning.bg'),
                color: resolveTokenCss('warning.text'),
              }}
            >
              {errorAr}
            </p>
          ) : null}

          <div
            className="flex items-center gap-2.5 rounded-lg px-3.5 py-2.5"
            style={{
              background: resolveTokenCss('info.bg'),
              border: `1px solid ${resolveTokenCss('primary.400')}`,
            }}
          >
            <span aria-hidden="true" className="shrink-0 text-[14px]">
              ℹ
            </span>
            <span
              className="text-[12.5px] leading-[1.6]"
              style={{ color: resolveTokenCss('primary.800') }}
            >
              الحسابات تُنشأ من هنا فقط — لا تسجيل ذاتي للشركاء. كل حساب مربوط بفرع واحد ويرى
              حجوزاته وأسعاره فقط. تعطيل الحساب يقطع دخوله فوراً.
            </span>
          </div>

          {accounts.length === 0 ? (
            <div
              data-testid="staff-empty"
              className="flex flex-col items-center gap-3 rounded-xl border border-ih-neutral-200 bg-white p-12 text-center shadow-sm"
            >
              <span aria-hidden="true" className="text-[30px]">
                👤
              </span>
              <span className="text-[17px] font-extrabold text-ih-neutral-800">لا حسابات بعد</span>
              <span className="max-w-[480px] text-[13px] leading-[1.7] text-ih-neutral-600">
                أنشئ حساباً لكل فرع نشط ليستقبل حجوزاته. ستتسلّم كلمة مرور مؤقتة تسلّمها للشريك
                بنفسك.
              </span>
              <Button size="md" data-testid="staff-empty-new" onClick={() => setCreateOpen(true)}>
                + حساب جديد
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-ih-neutral-200 bg-white shadow-sm">
              <table data-testid="staff-table" className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-ih-neutral-200 bg-ih-neutral-50 text-[11.5px] font-bold text-ih-neutral-600">
                    <th className="px-4 py-2.5 text-start">الحساب</th>
                    <th className="px-4 py-2.5 text-start">الفرع</th>
                    <th className="px-4 py-2.5 text-start text-ih-neutral-400">الدور</th>
                    <th className="px-4 py-2.5 text-start">آخر دخول</th>
                    <th className="px-4 py-2.5 text-start">الحالة</th>
                    <th className="px-4 py-2.5 text-start">أُنشئ</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((account) => (
                    <tr
                      key={account.providerUserId}
                      data-testid="staff-row"
                      tabIndex={0}
                      role="link"
                      onClick={() => router.push(`/admin/staff?account=${account.providerUserId}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          router.push(`/admin/staff?account=${account.providerUserId}`)
                        }
                      }}
                      className="cursor-pointer border-b border-ih-neutral-100 text-[13px] text-ih-neutral-700 hover:bg-ih-neutral-50"
                      style={{ opacity: account.state === 'disabled' ? 0.62 : 1 }}
                    >
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold"
                            style={{
                              background: resolveTokenCss('primary.50'),
                              color: resolveTokenCss('primary.700'),
                            }}
                          >
                            {(account.nameAr ?? '؟').trim().charAt(0)}
                          </span>
                          <span className="font-bold text-ih-neutral-800">
                            {account.nameAr ?? '—'}
                          </span>
                          <span dir="ltr" className="truncate text-[11.5px] text-ih-neutral-500">
                            {account.email ?? '—'}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[12.5px] text-ih-neutral-600">
                        {account.branchNameAr ?? '—'}
                      </td>
                      {/* Drawn disabled and footnoted — no role tiers in v1. */}
                      <td className="px-4 py-2.5 text-ih-neutral-400">—</td>
                      <td className="px-4 py-2.5 text-[12px] text-ih-neutral-600">
                        {account.lastSignInAt === null
                          ? 'لم يدخل بعد'
                          : fmtWhen(account.lastSignInAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <StateChip state={account.state} />
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-ih-neutral-500">
                        {fmtDay(account.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visible.length === 0 ? (
                <p data-testid="staff-no-matches" className="p-6 text-[13px] text-ih-neutral-600">
                  لا حساب يطابق البحث أو المرشِّحات.
                </p>
              ) : null}
            </div>
          )}

          <p className="text-[11.5px] leading-[1.7] text-ih-neutral-500">
            عمود «الدور» محجوز لتفريق مدير الفرع من موظف الاستقبال — في v1 كل حساب يرى فرعه كاملاً،
            والعمود يظهر معطّلاً حتى تُقرّ الأدوار.
          </p>
        </div>
      </main>

      {createOpen ? (
        <CreateAccountDialog
          branches={branches}
          isPending={isPending}
          onCancel={() => setCreateOpen(false)}
          onSubmit={(values) =>
            run(
              () => createStaffAccountAction(values),
              (result) => {
                setCreateOpen(false)
                if (result.tempPassword !== undefined) {
                  onIssued({
                    name: values.name,
                    email: values.email,
                    password: result.tempPassword,
                  })
                }
              },
            )
          }
        />
      ) : null}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// B · step 2 — the temp password, shown ONCE
// ═══════════════════════════════════════════════════════════════════════════
function TempPasswordDialog({
  issued,
  onClose,
}: {
  issued: { name: string; email: string; password: string }
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-8"
      style={{ background: 'rgba(2,20,27,0.5)' }}
    >
      <div
        data-testid="staff-temp-password"
        role="dialog"
        aria-modal="true"
        className="w-[580px] max-w-full overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex flex-col gap-2 px-6 pt-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[17px] font-extrabold text-ih-neutral-800">
              تم إنشاء حساب {issued.name}
            </span>
            <span className="whitespace-nowrap rounded-full bg-ih-neutral-100 px-2.5 py-[3px] text-[11.5px] font-bold text-ih-neutral-600">
              خطوة ٢ من ٢
            </span>
          </div>
          <span className="text-[13px] leading-[1.7] text-ih-neutral-600">
            سلّم هذه الكلمة للشريك بنفسك — لن تظهر مرة أخرى بعد إغلاق النافذة. إن فُقدت، ولّد بديلة
            من صفحة الحساب.
          </span>
        </div>

        <div
          className="m-6 overflow-hidden rounded-xl"
          style={{
            border: `1px solid ${resolveTokenCss('primary.400')}`,
            background: resolveTokenCss('primary.50'),
          }}
        >
          <div className="flex flex-col gap-2.5 p-4">
            <span
              className="text-[11.5px] font-bold"
              style={{ color: resolveTokenCss('primary.700') }}
            >
              كلمة المرور المؤقتة
            </span>
            <div className="flex items-center gap-2.5">
              <span
                dir="ltr"
                data-testid="staff-temp-password-value"
                className="min-w-0 flex-1 rounded-lg bg-white px-3.5 py-3 text-center font-mono text-[22px] font-bold tracking-[0.12em]"
                style={{
                  color: resolveTokenCss('primary.800'),
                  border: `1px solid ${resolveTokenCss('primary.400')}`,
                }}
              >
                {issued.password}
              </span>
              <Button
                size="md"
                variant="outline"
                data-testid="staff-temp-copy"
                onClick={() => {
                  void navigator.clipboard?.writeText(issued.password)
                  setCopied(true)
                }}
              >
                {copied ? 'نُسخت' : 'نسخ'}
              </Button>
            </div>
          </div>
          <div
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
            style={{
              background: 'rgba(255,255,255,0.7)',
              borderTop: `1px solid ${resolveTokenCss('primary.400')}`,
            }}
          >
            <span className="text-[12px]" style={{ color: resolveTokenCss('primary.800') }}>
              تنتهي صلاحيتها بعد ٧٢ ساعة إن لم تُستخدم
            </span>
            <span
              className="text-[12px] font-bold"
              style={{ color: resolveTokenCss('primary.800') }}
            >
              يُطلب تغييرها عند أول دخول
            </span>
          </div>
        </div>

        <div className="mx-6 mb-4 overflow-hidden rounded-xl border border-ih-neutral-200">
          <div className="flex items-center justify-between gap-3 border-b border-ih-neutral-100 px-4 py-2.5">
            <span className="text-[12.5px] text-ih-neutral-700">البريد للدخول</span>
            <span dir="ltr" className="font-mono text-[12.5px] font-bold text-ih-neutral-800">
              {issued.email}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ih-neutral-200 bg-ih-neutral-50 px-6 py-3.5">
          <span className="text-[11.5px] text-ih-neutral-600">
            يُسجَّل الإنشاء في سجل التغييرات باسمك.
          </span>
          <Button size="md" data-testid="staff-temp-done" onClick={onClose}>
            نسختُها — إغلاق
          </Button>
        </div>
      </div>
    </div>
  )
}

function CreateAccountDialog({
  branches,
  isPending,
  onCancel,
  onSubmit,
}: {
  branches: readonly BranchOption[]
  isPending: boolean
  onCancel: () => void
  onSubmit: (values: { name: string; email: string; branchId: string }) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [branchId, setBranchId] = useState(branches[0]?.branchId ?? '')

  // ⚠ Same defect as the provider login form, same fix: `includes('@')` only
  // disabled the button and said nothing, so «إنشاء» sat dead with no reason
  // while the Edge Function behind it would have answered `invalid_email`.
  // One rule from core now drives the button, the message and the server.
  const emailErrorKey = emailFieldErrorKey(email, emailTouched)
  const emailErrorAr = emailErrorKey === null ? null : getErrorMessage(emailErrorKey, 'ar')
  const ready =
    name.trim().length >= 2 && emailFieldErrorKey(email, true) === null && branchId !== ''

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-8"
      style={{ background: 'rgba(2,20,27,0.5)' }}
    >
      <div
        data-testid="staff-create-dialog"
        role="dialog"
        aria-modal="true"
        className="max-h-full w-[580px] max-w-full overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex flex-col gap-2 px-6 pt-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[17px] font-extrabold text-ih-neutral-800">حساب جديد لفرع</span>
            <span className="whitespace-nowrap rounded-full bg-ih-neutral-100 px-2.5 py-[3px] text-[11.5px] font-bold text-ih-neutral-600">
              خطوة ١ من ٢
            </span>
          </div>
          <span className="text-[13px] leading-[1.7] text-ih-neutral-600">
            تُنشئ الإدارة الحساب وتسلّم كلمة مرور مؤقتة للشريك. لا يستطيع الشريك تسجيل نفسه.
          </span>
        </div>

        <div className="flex flex-col gap-3.5 px-6 py-5">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-ih-neutral-700">اسم المستخدم</span>
              <input
                data-testid="staff-create-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="min-h-[44px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[14px]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-ih-neutral-700">
                البريد — يُستخدم للدخول
              </span>
              <input
                dir="ltr"
                type="email"
                data-testid="staff-create-email"
                value={email}
                aria-invalid={emailErrorAr !== null || undefined}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setEmailTouched(true)}
                className="min-h-[44px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-start text-[14px]"
                style={
                  emailErrorAr === null
                    ? undefined
                    : {
                        borderColor: resolveTokenCss(INPUT_ERROR.borderColor),
                        background: resolveTokenCss(INPUT_ERROR.background),
                      }
                }
              />
              {emailErrorAr !== null ? (
                <span
                  role="alert"
                  data-testid="staff-create-email-error"
                  className="flex items-center gap-1.5"
                  style={{
                    fontSize: INPUT_HELP.fontSize,
                    fontWeight: INPUT_HELP.errorFontWeight,
                    color: INPUT_HELP.errorColor,
                  }}
                >
                  <span aria-hidden="true">⚠</span> {emailErrorAr}
                </span>
              ) : null}
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-ih-neutral-700">الفرع</span>
              <select
                data-testid="staff-create-branch"
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                className="min-h-[44px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[14px]"
              >
                {branches.map((branch) => (
                  <option key={branch.branchId} value={branch.branchId}>
                    {branch.providerNameAr} — {branch.branchNameAr}
                  </option>
                ))}
              </select>
            </label>
            {/* Drawn disabled and footnoted — the standing no-role-tiers decision. */}
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-ih-neutral-400">الدور</span>
              <select
                disabled
                data-testid="staff-create-role"
                className="min-h-[44px] cursor-not-allowed rounded-lg border-[1.5px] border-ih-neutral-200 bg-ih-neutral-50 px-3 text-[14px] text-ih-neutral-400 opacity-60"
              >
                <option>وصول كامل للفرع — نسخة ٢</option>
              </select>
            </label>
          </div>

          <div
            className="flex items-center gap-2.5 rounded-lg px-3.5 py-2.5"
            style={{
              background: resolveTokenCss('info.bg'),
              border: `1px solid ${resolveTokenCss('primary.400')}`,
            }}
          >
            <span aria-hidden="true" className="shrink-0 text-[14px]">
              ℹ
            </span>
            <span
              className="text-[12px] leading-[1.6]"
              style={{ color: resolveTokenCss('primary.800') }}
            >
              سيُطلب تغيير كلمة المرور المؤقتة عند أول دخول. الحساب يرى فرعه فقط — ولا يرى نسبة
              العمولة ولا كشوف الحساب.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ih-neutral-200 bg-ih-neutral-50 px-6 py-3.5">
          <Button size="md" variant="ghost" onClick={onCancel} disabled={isPending}>
            إلغاء
          </Button>
          <Button
            size="md"
            data-testid="staff-create-submit"
            disabled={!ready || isPending}
            onClick={() => onSubmit({ name: name.trim(), email: email.trim(), branchId })}
          >
            إنشاء وتوليد كلمة مؤقتة
          </Button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// C / C2 · the account detail, and the two disable variants
// ═══════════════════════════════════════════════════════════════════════════
function StaffDetailScreen({
  detail,
  disablePreview,
  isPending,
  errorAr,
  run,
  onIssued,
  onBack,
}: {
  detail: StaffDetail
  disablePreview: DisablePreview | null
  isPending: boolean
  errorAr: string | null
  run: (a: () => Promise<StaffActionResult>, onIssued?: (r: StaffActionResult) => void) => void
  onIssued: (issued: { name: string; email: string; password: string }) => void
  onBack: () => void
}) {
  const router = useRouter()
  const { account, audit } = detail
  const [confirmDisable, setConfirmDisable] = useState(false)

  const relay = (result: StaffActionResult) => {
    if (result.tempPassword !== undefined) {
      onIssued({
        name: account.nameAr ?? '—',
        email: account.email ?? '—',
        password: result.tempPassword,
      })
    }
  }

  return (
    <>
      <AdminHeader
        title={account.nameAr ?? '—'}
        displayName="مؤسِّس"
        subtitle={`${account.providerNameAr} — ${account.branchNameAr ?? '—'} · آخر دخول: ${
          account.lastSignInAt === null ? 'لم يدخل بعد' : fmtWhen(account.lastSignInAt)
        }`}
      />

      <main data-testid="admin-staff-detail" className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-4">
          <button
            type="button"
            data-testid="staff-back"
            onClick={onBack}
            className="w-fit text-[12.5px] text-ih-primary-600 hover:underline"
          >
            ◂ حسابات المزودين
          </button>

          {errorAr !== null ? (
            <p
              data-testid="staff-error"
              role="alert"
              className="rounded-lg px-3.5 py-2.5 text-[12.5px]"
              style={{
                background: resolveTokenCss('warning.bg'),
                color: resolveTokenCss('warning.text'),
              }}
            >
              {errorAr}
            </p>
          ) : null}

          <section className="overflow-hidden rounded-xl border border-ih-neutral-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ih-neutral-200 px-4.5 py-3.5">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-[14.5px] font-bold text-ih-neutral-800">
                  بيانات الحساب والصلاحية
                </h2>
                <span className="text-[11.5px] text-ih-neutral-600">
                  أُنشئ: {fmtDay(account.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StateChip state={account.state} />
                <span
                  className="whitespace-nowrap rounded-full px-3 py-1 text-[11.5px] font-bold text-white"
                  style={{ background: '#023449' }}
                >
                  🔓 تُدار من الإدارة — مقفلة للشريك
                </span>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 p-4.5 text-[13px]">
              <div className="flex flex-col gap-0.5">
                <dt className="text-[11.5px] text-ih-neutral-500">اسم المستخدم</dt>
                <dd className="font-semibold text-ih-neutral-800">{account.nameAr ?? '—'}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-[11.5px] text-ih-neutral-500">البريد — يُستخدم للدخول</dt>
                {/* Same rule as the catalog's Detail: isolate the Latin run,
                    never re-anchor the block, or the address slides away from
                    the label that names it. */}
                <dd className="font-semibold text-ih-neutral-800">
                  <bdi dir="ltr" className="font-mono">
                    {account.email ?? '—'}
                  </bdi>
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-[11.5px] text-ih-neutral-500">الفرع</dt>
                <dd className="font-semibold text-ih-neutral-800">{account.branchNameAr ?? '—'}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-[11.5px] text-ih-neutral-400">الدور</dt>
                <dd className="flex items-center gap-2 text-ih-neutral-500">
                  وصول كامل للفرع
                  <span className="rounded-full bg-ih-neutral-200 px-2 py-[2px] text-[10.5px] font-bold text-ih-neutral-500">
                    نسخة ٢
                  </span>
                </dd>
              </div>
            </dl>
            <p className="mx-4.5 mb-4.5 rounded-lg border border-ih-neutral-200 bg-ih-neutral-50 px-3.5 py-2.5 text-[12.5px] leading-[1.6] text-ih-neutral-700">
              ما يراه هذا الحساب: حجوزات فرعه، أسعار خدماته، وأيامه القادمة. ما لا يراه: نسبة
              العمولة، كشوف الحساب، بيانات الفروع الأخرى.
            </p>
          </section>

          <section className="overflow-hidden rounded-xl border border-ih-neutral-200 bg-white shadow-sm">
            <div className="border-b border-ih-neutral-200 px-4.5 py-3.5">
              <h2 className="text-[14.5px] font-bold text-ih-neutral-800">الدخول</h2>
            </div>
            <div className="flex flex-col gap-3 p-4.5">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[13px] font-bold text-ih-neutral-800">
                    كلمة مرور مؤقتة بديلة
                  </span>
                  <span className="text-[12px] leading-[1.6] text-ih-neutral-600">
                    تُبطِل كلمة المرور الحالية فوراً وتُخرِج الحساب من جلساته — استخدمها إن فُقدت
                    الكلمة.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid="staff-regenerate"
                  disabled={!account.isActive || isPending}
                  onClick={() =>
                    run(() => regenerateTempPasswordAction(account.providerUserId), relay)
                  }
                >
                  توليد كلمة مؤقتة
                </Button>
              </div>

              <div className="h-px bg-ih-neutral-100" />

              <div className="flex flex-wrap items-center gap-4">
                <span className="flex-1 text-[12.5px] leading-[1.7] text-ih-neutral-600">
                  {account.isActive
                    ? 'التعطيل يقطع الدخول في نفس اللحظة — لا انتظار انتهاء الجلسة.'
                    : 'الحساب معطّل. إعادة التفعيل تُعيد الدخول بكلمة مؤقتة جديدة.'}
                </span>
                {account.isActive ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    data-testid="staff-disable"
                    onClick={() => {
                      setConfirmDisable(true)
                      router.replace(
                        `/admin/staff?account=${account.providerUserId}&confirm=disable`,
                      )
                    }}
                  >
                    تعطيل الحساب
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    data-testid="staff-enable"
                    disabled={isPending}
                    onClick={() =>
                      run(() => enableStaffAccountAction(account.providerUserId), relay)
                    }
                  >
                    إعادة التفعيل بكلمة مؤقتة
                  </Button>
                )}
              </div>
            </div>
          </section>

          <StaffAuditPanel entries={audit} />
        </div>
      </main>

      {confirmDisable ? (
        <DisableConfirm
          preview={disablePreview}
          isPending={isPending}
          onCancel={() => {
            setConfirmDisable(false)
            router.replace(`/admin/staff?account=${account.providerUserId}`)
          }}
          onConfirm={() =>
            run(
              () => disableStaffAccountAction(account.providerUserId),
              () => {
                setConfirmDisable(false)
              },
            )
          }
        />
      ) : null}
    </>
  )
}

function DisableConfirm({
  preview,
  isPending,
  onCancel,
  onConfirm,
}: {
  preview: DisablePreview | null
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  if (preview === null) {
    return (
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center p-8"
        style={{ background: 'rgba(2,20,27,0.5)' }}
      >
        <div
          data-testid="staff-disable-confirm-loading"
          className="rounded-3xl bg-white px-8 py-6 text-[13px] text-ih-neutral-600 shadow-2xl"
        >
          يحسب أثر التعطيل على الفرع…
        </div>
      </div>
    )
  }

  const name = preview.nameAr ?? 'هذا الحساب'
  const branch = preview.branchNameAr ?? 'الفرع'

  // ⚠ THE ESCALATED VARIANT IS A NUMBER, NOT A JUDGEMENT — `isLastActiveAccount`
  // comes from the preview function, per SPEC-A05.
  if (preview.isLastActiveAccount) {
    const rows: ConfirmRow[] = [
      {
        label: 'حجوزات قادمة ستصل بلا متابعة',
        value: formatCountedAr(preview.upcomingBookings, AR_UPCOMING_BOOKING),
        tone: 'warn',
        emphasise: true,
      },
      ...(preview.nearestBooking === null
        ? []
        : [
            {
              label: 'أقربها',
              value: `${fmtDay(preview.nearestBooking.slotDate)} ${preview.nearestBooking.slotTime.slice(0, 5)} — ${preview.nearestBooking.serviceNameAr ?? '—'}`,
              tone: 'warn' as const,
            },
          ]),
      {
        label: 'مواعيد فارغة تبقى قابلة للحجز',
        value: formatCountedAr(preview.openSlots, AR_EMPTY_SLOT),
        tone: 'neutral',
      },
      {
        label: 'البديل إن كان الفرع سيتوقف فعلاً',
        value: 'أوقف الفرع — يخفيه من المرضى',
        tone: 'good',
      },
    ]
    return (
      <ConsequentialConfirm
        testId="staff-disable-confirm"
        warningBanner={`هذا آخر حساب نشط في ${branch}`}
        title="لن يتمكن أحد في هذا الفرع من رؤية الحجوزات"
        body="الحجوزات الجديدة ستستمر بالوصول إلى الفرع دون أي متابعة: لا أحد يفتح البوابة، ولا أحد يستقبل المريض في موعده. الفرع يبقى ظاهراً للمرضى وقابلاً للحجز — التعطيل لا يوقف الحجز."
        rows={rows}
        acknowledgement={`أفهم أن ${branch} سيبقى قابلاً للحجز بلا أي متابعة، وأن ${formatCountedAr(preview.upcomingBookings, AR_UPCOMING_BOOKING)} قد تصل دون أن يراها أحد.`}
        confirmLabel="تعطيل وترك الفرع بلا متابعة"
        confirmTestId="staff-disable-confirm-submit"
        pending={isPending}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    )
  }

  const rows: ConfirmRow[] = [
    {
      label: preview.hasOpenSession ? 'جلسة مفتوحة الآن تُغلَق فوراً' : 'لا جلسة مفتوحة الآن',
      value: preview.hasOpenSession ? `آخر نشاط: ${fmtWhen(preview.lastSessionActivityAt)}` : '—',
      tone: preview.hasOpenSession ? 'warn' : 'neutral',
    },
    {
      label: `${branch} يبقى بـ ${formatCountedAr(preview.activeAccountsRemaining, AR_ACTIVE_ACCOUNT)}`,
      value: preview.otherAccounts[0]?.nameAr ?? '—',
      tone: 'warn',
    },
    {
      label: 'حجوزات الفرع لا تتأثر',
      value: `${formatCountedAr(preview.upcomingBookings, AR_UPCOMING_BOOKING)} تُخدَم كما هي`,
      tone: 'good',
    },
  ]

  return (
    <ConsequentialConfirm
      testId="staff-disable-confirm"
      title={`التعطيل يقطع دخول ${name} في نفس اللحظة`}
      body="تُغلَق جلسته المفتوحة الآن وتُرفَض محاولات الدخول بكلمته الحالية. لا يُحذف الحساب ولا سجلّه — إعادة التفعيل تُعيد الدخول بكلمة مؤقتة جديدة."
      rows={rows}
      acknowledgement="أفهم أن الدخول يُقطع فوراً، وأن على الفرع من يستقبل حجوزاته بعد التعطيل."
      confirmLabel="تعطيل الحساب وقطع الدخول"
      confirmTestId="staff-disable-confirm-submit"
      pending={isPending}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

/** «سجل التغييرات — يشمل الدخول والتعطيل», badged per portal. */
function StaffAuditPanel({ entries }: { entries: readonly StaffDetail['audit'][number][] }) {
  const ACTION_AR: Record<string, string> = {
    account_created: 'إنشاء الحساب',
    temp_password_issued: 'كلمة مرور مؤقتة — ولّدتها الإدارة',
    password_changed: 'تغيير كلمة المرور عند أول دخول',
    account_disabled: 'تعطيل الحساب',
    account_enabled: 'إعادة تفعيل الحساب',
  }

  return (
    <section
      data-testid="staff-audit"
      className="flex flex-col gap-3 rounded-xl border border-ih-neutral-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[15px] font-extrabold text-ih-neutral-800">سجل التغييرات</h2>
          <span className="text-[11.5px] text-ih-neutral-500">
            على هذا الحساب — يشمل الدخول والتعطيل
          </span>
        </div>
        <span className="shrink-0 text-[12px] text-ih-neutral-500">
          {toArabicDigits(String(entries.length))} تعديلات
        </span>
      </div>

      {entries.length === 0 ? (
        <p data-testid="staff-audit-empty" className="text-[12.5px] text-ih-neutral-500">
          لا تعديلات بعد — أول تغيير يُسجَّل هنا باسمك وتاريخه.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {entries.map((entry, index) => (
            <li
              key={`${entry.changedAt}-${index}`}
              data-testid="staff-audit-entry"
              className="flex flex-col gap-1 border-b border-ih-neutral-100 pb-2.5 last:border-0"
            >
              <span className="text-[12.5px] font-bold text-ih-neutral-800">
                {ACTION_AR[entry.action] ?? entry.action}
              </span>
              <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-ih-neutral-500">
                {entry.who} · {fmtWhen(entry.changedAt)}
                <span
                  className="whitespace-nowrap rounded-full px-2 py-[2px] text-[10.5px] font-semibold"
                  style={
                    entry.source === 'admin'
                      ? { color: '#FFFFFF', background: '#023449' }
                      : {
                          color: resolveTokenCss('neutral.600'),
                          background: resolveTokenCss('neutral.100'),
                        }
                  }
                >
                  {entry.source === 'admin' ? 'الإدارة' : 'بوابة الشركاء'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
