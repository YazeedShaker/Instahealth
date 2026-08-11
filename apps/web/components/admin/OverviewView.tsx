'use client'

import {
  AR_SLOT,
  formatCountedAr,
  formatPiastersEgpAr,
  toArabicDigits,
  type ArabicCountedNoun,
} from '@instahealth/core'
import { resolveTokenCss } from '@instahealth/design-tokens'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'

import { runSlotGenerationAction } from '../../app/admin/oversight-actions'
import type { OpsAlert, OpsOverview } from '../../lib/oversight/bookings'
import { Button } from '../ui/Button'
import { AdminHeader } from './AdminHeader'

// A07 — «نظرة عامة», built to `Admin - Ops Overview.dc.html`.
//
// ⚠ THE ATTENTION PANEL IS ORDERED BY PATIENT IMPACT, NOT BY SEVERITY LABEL,
// and NOTHING can be dismissed. An alert here means a patient can be hurt by
// it right now: no bookable slots at a live branch, or bookings arriving at a
// branch nobody can open the portal for. A dismiss button would let the founder
// silence a fact rather than fix it, so there isn't one — each alert carries a
// concrete action instead.
//
// ⚠ AND EXACTLY ONE ALERT ACTION MUTATES: «شغّل التوليد الآن». Every other one
// LINKS to the screen that owns the problem, because an alert panel that can
// change six different things is a second, undocumented admin surface.

const CAIRO_DATETIME = new Intl.DateTimeFormat('ar-EG', {
  timeZone: 'Africa/Cairo',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

function hoursSince(iso: string | null): number | null {
  if (iso === null) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
}

function StatCard({
  label,
  value,
  sub,
  testId,
}: {
  label: string
  value: string
  sub?: string
  testId: string
}) {
  return (
    <div
      data-testid={testId}
      className="flex min-w-0 flex-col gap-1 rounded-xl border border-ih-neutral-200 bg-white p-4 shadow-sm"
    >
      <span className="text-[12px] text-ih-neutral-500">{label}</span>
      <span className="text-[24px] font-extrabold tabular-nums text-ih-neutral-800">{value}</span>
      {sub === undefined ? null : (
        <span className="text-[11.5px] leading-[1.5] text-ih-neutral-500">{sub}</span>
      )}
    </div>
  )
}

/** Counted noun PHRASES — the adjective agrees with the noun, and the noun's
 *  form is already moving with the number, so the whole phrase is what gets
 *  counted. See `formatCountedAr` in core for the rule and why it is shared. */
const AR_ACTIVE_BRANCH: ArabicCountedNoun = {
  singular: 'فرع نشط',
  dual: 'فرعان نشطان',
  plural: 'فروع نشطة',
  accusative: 'فرعاً نشطاً',
}
const AR_OPEN_SLOT: ArabicCountedNoun = {
  singular: 'موعد متاح',
  dual: 'موعدان متاحان',
  plural: 'مواعيد متاحة',
  accusative: 'موعداً متاحاً',
}
const AR_UNSTAFFED_BRANCH: ArabicCountedNoun = {
  singular: 'فرع بلا حساب نشط',
  dual: 'فرعان بلا حساب نشط',
  plural: 'فروع بلا حساب نشط',
  accusative: 'فرعاً بلا حساب نشط',
}
const AR_UPCOMING_BOOKING: ArabicCountedNoun = {
  singular: 'حجز قادم',
  dual: 'حجزان قادمان',
  plural: 'حجوزات قادمة',
  accusative: 'حجزاً قادماً',
}

export function OverviewView({ overview }: { overview: OpsOverview }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [notice, setNotice] = useState<string | null>(null)
  const [errorAr, setErrorAr] = useState<string | null>(null)
  const inFlight = useRef(false)

  const runGeneration = () => {
    if (inFlight.current) return
    inFlight.current = true
    setErrorAr(null)
    setNotice(null)
    startTransition(async () => {
      try {
        const result = await runSlotGenerationAction()
        if (!result.ok) setErrorAr(result.errorAr)
        else {
          setNotice(`تم التوليد — أُضيف ${formatCountedAr(result.slotsCreated ?? 0, AR_SLOT)}.`)
          router.refresh()
        }
      } finally {
        inFlight.current = false
      }
    })
  }

  const { cards, alerts, network } = overview
  // The first-day honest zero, per the frame: «لم يصل أول حجز بعد» is a real
  // state with real numbers behind it, not an empty screen.
  const firstDay = cards.bookingsToday === 0 && cards.bookedToday === 0

  return (
    <>
      <AdminHeader
        title="نظرة عامة"
        displayName="مؤسِّس"
        subtitle={`${formatCountedAr(network.activeBranches, AR_ACTIVE_BRANCH)} · ${formatCountedAr(network.openSlots, AR_OPEN_SLOT)}`}
      />

      <main data-testid="admin-overview" className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-4">
          {errorAr !== null ? (
            <p
              role="alert"
              data-testid="overview-error"
              className="rounded-lg px-3.5 py-2.5 text-[12.5px]"
              style={{
                background: resolveTokenCss('warning.bg'),
                color: resolveTokenCss('warning.text'),
              }}
            >
              {errorAr}
            </p>
          ) : null}
          {notice !== null ? (
            <p
              data-testid="overview-notice"
              className="rounded-lg px-3.5 py-2.5 text-[12.5px]"
              style={{
                background: resolveTokenCss('success.bg'),
                color: resolveTokenCss('primary.700'),
              }}
            >
              {notice}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              testId="overview-card-bookings"
              label="حجوزات اليوم"
              value={toArabicDigits(String(cards.bookingsToday))}
            />
            <StatCard
              testId="overview-card-fill"
              label="إشغال الشبكة اليوم"
              // ⚠ ROUNDED. `get_ops_overview` returns the ratio unrounded, so
              // the card read «٥.٦٪» — with a LATIN decimal point between
              // Arabic-Indic digits, since `toArabicDigits` maps digits only.
              // The frames draw whole percentages («٦٢٪», «٧٩٪», «٠٪») and
              // core's own `summarizeDayAllocation` rounds, so this is the one
              // consumer that disagreed with both. Rounding here rather than in
              // the function keeps the stored ratio exact for anything that
              // later wants it.
              value={`${toArabicDigits(String(Math.round(cards.fillPercent)))}٪`}
              sub={`${toArabicDigits(String(cards.bookedToday))} من ${formatCountedAr(cards.capacityToday, AR_SLOT)}`}
            />
            <StatCard
              testId="overview-card-cancellations"
              label="إلغاءات اليوم"
              value={toArabicDigits(String(cards.cancellationsToday))}
            />
            {/* ⚠ «ليست فاتورة». A02's draft computation, and the subline says so
                — a number that looks like a statement and is not one is how a
                partner gets invoiced against the wrong figure. */}
            <StatCard
              testId="overview-card-commission"
              label="عمولة متوقعة — الشهر حتى اليوم"
              value={`${formatPiastersEgpAr(cards.expectedCommissionPiasters)} ج.م`}
              sub="تقدير مبدئي — ليست فاتورة ولا كشف حساب"
            />
          </div>

          <section
            data-testid="overview-attention"
            className="flex flex-col gap-3 rounded-xl border border-ih-neutral-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[15px] font-extrabold text-ih-neutral-800">ما يحتاج انتباهك</h2>
              <span className="text-[11.5px] text-ih-neutral-500">
                تُحدَّث تلقائياً كل ٥ دقائق · لا يمكن تجاهل تنبيه
              </span>
            </div>

            {alerts.length === 0 ? (
              // The honest green: what was CHECKED, per the frame — not an
              // empty div that could equally mean the checks never ran.
              <div data-testid="overview-healthy" className="flex flex-col gap-2">
                <span
                  className="text-[13.5px] font-bold"
                  style={{ color: resolveTokenCss('primary.700') }}
                >
                  ✓ لا شيء يحتاج انتباهك
                </span>
                <ul className="flex flex-col gap-1">
                  {overview.checked.map((item) => (
                    <li key={item} className="text-[12px] text-ih-neutral-600">
                      ✓ {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {alerts.map((alert) => (
                  <AlertRow
                    key={alert.kind}
                    alert={alert}
                    isPending={isPending}
                    onRunGeneration={runGeneration}
                  />
                ))}
              </ul>
            )}
          </section>

          {firstDay ? (
            <p
              data-testid="overview-first-day"
              className="rounded-xl border border-ih-neutral-200 bg-white p-5 text-[13px] leading-[1.7] text-ih-neutral-600 shadow-sm"
            >
              {toArabicDigits(String(network.activeBranches))} فرعاً نشطاً ·{' '}
              {formatCountedAr(network.openSlots, AR_OPEN_SLOT)} — لم يصل أول حجز بعد.
            </p>
          ) : null}
        </div>
      </main>
    </>
  )
}

function AlertRow({
  alert,
  isPending,
  onRunGeneration,
}: {
  alert: OpsAlert
  isPending: boolean
  onRunGeneration: () => void
}) {
  const tone = alert.severity === 'high' ? 'warning' : 'neutral'

  const body = (() => {
    if (alert.kind === 'slot_generation_stale') {
      const hours = hoursSince(alert.lastSuccessAt ?? null)
      return {
        title: 'توليد المواعيد الليلي متوقف',
        detail:
          alert.lastSuccessAt === null || alert.lastSuccessAt === undefined
            ? 'لا يوجد تشغيل ناجح مسجَّل على الإطلاق.'
            : `آخر تشغيل ناجح: ${CAIRO_DATETIME.format(new Date(alert.lastSuccessAt))}${
                hours === null ? '' : ` — قبل ${toArabicDigits(String(hours))} ساعة`
              }. ${toArabicDigits(String(alert.affectedBranches ?? 0))} فرعاً قد ينفد منها المواعيد.`,
        action: (
          <Button
            size="sm"
            variant="destructive"
            data-testid="overview-run-generation"
            disabled={isPending}
            onClick={onRunGeneration}
          >
            شغّل التوليد الآن
          </Button>
        ),
      }
    }
    if (alert.kind === 'branch_no_bookable_slots_today') {
      return {
        title: `${toArabicDigits(String(alert.branches?.length ?? 0))} فرعاً ظاهراً للمرضى بلا موعد متاح اليوم`,
        detail: (alert.branches ?? [])
          .slice(0, 4)
          .map((b) => b.branchNameAr)
          .join(' · '),
        action: (
          <Link
            href="/admin/providers"
            data-testid="overview-link-providers"
            className="whitespace-nowrap rounded-lg border border-ih-neutral-300 px-3 py-2 text-[12.5px] font-bold text-ih-primary-600"
          >
            افتح المزودين والفروع
          </Link>
        ),
      }
    }
    return {
      title: formatCountedAr(alert.branches?.length ?? 0, AR_UNSTAFFED_BRANCH),
      detail: `${(alert.branches ?? [])
        .slice(0, 4)
        .map((b) => b.branchNameAr)
        .join(' · ')} — الحجوزات تصل ولا أحد يفتح البوابة (${formatCountedAr(
        (alert.branches ?? []).reduce((sum, b) => sum + (b.upcomingBookings ?? 0), 0),
        AR_UPCOMING_BOOKING,
      )} بلا متابعة).`,
      action: (
        <Link
          href="/admin/staff"
          data-testid="overview-link-staff"
          className="whitespace-nowrap rounded-lg border border-ih-neutral-300 px-3 py-2 text-[12.5px] font-bold text-ih-primary-600"
        >
          افتح حسابات المزودين
        </Link>
      ),
    }
  })()

  return (
    <li
      data-testid={`overview-alert-${alert.kind}`}
      className="flex flex-wrap items-center gap-3 rounded-lg px-3.5 py-3"
      style={{
        background: resolveTokenCss(tone === 'warning' ? 'warning.bg' : 'neutral.100'),
        border: `1px solid ${resolveTokenCss(tone === 'warning' ? 'warning.border' : 'neutral.200')}`,
      }}
    >
      <div className="flex min-w-[240px] flex-1 flex-col gap-0.5">
        <span
          className="text-[13px] font-bold"
          style={{
            color: resolveTokenCss(tone === 'warning' ? 'warning.text' : 'neutral.700'),
          }}
        >
          {body.title}
        </span>
        <span className="text-[12px] leading-[1.6] text-ih-neutral-600">{body.detail}</span>
      </div>
      {body.action}
    </li>
  )
}
