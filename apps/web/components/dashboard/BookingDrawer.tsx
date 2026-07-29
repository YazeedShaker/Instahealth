'use client'

import {
  canCancelOnBehalf,
  canMarkNoShow,
  computePreparationNotes,
  formatArabicDate,
  formatServiceDurationAr,
  formatTimeShortAr,
  getBookingHistory,
  getPrimaryOutcomeAction,
  isAutoClosed,
  isAwaitingCashCollection,
  toArabicDigits,
  toSelectedServices,
  type BookingOutcome,
  type BranchBooking,
} from '@instahealth/core'
import { STATUS_BADGES, STATUS_BADGE_BASE } from '@instahealth/design-tokens'
import { useEffect } from 'react'

import { Button } from '../ui/Button'
import { PreparationNote } from '../ui/PreparationNote'

// The booking-detail drawer from `Provider Dashboard - Booking Detail.dc.html`.
// It is a PANEL, never a navigation: the list stays mounted and live behind it,
// realtime included, which is the whole point of a drawer for a desk that is
// also watching for new arrivals.

const HISTORY_DOT_COLORS: Record<string, string> = {
  primary: 'var(--ih-primary-400)',
  accent: 'var(--ih-accent-400)',
  neutral: 'var(--ih-neutral-300)',
  error: 'var(--ih-error)',
}

const HISTORY_TIME_FORMATTER = new Intl.DateTimeFormat('ar-EG', {
  day: 'numeric',
  month: 'long',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Africa/Cairo',
})

export function BookingDrawer({
  booking,
  cairoTodayIso,
  serviceDurationMinutes,
  isPending,
  onMark,
  onRequestCancel,
  onClose,
}: {
  booking: BranchBooking
  cairoTodayIso: string
  serviceDurationMinutes: number | null
  isPending: boolean
  onMark: (bookingId: string, outcome: BookingOutcome) => void
  onRequestCancel: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const action = getPrimaryOutcomeAction(booking, cairoTodayIso)
  const showNoShow = canMarkNoShow(booking, cairoTodayIso)
  const canCancel = canCancelOnBehalf(booking)
  const cash = isAwaitingCashCollection(booking)
  // The SAME consolidation the patient saw at booking and on their own detail
  // screen — via core's mapper, so the desk and the patient never read
  // different instructions for the same visit.
  const prep = computePreparationNotes(toSelectedServices(booking.services))
  const history = getBookingHistory(booking)
  const dateLabel = formatArabicDate(new Date(`${booking.slotDate}T12:00:00Z`))
  // Empty means absent: a branch with no declared duration shows NO line.
  const durationLabel = formatServiceDurationAr(serviceDurationMinutes)

  return (
    <>
      <div
        data-print="hide"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(2,20,27,0.35)' }}
      />
      <div
        data-testid="booking-drawer"
        data-print="hide"
        role="dialog"
        aria-modal="true"
        aria-label="تفاصيل الحجز"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 440,
          maxWidth: '100%',
          zIndex: 30,
          background: 'var(--ih-neutral-0)',
          borderRadius: '0 16px 16px 0',
          boxShadow: '-18px 0 48px rgba(5,102,141,0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── header ─────────────────────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            background: 'linear-gradient(135deg, var(--ih-primary-700), var(--ih-primary-500))',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
                رقم الحجز
              </div>
              <div
                dir="ltr"
                data-testid="drawer-ref"
                style={{
                  fontFamily: "'Atkinson Hyperlegible', sans-serif",
                  fontSize: 17,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                }}
              >
                {booking.bookingRef ?? '—'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* On the gradient the badge's own tint would vanish, so the
                  design uses a translucent white treatment here. The LABEL
                  still comes from the shared contract — only the surface
                  treatment differs, so the wording can never drift from the
                  pill the row shows. */}
              <span
                data-testid="drawer-status"
                data-status={booking.status}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: STATUS_BADGE_BASE.borderRadius,
                  padding: `${STATUS_BADGE_BASE.paddingY}px ${STATUS_BADGE_BASE.paddingX}px`,
                  fontSize: STATUS_BADGE_BASE.fontSize,
                  fontWeight: STATUS_BADGE_BASE.fontWeight,
                  background: 'rgba(255,255,255,0.18)',
                  color: '#fff',
                  whiteSpace: 'nowrap',
                }}
              >
                {STATUS_BADGES[booking.status].labelAr}
              </span>
              <button
                type="button"
                aria-label="إغلاق"
                data-testid="drawer-close"
                onClick={onClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  border: 'none',
                  background: 'rgba(255,255,255,0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                ✕
              </button>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              borderTop: '1px solid rgba(255,255,255,0.16)',
              paddingTop: 12,
            }}
          >
            <div
              style={{ fontSize: 22, fontWeight: 800, color: '#fff', unicodeBidi: 'isolate' }}
              data-testid="drawer-time"
            >
              {formatTimeShortAr(booking.slotTime)}
            </div>
            <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
              {dateLabel}
              {durationLabel !== null ? (
                <>
                  <br />
                  <span data-testid="drawer-duration">{durationLabel}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* ── body ───────────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            minHeight: 0,
            padding: '14px 20px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* An auto-closed booking says so out loud. A machine's guess must
              never read as a colleague's judgement — the entire reason
              closed_by exists (DECISION-booking-outcome-lifecycle). */}
          {isAutoClosed(booking) ? (
            <div
              data-testid="drawer-auto-closed"
              style={{
                background: 'var(--ih-neutral-100)',
                border: '1px solid var(--ih-neutral-200)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 12.5,
                lineHeight: 1.6,
                color: 'var(--ih-neutral-700)',
              }}
            >
              <strong style={{ fontWeight: 700 }}>أُغلق تلقائياً</strong> — لم يسجّل المكتب نتيجة
              هذا الحجز خلال ٢٤ ساعة من موعده، فأغلقه النظام. لم يُحصَّل أي مبلغ.
            </div>
          ) : null}

          {/* patient */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: 'var(--ih-neutral-50)',
              border: '1px solid var(--ih-neutral-200)',
              borderRadius: 12,
              padding: '10px 12px',
              flexShrink: 0,
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                background: 'var(--ih-primary-50)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--ih-primary-700)',
                flexShrink: 0,
              }}
            >
              {(booking.patientNameAr ?? 'م').trim().charAt(0)}
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 2,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ih-neutral-800)' }}>
                {booking.patientNameAr ?? 'مريض'}
              </div>
              {booking.patientPhone !== null ? (
                <a
                  href={`tel:${booking.patientPhone}`}
                  dir="ltr"
                  data-testid="drawer-phone"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--ih-primary-600)',
                    textDecoration: 'none',
                  }}
                >
                  {booking.patientPhone}
                </a>
              ) : null}
            </div>
            {booking.patientPhone !== null ? (
              <a href={`tel:${booking.patientPhone}`} style={{ textDecoration: 'none' }}>
                <Button size="sm" variant="outline" data-testid="drawer-call">
                  📞 اتصال
                </Button>
              </a>
            ) : null}
          </div>

          {/* payment — the money block */}
          <div
            data-testid="drawer-payment"
            data-cash={cash ? 'yes' : 'no'}
            style={{
              background: cash ? 'var(--ih-accent-200)' : 'var(--ih-neutral-50)',
              border: `1px solid ${cash ? 'var(--ih-accent-400)' : 'var(--ih-neutral-200)'}`,
              borderRadius: 12,
              padding: '11px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0 }} aria-hidden="true">
              {cash ? '💵' : '✓'}
            </span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 800,
                  color: cash ? 'var(--ih-primary-800)' : 'var(--ih-neutral-700)',
                }}
              >
                {cash ? 'يدفع هنا — تحصيل نقدي' : 'تم الدفع مسبقاً'}
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: cash ? 'var(--ih-primary-700)' : 'var(--ih-neutral-500)',
                }}
              >
                {cash ? 'حصّل المبلغ عند وصول المريض' : 'لا حاجة للتحصيل'}
              </div>
            </div>
            <div
              dir="ltr"
              style={{
                fontSize: 19,
                fontWeight: 800,
                color: cash ? 'var(--ih-primary-800)' : 'var(--ih-neutral-700)',
                whiteSpace: 'nowrap',
                unicodeBidi: 'isolate',
              }}
            >
              {toArabicDigits(String(booking.totalEgp))} EGP
            </div>
          </div>

          {/* services */}
          <div
            style={{
              border: '1px solid var(--ih-neutral-200)',
              borderRadius: 12,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--ih-neutral-500)',
                background: 'var(--ih-neutral-50)',
                borderBottom: '1px solid var(--ih-neutral-200)',
              }}
            >
              الخدمات المحجوزة
            </div>
            {booking.services.map((service) => {
              const needsPrep = prep.details.some((detail) =>
                detail.serviceNamesAr.includes(service.nameAr),
              )
              return (
                <div
                  key={service.id}
                  data-testid={`drawer-service-${service.id}`}
                  style={{
                    padding: '11px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    borderBottom: '1px solid var(--ih-neutral-100)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span
                      style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ih-neutral-800)' }}
                    >
                      {service.nameAr}
                    </span>
                    {needsPrep ? (
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: 'var(--ih-primary-800)',
                          background: 'var(--ih-accent-200)',
                          border: '1px solid var(--ih-accent-400)',
                          borderRadius: 999,
                          padding: '1px 8px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ⚠ تحضير
                      </span>
                    ) : null}
                  </div>
                  <span
                    dir="ltr"
                    style={{
                      fontSize: 13.5,
                      fontWeight: 700,
                      color: 'var(--ih-neutral-800)',
                      whiteSpace: 'nowrap',
                      unicodeBidi: 'isolate',
                    }}
                  >
                    {toArabicDigits(String(service.priceEgp))} EGP
                  </span>
                </div>
              )
            })}
            <div
              style={{
                padding: '11px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                background: 'var(--ih-neutral-50)',
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ih-neutral-800)' }}>
                الإجمالي
              </span>
              <span
                dir="ltr"
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--ih-primary-700)',
                  whiteSpace: 'nowrap',
                  unicodeBidi: 'isolate',
                }}
              >
                {toArabicDigits(String(booking.totalEgp))} EGP
              </span>
            </div>
          </div>

          {/* preparation — absent when the selection needs none */}
          {prep.summaryAr !== null ? (
            <div style={{ flexShrink: 0 }}>
              <PreparationNote testId="drawer-prep">{prep.summaryAr}</PreparationNote>
            </div>
          ) : null}

          {/* the patient's own note to the branch */}
          {booking.patientNotes !== null && booking.patientNotes.trim().length > 0 ? (
            <div
              data-testid="drawer-patient-notes"
              style={{
                border: '1px solid var(--ih-neutral-200)',
                borderRadius: 12,
                padding: '11px 14px',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--ih-neutral-500)',
                  marginBottom: 4,
                }}
              >
                ملاحظات المريض
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ih-neutral-700)' }}>
                {booking.patientNotes}
              </div>
            </div>
          ) : null}

          {/* action history */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ih-neutral-500)' }}>
              سجل الإجراءات
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }} data-testid="drawer-history">
              {history.map((entry, index) => (
                <div
                  key={entry.key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '18px 1fr auto',
                    alignItems: 'start',
                    gap: 10,
                    paddingBottom: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      paddingTop: 3,
                    }}
                  >
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: HISTORY_DOT_COLORS[entry.tone],
                      }}
                    />
                    {index < history.length - 1 ? (
                      <span
                        style={{
                          width: 1,
                          flex: 1,
                          minHeight: 14,
                          background: 'var(--ih-neutral-200)',
                        }}
                      />
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ih-neutral-800)' }}>
                      {entry.labelAr}
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--ih-neutral-500)' }}>
                      {entry.byAr}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 11.5,
                      color: 'var(--ih-neutral-500)',
                      whiteSpace: 'nowrap',
                      unicodeBidi: 'isolate',
                    }}
                  >
                    {HISTORY_TIME_FORMATTER.format(new Date(entry.at))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── footer ─────────────────────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid var(--ih-neutral-200)',
            background: 'var(--ih-neutral-0)',
            boxShadow: '0 -4px 12px rgba(5,102,141,0.06)',
            padding: '14px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {action !== null ? (
            <Button
              size="lg"
              fullWidth
              data-testid={`drawer-action-${action.outcome}`}
              disabled={isPending}
              onClick={() => onMark(booking.id, action.outcome)}
            >
              {action.outcome === 'arrived' ? 'تسجيل الوصول — وصل المريض' : action.labelAr}
            </Button>
          ) : null}

          {showNoShow ? (
            <Button
              size="md"
              variant="outline"
              fullWidth
              data-testid="drawer-action-no_show"
              disabled={isPending}
              onClick={() => onMark(booking.id, 'no_show')}
            >
              لم يحضر
            </Button>
          ) : null}

          {canCancel ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 11.5, color: 'var(--ih-neutral-500)' }}>
                إلغاء بالنيابة عن المريض (اتصال هاتفي)
              </span>
              <Button
                size="sm"
                variant="ghost"
                data-testid="drawer-cancel"
                disabled={isPending}
                onClick={onRequestCancel}
                style={{ color: 'var(--ih-error)' }}
              >
                إلغاء الحجز
              </Button>
            </div>
          ) : null}

          {action === null && !showNoShow && !canCancel ? (
            <div
              data-testid="drawer-closed-note"
              style={{ fontSize: 12, color: 'var(--ih-neutral-500)', textAlign: 'center' }}
            >
              هذا الحجز مغلق — لا توجد إجراءات متاحة.
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
