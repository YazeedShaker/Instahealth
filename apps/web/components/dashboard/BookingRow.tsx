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

// One row of the bookings list. The column grid matches the approved design:
// الموعد · المريض · الخدمات · الدفع · الحالة · الإجراء
//
// ONE row component serves Today AND Upcoming Days (SPEC-P02: "literally the
// same component, parameterized by date"). The action column collapses on a
// future day because `getPrimaryOutcomeAction` is date-aware — not because the
// screen decided to hide it, which is what would let the two views drift.
// Today carries the الإجراء column; the Upcoming Days design drops it and ends
// the row with a ‹ detail chevron instead, because a future day has no outcome
// to record. Two layouts, ONE component — and the behaviour is still governed
// by the date predicate below, not by which grid was chosen.
/**
 * The "saving…" state of an outcome button.
 *
 * The LABEL IS KEPT, deliberately: the button must not change width or wording
 * mid-click, or the desk loses track of what it just pressed. The spinner is
 * added beside it, and `aria-busy` on the button carries the same fact to a
 * screen reader. Motion is dropped under `prefers-reduced-motion` (globals.css).
 */
function PendingDots({ labelAr }: { labelAr: string }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="ih-button-spinner" aria-hidden="true" />
      {labelAr}
    </span>
  )
}

export const BOOKINGS_GRID_WITH_ACTIONS =
  'grid grid-cols-[90px_200px_1fr_150px_118px_180px_44px] items-center gap-3'
export const BOOKINGS_GRID_READ_ONLY =
  'grid grid-cols-[90px_200px_1fr_150px_118px_44px] items-center gap-3'

export function BookingRow({
  booking,
  cairoTodayIso,
  showActions,
  isNew,
  isPast,
  isPending,
  isSelected,
  onMark,
  onOpen,
}: {
  booking: BranchBooking
  cairoTodayIso: string
  showActions: boolean
  isNew: boolean
  isPast: boolean
  isPending: boolean
  isSelected: boolean
  onMark: (bookingId: string, outcome: BookingOutcome) => void
  onOpen: (bookingId: string) => void
}) {
  const GRID = showActions ? BOOKINGS_GRID_WITH_ACTIONS : BOOKINGS_GRID_READ_ONLY
  const action = getPrimaryOutcomeAction(booking, cairoTodayIso)
  const showNoShow = canMarkNoShow(booking, cairoTodayIso) && isPast
  const cash = isAwaitingCashCollection(booking)
  const isCancelled = booking.status === 'cancelled'

  return (
    <div
      data-testid={`booking-row-${booking.id}`}
      data-print="row"
      role="button"
      tabIndex={0}
      aria-label={`تفاصيل حجز ${booking.patientNameAr ?? 'مريض'}`}
      onClick={() => onOpen(booking.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onOpen(booking.id)
        }
      }}
      className={`${GRID} min-h-16 cursor-pointer border-b border-ih-neutral-100 px-4 transition-colors`}
      style={{
        // Past rows grey out; a brand-new one carries the cream highlight and
        // the primary edge, both from the design's legend. The row whose
        // drawer is open takes the primary tint, as the design draws it.
        background: isSelected
          ? 'var(--ih-primary-50)'
          : isNew
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
            // The row opens the drawer; the phone link must place a call and
            // nothing else.
            onClick={(event) => event.stopPropagation()}
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

      {/* ⚠ These buttons stay DISABLED for the whole write-then-confirm cycle,
          not just the write. The status they are derived from is server-confirmed
          truth now — no optimistic flip — so a row cannot briefly offer an action
          that the next response contradicts. That window is what let a click on
          «تمت الخدمة» send `arrived` a second time and lose the completion
          silently (see useBranchBookings). `data-pending` gives the E2E a way to
          observe the cycle rather than time it. */}
      {showActions ? (
        <div className="flex gap-1.5" data-print="hide" data-pending={isPending ? 'yes' : 'no'}>
          {action !== null ? (
            <Button
              size="sm"
              variant="primary"
              data-testid={`action-${action.outcome}-${booking.id}`}
              disabled={isPending}
              aria-busy={isPending}
              onClick={(event) => {
                event.stopPropagation()
                onMark(booking.id, action.outcome)
              }}
            >
              {isPending ? <PendingDots labelAr={action.labelAr} /> : action.labelAr}
            </Button>
          ) : null}
          {showNoShow ? (
            <Button
              size="sm"
              variant="ghost"
              data-testid={`action-no_show-${booking.id}`}
              disabled={isPending}
              aria-busy={isPending}
              onClick={(event) => {
                event.stopPropagation()
                onMark(booking.id, 'no_show')
              }}
              style={{ color: 'var(--ih-neutral-600)' }}
            >
              {isPending ? <PendingDots labelAr="لم يحضر" /> : 'لم يحضر'}
            </Button>
          ) : null}
          {action === null && !showNoShow ? (
            <span className="text-[12.5px] text-ih-neutral-400">—</span>
          ) : null}
        </div>
      ) : null}

      {/* The detail affordance. The whole row is the click target, so this is
          a visual cue rather than a second control — a nested <button> inside
          a role="button" row would be two overlapping controls to a screen
          reader (the same trap as nested Pressables on mobile). */}
      <div
        data-print="hide"
        aria-hidden="true"
        className="flex h-11 w-11 items-center justify-center rounded-lg text-base text-ih-neutral-400"
      >
        {showActions ? '⋯' : '‹'}
      </div>
    </div>
  )
}
