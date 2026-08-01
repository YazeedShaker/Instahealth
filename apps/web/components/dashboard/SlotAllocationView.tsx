'use client'

import {
  formatArabicDate,
  formatTimeShortAr,
  getSlotAllocationState,
  summarizeDayAllocation,
  toArabicDigits,
  type SlotAllocationState,
} from '@instahealth/core'
import { useRouter } from 'next/navigation'
import { useCallback, useTransition } from 'react'

import type { AllocationSlotRow } from '../../lib/slots/branch-slots'
import type { BranchDay } from '../../lib/bookings/branch-days'
import { Alert } from '../ui/Alert'
import { DayStrip } from './DayStrip'

// P04 — the branch's daily slot picture, READ-ONLY.
//
// ⚠ THE OWNER SCREEN IN THE DESIGN BUNDLE IS DELIBERATELY NOT BUILT.
// `Provider Dashboard - Slot Allocation.dc.html` ships two screens: a
// receptionist view and an "إدارة الفرع" view with working +/− controls, a
// working-window picker and a save button. SPEC-P04 deletes the second one:
// allocation and the daily window are COMMERCIAL TERMS of the partner
// agreement, so they change after a conversation with InstaHealth, not from a
// dashboard toggle. Spec beats bundle and the bundle gets flagged
// (ENGINEERING-WORKFLOW §1.5) — see DECISION-slot-allocation-ownership.
//
// That also settles P03's open role-tier question: no provider role edits
// allocation, so `provider_users.role` still needs no tiers. Deferred to the
// A-series, where onboarding actually needs them.

const STATE_STYLE: Record<
  SlotAllocationState,
  { bg: string; border: string; time: string; sub: string; opacity: number }
> = {
  booked: {
    bg: 'var(--ih-primary-400)',
    border: 'var(--ih-primary-400)',
    time: '#fff',
    sub: 'rgba(255,255,255,0.85)',
    opacity: 1,
  },
  // Holds are the state only the database can see. They get their own
  // treatment rather than borrowing "booked" — the desk must be able to tell a
  // patient who has committed from one who is still on the payment screen.
  held: {
    bg: 'var(--ih-accent-200)',
    border: 'var(--ih-accent-400)',
    time: 'var(--ih-primary-800)',
    sub: 'var(--ih-primary-700)',
    opacity: 1,
  },
  available: {
    bg: 'var(--ih-neutral-0)',
    border: 'var(--ih-neutral-200)',
    time: 'var(--ih-neutral-800)',
    sub: 'var(--ih-primary-600)',
    opacity: 1,
  },
  past: {
    bg: 'var(--ih-neutral-100)',
    border: 'var(--ih-neutral-100)',
    time: 'var(--ih-neutral-400)',
    sub: 'var(--ih-neutral-400)',
    opacity: 0.7,
  },
  blocked: {
    bg: 'var(--ih-neutral-100)',
    border: 'var(--ih-neutral-300)',
    time: 'var(--ih-neutral-500)',
    sub: 'var(--ih-neutral-500)',
    opacity: 0.85,
  },
}

const STATE_LABEL_AR: Record<SlotAllocationState, string> = {
  booked: 'محجوز',
  held: 'قيد الحجز',
  available: 'متاح',
  past: 'لم يُحجز',
  blocked: 'موقوف',
}

function LegendSwatch({ bg, border, label }: { bg: string; border: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: bg,
          border: `1.5px solid ${border}`,
          display: 'inline-block',
        }}
      />
      {label}
    </span>
  )
}

export function SlotAllocationView({
  branchNameAr,
  slotAllocation,
  slotDurationMinutes,
  isoDate,
  cairoTodayIso,
  tomorrowIso,
  cairoNowHHMM,
  days,
  slots,
  loadFailed,
}: {
  branchNameAr: string
  slotAllocation: number
  slotDurationMinutes: number | null
  isoDate: string
  cairoTodayIso: string
  tomorrowIso: string
  cairoNowHHMM: string
  days: BranchDay[]
  slots: AllocationSlotRow[]
  loadFailed: boolean
}) {
  const router = useRouter()
  const [isSwitching, startTransition] = useTransition()

  const selectDay = useCallback(
    (nextIso: string) => {
      startTransition(() => router.push(`/dashboard/slots?date=${nextIso}`))
    },
    [router],
  )

  const summary = summarizeDayAllocation(slots)
  const dateLabel = formatArabicDate(new Date(`${isoDate}T12:00:00Z`))
  const now = { cairoTodayIso, cairoNowHHMM }

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
            المواعيد المتاحة
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ih-neutral-500)' }}>
            {branchNameAr} · {dateLabel}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <span
          data-testid="read-only-pill"
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--ih-neutral-600)',
            background: 'var(--ih-neutral-50)',
            border: '1px solid var(--ih-neutral-200)',
            borderRadius: 999,
            padding: '6px 12px',
            whiteSpace: 'nowrap',
          }}
        >
          🔒 للعرض فقط — التعديل من إنستاهيلث
        </span>
      </header>

      <div style={{ flexShrink: 0, padding: '12px 24px 0' }}>
        {/* Same strip as Upcoming Days — one date switcher, not two. Here the
            window STARTS today, because this screen is about the branch's
            allocation for a day, and today's is the one the desk cares about
            most. `isSwitching` only dims it: the navigation is a route push,
            so the loading.tsx skeleton covers the actual wait. */}
        <div style={{ opacity: isSwitching ? 0.6 : 1, transition: 'opacity 120ms' }}>
          <DayStrip
            days={days}
            selectedIso={isoDate}
            tomorrowIso={tomorrowIso}
            onSelect={selectDay}
          />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          padding: '16px 24px 24px',
          display: 'flex',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        {/* ── the grid ───────────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--ih-neutral-0)',
            border: '1px solid var(--ih-neutral-200)',
            borderRadius: 12,
            boxShadow: 'var(--ih-shadow-sm)',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ih-neutral-800)' }}>
              {isoDate === cairoTodayIso ? 'مواعيد اليوم' : 'مواعيد هذا اليوم'}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 16,
                fontSize: 11.5,
                color: 'var(--ih-neutral-500)',
                flexWrap: 'wrap',
              }}
            >
              <LegendSwatch
                bg={STATE_STYLE.booked.bg}
                border={STATE_STYLE.booked.border}
                label="محجوز"
              />
              <LegendSwatch
                bg={STATE_STYLE.held.bg}
                border={STATE_STYLE.held.border}
                label="قيد الحجز"
              />
              <LegendSwatch
                bg={STATE_STYLE.available.bg}
                border={STATE_STYLE.available.border}
                label="متاح"
              />
              <LegendSwatch bg={STATE_STYLE.past.bg} border={STATE_STYLE.past.border} label="مضى" />
            </div>
          </div>

          {loadFailed ? (
            <Alert type="error" testId="slots-load-error">
              تعذّر تحميل المواعيد. حدّث الصفحة للمحاولة مرة أخرى.
            </Alert>
          ) : slots.length === 0 ? (
            // An ungenerated day is NOT an error and must not read like one:
            // slots are created by a nightly job over a rolling 30-day window,
            // so a far-out day simply has not been generated yet.
            <div
              data-testid="slots-empty"
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                color: 'var(--ih-neutral-500)',
                fontSize: 13,
                lineHeight: 1.8,
              }}
            >
              لا توجد مواعيد لهذا اليوم بعد.
              <br />
              <span style={{ fontSize: 12 }}>
                تُنشأ المواعيد تلقائياً قبل الموعد بثلاثين يوماً.
              </span>
            </div>
          ) : (
            <div
              data-testid="slots-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                gap: 10,
              }}
            >
              {slots.map((slot) => {
                const state = getSlotAllocationState(slot, now)
                const style = STATE_STYLE[state]
                const sub = slot.patientNameAr ?? STATE_LABEL_AR[state]
                return (
                  <div
                    key={slot.id}
                    data-testid={`slot-${slot.id}`}
                    data-state={state}
                    style={{
                      borderRadius: 10,
                      border: `1.5px solid ${style.border}`,
                      background: style.bg,
                      padding: 10,
                      minHeight: 68,
                      boxSizing: 'border-box',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      opacity: style.opacity,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: style.time,
                        unicodeBidi: 'isolate',
                      }}
                    >
                      {formatTimeShortAr(slot.slotTime)}
                    </div>
                    <div
                      title={sub}
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: style.sub,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {sub}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── summary + the gated panel ───────────────────────────────────── */}
        <div
          style={{
            width: 320,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            data-testid="allocation-summary"
            style={{
              background: 'var(--ih-neutral-0)',
              border: '1px solid var(--ih-neutral-200)',
              borderTop: '3px solid var(--ih-primary-400)',
              borderRadius: 12,
              boxShadow: 'var(--ih-shadow-sm)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ih-neutral-500)' }}>
              ملخص اليوم
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span
                data-testid="allocation-fill"
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: 'var(--ih-primary-700)',
                  unicodeBidi: 'isolate',
                }}
              >
                {toArabicDigits(String(summary.booked))}/{toArabicDigits(String(summary.capacity))}
              </span>
              <span style={{ fontSize: 12.5, color: 'var(--ih-neutral-600)' }}>موعد محجوز</span>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: 'var(--ih-neutral-100)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${summary.fillPercent}%`,
                  height: '100%',
                  background: 'var(--ih-primary-400)',
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: 'var(--ih-neutral-600)', lineHeight: 1.6 }}>
              حصة الفرع اليومية {toArabicDigits(String(slotAllocation))} موعد
              {/* ⚠ The duration line DISAPPEARS rather than inventing a number,
                  and it is worded as how long a VISIT takes — not as the gap
                  between slots. Since the capacity rewrite the grid is spaced
                  `opening window ÷ allocation`, so `slot_duration_minutes` no
                  longer describes it (PROGRESS, Known risks). Saying "كل ٣٠
                  دقيقة" over a 120-minute grid would be a confident lie. */}
              {slotDurationMinutes !== null && slotDurationMinutes > 0 ? (
                <> · مدة الزيارة {toArabicDigits(String(slotDurationMinutes))} دقيقة</>
              ) : null}
            </div>
          </div>

          {/* The gated editor. The design draws the real controls behind a lock
              overlay, which is the honest thing: the desk can see what exists
              and who owns it, rather than the feature simply being absent. */}
          <div
            data-testid="allocation-gate"
            style={{
              position: 'relative',
              background: 'var(--ih-neutral-0)',
              border: '1px solid var(--ih-neutral-200)',
              borderRadius: 12,
              boxShadow: 'var(--ih-shadow-sm)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden="true"
              style={{ display: 'flex', flexDirection: 'column', gap: 14, opacity: 0.3 }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ih-neutral-700)' }}>
                إعداد المواعيد
              </div>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--ih-neutral-600)',
                    marginBottom: 6,
                  }}
                >
                  عدد المواعيد في اليوم
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={GHOST_BUTTON}>−</div>
                  <div
                    style={{
                      flex: 1,
                      minHeight: 36,
                      border: '1.5px solid var(--ih-neutral-200)',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--ih-neutral-700)',
                      unicodeBidi: 'isolate',
                    }}
                  >
                    {toArabicDigits(String(slotAllocation))}
                  </div>
                  <div style={GHOST_BUTTON}>+</div>
                </div>
              </div>
              {/* The working-window row is ghosted too. It is not decoration for
                  its own sake: without it the card is short enough that the
                  centred lock overlay PRINTS ON TOP of the controls above —
                  caught by reading the fidelity capture, which is the whole
                  reason §9 exists. It also matches the design, where both
                  settings sit behind the same lock. */}
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--ih-neutral-600)',
                    marginBottom: 6,
                  }}
                >
                  نافذة العمل
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={GHOST_FIELD} />
                  <span style={{ fontSize: 12, color: 'var(--ih-neutral-400)' }}>إلى</span>
                  <div style={GHOST_FIELD} />
                </div>
              </div>
            </div>

            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(246,248,249,0.9)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: 16,
                boxSizing: 'border-box',
                textAlign: 'center',
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: 'var(--ih-neutral-0)',
                  border: '1px solid var(--ih-neutral-200)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                }}
              >
                🔒
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ih-neutral-700)' }}>
                لتعديل عدد المواعيد تواصل مع إنستاهيلث
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--ih-neutral-500)', lineHeight: 1.6 }}>
                حصة المواعيد جزء من اتفاق الشراكة، ونعدّلها معك بعد مراجعة سريعة.
              </div>
              <a
                data-testid="allocation-support"
                href="mailto:partners@instahealth.eg"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--ih-primary-600)',
                  textDecoration: 'underline',
                  unicodeBidi: 'isolate',
                }}
              >
                partners@instahealth.eg
              </a>
            </div>
          </div>

          {/* The explainer SPEC-P04 asks for — what allocation means, when slots
              appear, and the fact that today's unused slots do not roll over. */}
          <div
            data-testid="allocation-explainer"
            style={{
              background: 'var(--ih-neutral-50)',
              border: '1px solid var(--ih-neutral-200)',
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              fontSize: 12,
              color: 'var(--ih-neutral-600)',
              lineHeight: 1.7,
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ih-neutral-700)' }}>
              كيف تعمل المواعيد؟
            </div>
            <div>
              حصة الفرع هي عدد المواعيد المخصّصة لمرضى إنستاهيلث كل يوم — وهي لا تشمل حجوزاتكم
              الأخرى.
            </div>
            <div>تُنشأ مواعيد كل يوم تلقائياً ضمن نافذة ثلاثين يوماً قادمة.</div>
            <div>المواعيد غير المحجوزة اليوم لا تُضاف إلى الغد — تبدأ كل يوم بحصته كاملة.</div>
          </div>
        </div>
      </div>
    </>
  )
}

const GHOST_BUTTON = {
  width: 36,
  height: 36,
  borderRadius: 8,
  border: '1px solid var(--ih-neutral-200)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 16,
  color: 'var(--ih-neutral-400)',
} as const

const GHOST_FIELD = {
  flex: 1,
  minHeight: 36,
  border: '1.5px solid var(--ih-neutral-200)',
  borderRadius: 8,
} as const
