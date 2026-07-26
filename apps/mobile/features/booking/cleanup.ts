import { cancelPendingBooking, releaseHold } from './api'
import { useBookingStore } from './store'

/** Best-effort teardown when the patient leaves the booking flow: release the
 * hold, cancel an abandoned pending booking, keep the F04 selection.
 * Idempotent — no-ops when there is no flow state, so every exit path can
 * call it freely. Failures are fine: server-side expiry is the safety net.
 *
 * DEVICE LESSON: the nested navigator's `blur` event never fired on a real
 * device, so holds leaked for their full 10 minutes after backing out. The
 * authoritative trigger is now the SEGMENTS watcher in (app)/_layout — pure
 * route state, no navigation-event dependency. The blur/unmount hooks in the
 * booking layout remain as backstops only. */
export function cleanupFlow(userId: string | null) {
  const { hold, pendingBooking, clearFlowState } = useBookingStore.getState()
  if (hold === null && pendingBooking === null) return
  if (hold !== null && userId !== null) void releaseHold(hold, userId)
  if (pendingBooking !== null) void cancelPendingBooking(pendingBooking.id, 'left_booking_flow')
  clearFlowState()
}
