import { cancelPendingBooking } from './api'
import { useBookingStore } from './store'

/**
 * The ONE teardown for "the hold is gone". Two things trigger it and they must
 * behave identically:
 *
 *  1. the flow timer reaching zero (client clock), and
 *  2. `settle-payment` refusing with `hold_expired` (server truth).
 *
 * (2) is the authority — the client clock can drift, the app can be
 * backgrounded, and the server validates the hold on the same predicate the
 * picker displays. Routing both through here means the patient sees the same
 * modal and the same "pick again" path either way, and no stale pending
 * booking is left behind.
 *
 * Idempotent: safe to call when there is nothing to tear down.
 */
export function handleHoldExpired(): void {
  const { hold, pendingBooking, clearHold, clearPendingBooking, setHoldExpired } =
    useBookingStore.getState()
  if (hold !== null) clearHold()
  if (pendingBooking !== null) {
    clearPendingBooking()
    // Best-effort — the row is never confirmed, so a failure costs nothing
    // (server expiry + the 5-min cron are the safety net).
    void cancelPendingBooking(pendingBooking.id, 'hold_expired')
  }
  setHoldExpired(true)
}
