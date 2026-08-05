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

// ⚠ EVERY COLUMN IS minmax(floor, design) — NOT a fixed width.
//
// The design's widths are the CEILING and they hold from ~1150px up, which is
// the desktop contract (DESIGN-02, 1366×768 floor). Below that the columns
// COMPRESS toward their floors instead of overflowing, because the card clips
// (`overflow: hidden`, for its rounded corners) and under RTL the clipped edge
// is the LAST columns — the action button and the chevron. Measured before
// this change: at a 1024px viewport the row needed 870px in a 751px card, so
// **the primary action was cut off and unreachable**. A desk cannot mark a
// patient arrived on a screen that hides the button.
//
// Floors are the narrowest each cell stays readable at: a time («٢:٣٠م»), a
// truncated name over its phone, a status chip, the action label, the chevron.
//
// ⚠ THE SERVICES COLUMN NEEDS A FLOOR TOO — `minmax(0, 1fr)` looks safe and is
// not. Grid fills every non-flexible track toward its MAX before an `fr` track
// gets anything, and at 1024px the other columns' maxima already exceed the
// row, so services resolved to ZERO: its truncating summary vanished and its
// nowrap «⚠ تحضير» chip spilled across the payment column. Caught by looking
// at a screenshot, not by the DOM checks — overlap is invisible to
// scrollWidth (ENGINEERING-WORKFLOW §9: read the capture).
//
// ⚠ THE PAYMENT COLUMN NEVER COMPRESSES — it is a flat 150px. Its cash chip
// («💵 يدفع هنا ٢٥٠ EGP») is `whitespace-nowrap` and measures ~147px, so any
// floor below that CLIPS the amount the desk has to physically collect.
// Measured at 1024px with a compressing payment column: 147px of content in a
// 123px cell. Money the desk must collect is the one thing on this row that
// may never be shortened, so it takes its width first and the flexible columns
// absorb the difference.
// ⚠ THE FLOORS ARE NOT THE WHOLE STORY — a grid item's default `min-width:
// auto` lets its CONTENT push a track past its `minmax()` floor. The action
// button and the payment/status chips are `whitespace-nowrap`, so the row has
// an honest min-content width of ~643px that no floor can talk it out of.
// Measured: lowering these floors by 8px changed the row's width by nothing.
//
// That is the correct outcome rather than a limitation — getting narrower
// would mean shortening an action label or an amount, which is precisely what
// must not happen. So: the flexible columns compress down to ~1150px, and
// below that the scroller in BookingsPanel keeps everything REACHABLE. At
// 911px (the 1366 floor at 150% zoom) the row scrolls by ~5px; nothing hides.
export const BOOKINGS_GRID_WITH_ACTIONS =
  'grid grid-cols-[minmax(52px,90px)_minmax(100px,200px)_minmax(88px,1fr)_150px_minmax(76px,118px)_minmax(124px,180px)_minmax(24px,44px)] items-center gap-3'
export const BOOKINGS_GRID_READ_ONLY =
  'grid grid-cols-[minmax(52px,90px)_minmax(100px,200px)_minmax(88px,1fr)_150px_minmax(76px,118px)_minmax(24px,44px)] items-center gap-3'

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

      {/* `overflow-hidden` belts the floor above: whatever the track resolves
          to, the prep chip is clipped INSIDE this cell rather than drawn over
          the payment column beside it. */}
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
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
        /* ⚠ `flex-wrap`: a row can carry TWO buttons («تمت الخدمة» + «لم
           يحضر»), which together need ~169px — more than the action track
           resolves to on a 1024px screen (measured: 169 in 149, so «لم يحضر»
           was cut in half). An explicit floor in `minmax()` suppresses the
           grid's automatic-minimum growth, so the track does NOT stretch to
           fit; the pair stacks instead. Both actions stay clickable, the row
           just gets taller — compression, never a truncated action. */
        <div
          className="flex flex-wrap gap-1.5"
          data-print="hide"
          data-pending={isPending ? 'yes' : 'no'}
        >
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
