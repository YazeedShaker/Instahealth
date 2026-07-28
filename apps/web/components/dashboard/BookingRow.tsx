'use client'

import {
  canMarkNoShow,
  formatTimeShortAr,
  getPrimaryOutcomeAction,
  isAwaitingCashCollection,
  isolateLtr,
  requiresPreparation,
  summarizeBookingServicesAr,
  toArabicDigits,
  type BookingOutcome,
  type BranchBooking,
} from '@instahealth/core'

import { StatusChip } from './StatusChip'

// One row of the Today list. The column grid matches the approved design:
// الموعد · المريض · الخدمات · الدفع · الحالة · الإجراء
const GRID = 'grid grid-cols-[90px_200px_1fr_150px_118px_180px] items-center gap-3'

export function BookingRow({
  booking,
  isNew,
  isPast,
  isPending,
  onMark,
}: {
  booking: BranchBooking
  isNew: boolean
  isPast: boolean
  isPending: boolean
  onMark: (bookingId: string, outcome: BookingOutcome) => void
}) {
  const action = getPrimaryOutcomeAction(booking)
  const showNoShow = canMarkNoShow(booking) && isPast
  const cash = isAwaitingCashCollection(booking)
  const isCancelled = booking.status === 'cancelled'

  return (
    <div
      data-testid={`booking-row-${booking.id}`}
      className={`${GRID} min-h-16 border-b border-ih-neutral-100 px-4 transition-colors`}
      style={{
        // Past rows grey out; a brand-new one carries the cream highlight and
        // the primary edge, both from the design's legend.
        background: isNew
          ? 'var(--ih-accent-200)'
          : isPast && booking.status !== 'arrived'
            ? 'var(--ih-neutral-50)'
            : 'var(--ih-neutral-0)',
        borderInlineStartWidth: 3,
        borderInlineStartStyle: 'solid',
        borderInlineStartColor: isNew ? 'var(--ih-primary-400)' : 'transparent',
        opacity: isCancelled ? 0.6 : 1,
      }}
    >
      <div
        className="font-arabic text-[17px] font-extrabold"
        style={{
          unicodeBidi: 'isolate',
          color: isPast ? 'var(--ih-neutral-400)' : 'var(--ih-neutral-800)',
        }}
      >
        {formatTimeShortAr(booking.slotTime)}
      </div>

      <div className="flex min-w-0 flex-col gap-px">
        <div className="truncate text-sm font-semibold text-ih-neutral-800">
          {booking.patientNameAr ?? 'مريض'}
        </div>
        {booking.patientPhone !== null ? (
          <a
            href={`tel:${booking.patientPhone}`}
            dir="ltr"
            className="text-[12.5px] font-semibold text-ih-primary-600 hover:text-ih-primary-700"
            style={{ textAlign: 'start' }}
          >
            {booking.patientPhone}
          </a>
        ) : null}
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[13.5px] text-ih-neutral-700">
          {summarizeBookingServicesAr(booking.services)}
        </span>
        {/* Empty means absent: no preparation → no indicator at all. */}
        {requiresPreparation(booking) ? (
          <span
            data-testid={`prep-${booking.id}`}
            className="shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-bold"
            style={{
              color: 'var(--ih-primary-800)',
              background: 'var(--ih-accent-200)',
              borderColor: 'var(--ih-accent-400)',
            }}
          >
            ⚠ تحضير
          </span>
        ) : null}
      </div>

      {/* The money column. A cash row is loud on purpose — it is cash the desk
          has to physically collect. */}
      <div data-testid={`payment-${booking.id}`} data-cash={cash ? 'yes' : 'no'}>
        {cash ? (
          <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[12.5px] font-extrabold"
            style={{
              color: 'var(--ih-primary-800)',
              background: 'var(--ih-accent-200)',
              borderColor: 'var(--ih-accent-400)',
            }}
          >
            💵 يدفع هنا{' '}
            <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>
              {toArabicDigits(String(booking.totalEgp))} EGP
            </span>
          </span>
        ) : (
          <span className="whitespace-nowrap text-[12.5px] font-semibold text-ih-neutral-500">
            ✓ تم الدفع{' '}
            <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>
              {isolateLtr(`${toArabicDigits(String(booking.totalEgp))} EGP`)}
            </span>
          </span>
        )}
      </div>

      <div>
        <StatusChip booking={booking} />
      </div>

      <div className="flex gap-1.5">
        {action !== null ? (
          <button
            type="button"
            data-testid={`action-${action.outcome}-${booking.id}`}
            disabled={isPending}
            onClick={() => onMark(booking.id, action.outcome)}
            className="h-9 whitespace-nowrap rounded-lg bg-ih-primary-400 px-3 text-[13px] font-semibold text-white transition-opacity disabled:opacity-45"
          >
            {action.labelAr}
          </button>
        ) : null}
        {showNoShow ? (
          <button
            type="button"
            data-testid={`action-no_show-${booking.id}`}
            disabled={isPending}
            onClick={() => onMark(booking.id, 'no_show')}
            className="h-9 whitespace-nowrap rounded-lg px-3 text-[13px] font-semibold text-ih-neutral-600 transition-colors hover:bg-ih-neutral-100 disabled:opacity-45"
          >
            لم يحضر
          </button>
        ) : null}
        {action === null && !showNoShow ? (
          <span className="text-[12.5px] text-ih-neutral-400">—</span>
        ) : null}
      </div>
    </div>
  )
}
