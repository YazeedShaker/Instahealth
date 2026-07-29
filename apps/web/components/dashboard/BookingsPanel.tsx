'use client'

import type { BookingOutcome, BranchBooking } from '@instahealth/core'
import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { BOOKINGS_GRID_READ_ONLY, BOOKINGS_GRID_WITH_ACTIONS, BookingRow } from './BookingRow'
import { BookingDrawer } from './BookingDrawer'
import { CancelOnBehalfDialog } from './CancelOnBehalfDialog'

// The list + drawer + confirm, shared verbatim by Today and Upcoming Days.
// SPEC-P02's consistency rule is only true if this is ONE component: the two
// screens differ in their header and their date, not in how a booking behaves.

export function BookingsPanel({
  bookings,
  cairoTodayIso,
  isoDate,
  serviceDurationMinutes,
  newIds,
  pendingIds,
  nowHHMM,
  emptyState,
  onMark,
  onCancel,
}: {
  bookings: BranchBooking[]
  cairoTodayIso: string
  isoDate: string
  serviceDurationMinutes: number | null
  newIds: ReadonlySet<string>
  pendingIds: ReadonlySet<string>
  nowHHMM: string
  emptyState: ReactNode
  onMark: (bookingId: string, outcome: BookingOutcome) => void
  onCancel: (bookingId: string, reasonAr: string) => Promise<boolean>
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false)

  // Outcome actions exist only for a day that has actually arrived. Derived
  // from the dates, never from which screen we are on — `mark_booking_outcome`
  // enforces the identical rule and returns `slot_in_future` otherwise.
  const showActions = isoDate <= cairoTodayIso

  // The row this drawer belongs to is re-read from the LIVE list every render,
  // so a realtime update behind the drawer flows straight into it. When the
  // booking disappears from the day entirely, the drawer closes itself rather
  // than sitting there with stale actions.
  const openBooking = bookings.find((booking) => booking.id === openId) ?? null

  useEffect(() => {
    if (openId !== null && openBooking === null) {
      setOpenId(null)
      setIsConfirmingCancel(false)
    }
  }, [openId, openBooking])

  const closeDrawer = useCallback(() => {
    setOpenId(null)
    setIsConfirmingCancel(false)
  }, [])

  const handleConfirmCancel = useCallback(
    async (reasonAr: string) => {
      if (openBooking === null) return
      const ok = await onCancel(openBooking.id, reasonAr)
      setIsConfirmingCancel(false)
      // On success the booking is now cancelled, not gone — the desk must still
      // see it. Keep the drawer open so they can read the outcome they just
      // caused, rather than having the panel vanish under them.
      if (!ok) return
    },
    [openBooking, onCancel],
  )

  if (bookings.length === 0) return <>{emptyState}</>

  return (
    <>
      <Card padding={0} style={{ overflow: 'hidden' }} testId="bookings-card">
        <div
          data-print="head"
          className={`${
            showActions ? BOOKINGS_GRID_WITH_ACTIONS : BOOKINGS_GRID_READ_ONLY
          } border-b border-ih-neutral-200 bg-ih-neutral-50 px-4 py-2.5 text-[11.5px] font-bold text-ih-neutral-500`}
        >
          <div>الموعد</div>
          <div>المريض</div>
          <div>الخدمات</div>
          <div>الدفع</div>
          <div>الحالة</div>
          {showActions ? <div>الإجراء</div> : null}
          <div />
        </div>
        <div data-testid="bookings-list">
          {bookings.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              cairoTodayIso={cairoTodayIso}
              showActions={showActions}
              isNew={newIds.has(booking.id)}
              isPast={showActions && booking.slotTime.slice(0, 5) < nowHHMM}
              isPending={pendingIds.has(booking.id)}
              isSelected={booking.id === openId}
              onMark={onMark}
              onOpen={setOpenId}
            />
          ))}
        </div>
      </Card>

      {openBooking !== null ? (
        <>
          <BookingDrawer
            booking={openBooking}
            cairoTodayIso={cairoTodayIso}
            serviceDurationMinutes={serviceDurationMinutes}
            isPending={pendingIds.has(openBooking.id)}
            onMark={onMark}
            onRequestCancel={() => setIsConfirmingCancel(true)}
            onClose={closeDrawer}
          />
          {isConfirmingCancel ? (
            <CancelOnBehalfDialog
              booking={openBooking}
              isPending={pendingIds.has(openBooking.id)}
              onConfirm={(reasonAr) => void handleConfirmCancel(reasonAr)}
              onDismiss={() => setIsConfirmingCancel(false)}
            />
          ) : null}
        </>
      ) : null}
    </>
  )
}

/** The shared "we could not load this day" panel — a retry, never a blank. */
export function BookingsLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-ih-neutral-200 bg-white p-10 text-center">
      <div className="text-sm text-ih-neutral-700">
        تعذّر تحميل الحجوزات — تحقق من الاتصال وحاول مرة أخرى.
      </div>
      <Button variant="outline" data-testid="bookings-retry" onClick={onRetry}>
        إعادة المحاولة
      </Button>
    </div>
  )
}
