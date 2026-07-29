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

import { Button } from '../ui/Button'
import { StatusBadge } from '../ui/StatusBadge'

// One row of the Today list. The column grid matches the approved design:
// الموعد · المريض · الخدمات · الدفع · الحالة · الإجراء
const GRID = 'grid grid-cols-[90px_200px_1fr_150px_118px_180px_44px] items-center gap-3'

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
      data-print="row"
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

      {/* Name ABOVE phone, per the design. Written as explicit inline styles:
          the cell is a grid child, and relying on utility classes here is what
          let the two collapse onto one line. `alignItems: flex-start` keeps the
          dir="ltr" phone anchored to the row's start edge under RTL. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 1,
          minWidth: 0,
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--ih-neutral-800)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
          }}
        >
          {booking.patientNameAr ?? 'مريض'}
        </span>
        {booking.patientPhone !== null ? (
          <a
            href={`tel:${booking.patientPhone}`}
            dir="ltr"
            style={{
              display: 'block',
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--ih-primary-600)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
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
        <StatusBadge status={booking.status} testId={`status-chip-${booking.id}`} />
      </div>

      <div className="flex gap-1.5" data-print="hide">
        {action !== null ? (
          <Button
            size="sm"
            variant="primary"
            data-testid={`action-${action.outcome}-${booking.id}`}
            disabled={isPending}
            onClick={() => onMark(booking.id, action.outcome)}
          >
            {action.labelAr}
          </Button>
        ) : null}
        {showNoShow ? (
          <Button
            size="sm"
            variant="ghost"
            data-testid={`action-no_show-${booking.id}`}
            disabled={isPending}
            onClick={() => onMark(booking.id, 'no_show')}
            style={{ color: 'var(--ih-neutral-600)' }}
          >
            لم يحضر
          </Button>
        ) : null}
        {action === null && !showNoShow ? (
          <span className="text-[12.5px] text-ih-neutral-400">—</span>
        ) : null}
      </div>

      {/* Row overflow — the drawer it opens is P02, so it is present and
          visibly inert rather than missing from the layout. */}
      <div
        data-print="hide"
        aria-label="خيارات أخرى"
        title="قريباً"
        className="flex h-11 w-11 items-center justify-center rounded-lg text-base text-ih-neutral-400"
      >
        ⋯
      </div>
    </div>
  )
}
