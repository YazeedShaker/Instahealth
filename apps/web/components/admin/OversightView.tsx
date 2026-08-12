'use client'

import { formatPiastersEgpAr, isolateLtr, starGlyphs, toArabicDigits } from '@instahealth/core'
import { resolveTokenCss } from '@instahealth/design-tokens'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

import {
  adminCancelBookingAction,
  setReviewHiddenAction,
  type OversightActionResult,
} from '../../app/admin/oversight-actions'
import { CANCEL_REASONS } from '../../lib/oversight/cancel-reasons'
import type { OversightDetail, OversightRow, ProviderOption } from '../../lib/oversight/bookings'
import { Button } from '../ui/Button'
import { AdminHeader } from './AdminHeader'
import { ConsequentialConfirm } from './ConsequentialConfirm'

// A06 — «الحجوزات», built to `Admin - Bookings Oversight.dc.html`.
//
// ⚠ TWO DELIBERATE ABSENCES, both of them the point of the screen:
//
// ① NO «تسجيل الوصول». The admin cannot check a patient in. Arrival is a fact
//    only the desk can witness, and the two-portal authority model depends on
//    the admin not being able to assert it remotely. The drawer reuses P02's
//    structure precisely so the missing control is visible as a difference.
// ② NO RESCHEDULE. Out of scope by spec; a booking is cancelled and re-made.
//
// And the money block is admin-only: the desk never sees a commission figure.

const CAIRO_DATE = new Intl.DateTimeFormat('ar-EG', {
  timeZone: 'Africa/Cairo',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const STATUS_AR: Record<string, { label: string; color: string; bg: string }> = {
  pending_payment: { label: 'بانتظار التأكيد', color: 'warning.text', bg: 'warning.bg' },
  confirmed: { label: 'مؤكد', color: 'primary.700', bg: 'success.bg' },
  arrived: { label: 'وصل', color: 'primary.700', bg: 'success.bg' },
  completed: { label: 'تمت الخدمة', color: 'primary.700', bg: 'success.bg' },
  cancelled: { label: 'ملغى', color: 'neutral.600', bg: 'neutral.100' },
  no_show: { label: 'لم يحضر', color: 'warning.text', bg: 'warning.bg' },
}

function StatusChip({ status }: { status: string }) {
  const tone = STATUS_AR[status] ?? { label: status, color: 'neutral.600', bg: 'neutral.100' }
  return (
    <span
      data-testid={`oversight-status-${status}`}
      className="inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold"
      style={{ color: resolveTokenCss(tone.color), background: resolveTokenCss(tone.bg) }}
    >
      {tone.label}
    </span>
  )
}

export function OversightView({
  rows,
  total,
  providers,
  detail,
  search,
  providerId,
  status,
}: {
  rows: readonly OversightRow[]
  total: number
  providers: readonly ProviderOption[]
  detail: OversightDetail | null
  search: string
  providerId: string
  status: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(search)
  const [errorAr, setErrorAr] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reasonCode, setReasonCode] = useState<string>(CANCEL_REASONS[0].code)
  const [reasonNote, setReasonNote] = useState('')
  const inFlight = useRef(false)
  // Focused by the not-found state's «ابحث برقم الهاتف» — the button hands the
  // admin an empty, focused box rather than only telling them what to type.
  const searchRef = useRef<HTMLInputElement>(null)

  const push = (next: Record<string, string>) => {
    const params = new URLSearchParams()
    const merged = { search: query, provider: providerId, status, ...next }
    for (const [key, value] of Object.entries(merged)) if (value !== '') params.set(key, value)
    router.push(`/admin/bookings?${params.toString()}`)
  }

  const run = (action: () => Promise<OversightActionResult>, after?: () => void) => {
    if (inFlight.current) return
    inFlight.current = true
    setErrorAr(null)
    startTransition(async () => {
      try {
        const result = await action()
        if (!result.ok) setErrorAr(result.errorAr)
        else {
          after?.()
          router.refresh()
        }
      } finally {
        inFlight.current = false
      }
    })
  }

  return (
    <>
      <AdminHeader
        title="الحجوزات"
        displayName="مؤسِّس"
        subtitle={`${toArabicDigits(String(total))} حجزاً في النطاق المعروض`}
      />

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-ih-neutral-200 bg-white px-6 py-3">
        <form
          className="flex min-w-[240px] flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            push({ search: query })
          }}
        >
          <input
            ref={searchRef}
            data-testid="oversight-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="رقم الحجز أو رقم هاتف المريض أو اسمه"
            aria-label="ابحث برقم الحجز أو هاتف المريض"
            className="min-h-[40px] flex-1 rounded-lg border-[1.5px] border-ih-neutral-200 px-3.5 text-[13.5px] text-ih-neutral-800"
          />
          <Button size="sm" type="submit" data-testid="oversight-search-submit">
            بحث
          </Button>
        </form>
        <select
          data-testid="oversight-filter-provider"
          aria-label="المزود"
          value={providerId}
          onChange={(event) => push({ provider: event.target.value })}
          className="min-h-[40px] min-w-[170px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[13.5px] font-semibold text-ih-neutral-800"
        >
          <option value="">كل المزودين</option>
          {providers.map((provider) => (
            <option key={provider.providerId} value={provider.providerId}>
              {provider.nameAr}
            </option>
          ))}
        </select>
        <select
          data-testid="oversight-filter-status"
          aria-label="الحالة"
          value={status}
          onChange={(event) => push({ status: event.target.value })}
          className="min-h-[40px] min-w-[150px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[13.5px] font-semibold text-ih-neutral-800"
        >
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_AR).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>
      </div>

      <main data-testid="admin-bookings" className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-3">
          {errorAr !== null ? (
            <p
              role="alert"
              data-testid="oversight-error"
              className="rounded-lg px-3.5 py-2.5 text-[12.5px]"
              style={{
                background: resolveTokenCss('warning.bg'),
                color: resolveTokenCss('warning.text'),
              }}
            >
              {errorAr}
            </p>
          ) : null}

          {rows.length === 0 ? (
            // Not-found routes to the phone lookup rather than dead-ending —
            // «I have the patient on the line» is the situation this screen is
            // opened in.
            <div
              data-testid="oversight-empty"
              className="flex flex-col items-center gap-3 rounded-xl border border-ih-neutral-200 bg-white p-12 text-center shadow-sm"
            >
              <span aria-hidden="true" className="text-[30px]">
                🔍
              </span>
              <span className="text-[16px] font-extrabold text-ih-neutral-800">
                لا حجز بهذا الرقم
              </span>
              <span className="max-w-[500px] text-[13px] leading-[1.7] text-ih-neutral-600">
                تأكّد من الرقم كما أرسلناه للمريض، أو ابحث برقم هاتفه — الهاتف يجد كل حجوزاته حتى
                الملغاة. رقم الحجز يُقبل بأي صيغة (<bdi dir="ltr">IH-2026-12345</bdi> أو{' '}
                <bdi dir="ltr">ih202612345</bdi>).
              </span>
              {/* ⚠ THE TWO WAYS OUT, which the build did not have. The frame
                  draws both CTAs and SPEC-A06 says the not-found state "routes
                  to phone lookup" — the built screen offered the sentence and
                  no button, so «I have the patient on the line» ended at a
                  paragraph. Found by reading the capture, not the markup (§9).
                  Neither button is a new predicate: one clears the query back
                  to today, the other hands the search box back with the ref
                  removed so a phone number can be typed straight in. */}
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                <Button
                  size="md"
                  data-testid="oversight-empty-phone"
                  onClick={() => {
                    setQuery('')
                    push({ search: '' })
                    searchRef.current?.focus()
                  }}
                >
                  ابحث برقم الهاتف
                </Button>
                <Button
                  size="md"
                  variant="outline"
                  data-testid="oversight-empty-today"
                  onClick={() => {
                    setQuery('')
                    push({ search: '', provider: '', status: '' })
                  }}
                >
                  حجوزات اليوم
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-ih-neutral-200 bg-white shadow-sm">
              <table data-testid="oversight-table" className="w-full min-w-[900px] border-collapse">
                <thead>
                  <tr className="border-b border-ih-neutral-200 bg-ih-neutral-50 text-[11.5px] font-bold text-ih-neutral-600">
                    <th className="px-4 py-2.5 text-start">رقم الحجز</th>
                    <th className="px-4 py-2.5 text-start">المريض</th>
                    <th className="px-4 py-2.5 text-start">الفرع</th>
                    <th className="px-4 py-2.5 text-start">الموعد</th>
                    <th className="px-4 py-2.5 text-start">الإجمالي</th>
                    <th className="px-4 py-2.5 text-start">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.bookingId}
                      data-testid="oversight-row"
                      tabIndex={0}
                      role="link"
                      onClick={() => push({ booking: row.bookingId })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          push({ booking: row.bookingId })
                        }
                      }}
                      className="cursor-pointer border-b border-ih-neutral-100 text-[13px] text-ih-neutral-700 hover:bg-ih-neutral-50"
                      // ⚠ An admin-cancelled row is tinted deep ink, per the
                      // frame: the founder must be able to see at a glance which
                      // cancellations were OURS rather than the patient's.
                      style={
                        row.cancelledBy === 'admin'
                          ? { background: 'rgba(2,52,73,0.06)' }
                          : undefined
                      }
                    >
                      <td className="px-4 py-2.5">
                        <span dir="ltr" className="font-mono text-[12px] font-bold">
                          {row.bookingRef}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">{row.patientNameAr ?? '—'}</td>
                      <td className="px-4 py-2.5 text-[12.5px] text-ih-neutral-600">
                        {row.branchNameAr}
                      </td>
                      <td className="px-4 py-2.5 text-[12.5px]">
                        {CAIRO_DATE.format(new Date(row.slotDate))} — {row.slotTime.slice(0, 5)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {row.totalEgp === null
                          ? '—'
                          : `${toArabicDigits(String(Math.round(row.totalEgp)))} ج.م`}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusChip status={row.status} />
                        {row.cancelledBy === 'admin' ? (
                          <span
                            data-testid="oversight-admin-cancelled"
                            className="ms-1.5 whitespace-nowrap rounded-full px-2 py-[2px] text-[10.5px] font-bold text-white"
                            style={{ background: '#023449' }}
                          >
                            بقرار الإدارة
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {detail !== null ? (
        <BookingDrawer
          detail={detail}
          isPending={isPending}
          onClose={() => push({ booking: '' })}
          onCancelRequest={() => setCancelOpen(true)}
          onToggleReview={(reviewId, hidden) =>
            run(() =>
              setReviewHiddenAction({
                reviewId,
                hidden,
                reasonCode: hidden ? 'admin_moderation' : undefined,
              }),
            )
          }
        />
      ) : null}

      {cancelOpen && detail !== null ? (
        <ConsequentialConfirm
          testId="oversight-cancel-confirm"
          title={`إلغاء حجز ${detail.patientNameAr ?? ''} بقرار من الإدارة`}
          body="يُلغى الحجز فوراً ويُعاد الموعد إلى المتاح للحجز. السبب يُسجَّل في السجل الداخلي ولا يُرسَل إلى المريض."
          rows={[
            { label: 'الموعد يعود متاحاً للحجز', value: 'فوراً', tone: 'good' },
            {
              label: 'العمولة على هذا الحجز',
              value: 'لا شيء — لا عمولة على حجز ملغى',
              tone: 'neutral',
            },
            { label: 'المبالغ', value: 'لا استرداد — الدفع نقداً في الفرع', tone: 'neutral' },
            { label: 'يُسجَّل باسمك في سجل الحجز', value: 'نعم', tone: 'warn' },
          ]}
          acknowledgement="أفهم أن الحجز يُلغى فوراً وأن سبب الإلغاء داخلي ولا يصل المريض."
          confirmLabel="إلغاء الحجز"
          confirmTestId="oversight-cancel-submit"
          pending={isPending}
          onCancel={() => setCancelOpen(false)}
          onConfirm={() =>
            run(
              () =>
                adminCancelBookingAction({
                  bookingId: detail.bookingId,
                  reasonCode,
                  reasonNote: reasonNote.trim() === '' ? undefined : reasonNote.trim(),
                }),
              () => {
                setCancelOpen(false)
                setReasonNote('')
              },
            )
          }
        >
          <div className="flex flex-col gap-2 px-6 pb-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-ih-neutral-700">سبب الإلغاء</span>
              <select
                data-testid="oversight-cancel-reason"
                value={reasonCode}
                onChange={(event) => setReasonCode(event.target.value)}
                className="min-h-[44px] rounded-lg border-[1.5px] border-ih-neutral-200 px-3 text-[14px]"
              >
                {CANCEL_REASONS.map((reason) => (
                  <option key={reason.code} value={reason.code}>
                    {reason.labelAr}
                  </option>
                ))}
              </select>
            </label>
            {reasonCode === 'other' ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-semibold text-ih-neutral-700">
                  اكتب السبب — مطلوب مع «سبب آخر»
                </span>
                <textarea
                  data-testid="oversight-cancel-note"
                  value={reasonNote}
                  maxLength={500}
                  onChange={(event) => setReasonNote(event.target.value)}
                  className="min-h-[70px] rounded-lg border-[1.5px] border-ih-neutral-200 p-3 text-[13.5px]"
                />
              </label>
            ) : null}
          </div>
        </ConsequentialConfirm>
      ) : null}
    </>
  )
}

function BookingDrawer({
  detail,
  isPending,
  onClose,
  onCancelRequest,
  onToggleReview,
}: {
  detail: OversightDetail
  isPending: boolean
  onClose: () => void
  onCancelRequest: () => void
  /** F08 — raised to the parent, which owns `run` and the in-flight ref. The
   *  drawer stays presentational, exactly as it is for cancel. */
  onToggleReview: (reviewId: string, hidden: boolean) => void
}) {
  const canCancel = !['cancelled', 'completed'].includes(detail.status)

  return (
    <div
      className="fixed inset-0 z-50 flex justify-start"
      style={{ background: 'rgba(2,20,27,0.5)' }}
    >
      <aside
        data-testid="oversight-drawer"
        role="dialog"
        aria-modal="true"
        className="flex h-full w-[460px] max-w-full flex-col overflow-y-auto bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-ih-neutral-200 p-5">
          <div className="flex flex-col gap-1">
            <span dir="ltr" className="font-mono text-[13px] font-bold text-ih-neutral-800">
              {detail.bookingRef}
            </span>
            <StatusChip status={detail.status} />
          </div>
          <button
            type="button"
            data-testid="oversight-drawer-close"
            onClick={onClose}
            className="text-[13px] text-ih-neutral-500 hover:text-ih-neutral-800"
          >
            إغلاق ✕
          </button>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-5 text-[13px]">
          <Row label="المريض" value={detail.patientNameAr ?? '—'} />
          <Row label="الهاتف" value={detail.patientPhone ?? '—'} ltr />
          <Row label="المزود" value={detail.providerNameAr} />
          <Row label="الفرع" value={detail.branchNameAr} />
          <Row
            label="الموعد"
            value={`${CAIRO_DATE.format(new Date(detail.slotDate))} — ${detail.slotTime.slice(0, 5)}`}
          />
          <Row
            label="الإجمالي"
            value={
              detail.totalEgp === null
                ? '—'
                : `${toArabicDigits(String(Math.round(detail.totalEgp)))} ج.م`
            }
          />
        </dl>

        <section className="border-t border-ih-neutral-200 p-5">
          <h3 className="mb-2 text-[13px] font-bold text-ih-neutral-800">الخدمات</h3>
          <ul className="flex flex-col gap-1">
            {detail.services.map((service, index) => (
              <li
                key={`${service.nameAr}-${index}`}
                className="flex justify-between gap-3 text-[12.5px] text-ih-neutral-700"
              >
                <span>{service.nameAr}</span>
                <span className="tabular-nums">
                  {service.priceEgp === null
                    ? '—'
                    : `${toArabicDigits(String(Math.round(service.priceEgp)))} ج.م`}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* ⚠ ADMIN-ONLY. The desk never sees a commission figure, and every
            number here comes from A02's helpers — the drawer does no arithmetic,
            so it cannot disagree with the statement it links to. */}
        {detail.commission !== null ? (
          <section
            data-testid="oversight-money"
            className="border-t border-ih-neutral-200 p-5"
            style={{ background: resolveTokenCss('neutral.50') }}
          >
            <h3 className="mb-2 text-[13px] font-bold text-ih-neutral-800">
              العمولة — تُعرض للإدارة فقط
            </h3>
            {detail.commission.kind === 'none' || detail.commission.kind === 'unknown' ? (
              <p data-testid="oversight-money-none" className="text-[12.5px] text-ih-neutral-600">
                {detail.commission.reasonAr}
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span
                    data-testid={`oversight-money-${detail.commission.kind}`}
                    className="whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-bold"
                    style={{
                      color: resolveTokenCss(
                        detail.commission.kind === 'actual' ? 'primary.700' : 'warning.text',
                      ),
                      background: resolveTokenCss(
                        detail.commission.kind === 'actual' ? 'success.bg' : 'warning.bg',
                      ),
                    }}
                  >
                    {detail.commission.kind === 'actual' ? 'عمولة مستحقة' : 'عمولة متوقعة'}
                  </span>
                  {/* ⚠ «ج.م», NOT a bare number. `formatPiastersEgpAr` returns
                      the digits alone by contract — "the caller appends its own
                      «ج.م», per the design" — and this caller did not, so the
                      admin's money block read «١٨» with no unit while the frame
                      draws «١٣٪ · ٤٩.٤٠ ج.م». CLAUDE.md §7 makes the unit
                      non-negotiable; found by READING the A06 capture (§9). */}
                  <span className="text-[15px] font-extrabold tabular-nums text-ih-neutral-800">
                    {formatPiastersEgpAr(detail.commission.commissionPiasters ?? 0)} ج.م
                  </span>
                </div>
                <span className="text-[11.5px] text-ih-neutral-600">
                  {toArabicDigits(String(detail.commission.percent ?? 0))}٪ — النسبة السارية يوم
                  الحجز
                </span>
              </div>
            )}
          </section>
        ) : null}

        {/* ── F08 · the review, and the only moderation control in v1 ──────
            ⚠ HIDING IS NOT DELETING, and the copy says so. The row stays, the
            audit trail records who and why, and restoring puts it back in the
            branch average immediately — the aggregate trigger counts published
            rows only, so both directions move the star the patient sees.
            ⚠ The author is NOT notified (v1 truth, SPEC-F08 §A.3). */}
        {detail.review !== null ? (
          <section data-testid="oversight-review" className="border-t border-ih-neutral-200 p-5">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-[13px] font-bold text-ih-neutral-800">تقييم المريض</h3>
              <span
                data-testid={`oversight-review-${detail.review.isPublished ? 'published' : 'hidden'}`}
                className="whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-bold"
                style={{
                  color: resolveTokenCss(detail.review.isPublished ? 'primary.700' : 'neutral.600'),
                  background: resolveTokenCss(
                    detail.review.isPublished ? 'success.bg' : 'neutral.100',
                  ),
                }}
              >
                {detail.review.isPublished ? 'ظاهر للمرضى' : 'مخفي — لا يظهر ولا يُحتسب'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="text-[14px]"
                  style={{ color: resolveTokenCss('semantic.warning') }}
                  aria-label={`${detail.review.rating} من ٥`}
                >
                  {starGlyphs(detail.review.rating)}
                </span>
                <span className="text-[12px] text-ih-neutral-600">
                  {detail.review.displayName ?? 'مريض'}
                </span>
              </div>
              <p className="text-[12.5px] leading-[1.7] text-ih-neutral-700">
                {detail.review.comment === null || detail.review.comment.length === 0
                  ? 'قيّم بالنجوم بلا تعليق.'
                  : detail.review.comment}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <Button
                  size="sm"
                  variant={detail.review.isPublished ? 'destructive' : 'primary'}
                  data-testid="oversight-review-toggle"
                  disabled={isPending}
                  onClick={() =>
                    onToggleReview(detail.review!.reviewId, detail.review!.isPublished)
                  }
                >
                  {detail.review.isPublished ? 'إخفاء التقييم' : 'إعادة إظهار التقييم'}
                </Button>
                <span className="text-[11.5px] text-ih-neutral-500">
                  {detail.review.isPublished
                    ? 'يختفي من صفحة الفرع ومن المتوسط فوراً. لا يُحذف، ولا يُخطر صاحبه.'
                    : 'يعود إلى صفحة الفرع وإلى المتوسط فوراً.'}
                </span>
              </div>
            </div>
          </section>
        ) : null}

        {detail.adminHistory.length > 0 ? (
          <section className="border-t border-ih-neutral-200 p-5">
            <h3 className="mb-2 text-[13px] font-bold text-ih-neutral-800">سجل الإدارة</h3>
            <ul className="flex flex-col gap-1.5">
              {detail.adminHistory.map((entry, index) => (
                <li key={index} className="text-[12px] text-ih-neutral-600">
                  {entry.reasonNote ?? entry.reasonCode ?? entry.action} · {entry.who}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-ih-neutral-200 bg-ih-neutral-50 p-5">
          {/* ⚠ NO «تسجيل الوصول» HERE, deliberately — see the file header. */}
          <span className="text-[11.5px] leading-[1.5] text-ih-neutral-500">
            تسجيل الوصول من صلاحية الفرع وحده.
          </span>
          {canCancel ? (
            <Button
              size="sm"
              variant="destructive"
              data-testid="oversight-cancel"
              disabled={isPending}
              onClick={onCancelRequest}
            >
              إلغاء الحجز
            </Button>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

function Row({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11.5px] text-ih-neutral-500">{label}</dt>
      {/* Latin runs are isolated INLINE — the block keeps its RTL anchor, or the
          value drifts away from the label that names it (WORKFLOW §9). */}
      <dd className="font-semibold text-ih-neutral-800">
        {ltr ? <bdi dir="ltr">{isolateLtr(value)}</bdi> : value}
      </dd>
    </div>
  )
}
