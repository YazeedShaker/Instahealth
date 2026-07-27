import type { BookingConfirmation } from '@instahealth/core'
import { create } from 'zustand'

/**
 * The confirmed booking, held SEPARATELY from the booking store.
 *
 * Why its own store: on a successful settle the booking store is reset —
 * hold and pendingBooking MUST be cleared before we navigate out of
 * `/booking`, or the segments watcher in `(app)/_layout` sees lingering flow
 * state, runs `cleanupFlow`, and cancels the booking we just confirmed. The
 * confirmation therefore cannot live in the store that gets wiped.
 *
 * The payload comes from `settle-payment` (server-built) rather than a
 * re-query: once `booked_count` hits `capacity`, the patient's own RLS SELECT
 * policy on `slots` hides the row, so the client cannot read back the slot it
 * just booked.
 */
interface ConfirmationStore {
  confirmation: BookingConfirmation | null
  setConfirmation: (confirmation: BookingConfirmation) => void
  clearConfirmation: () => void
}

export const useConfirmationStore = create<ConfirmationStore>((set) => ({
  confirmation: null,
  setConfirmation: (confirmation) => set({ confirmation }),
  clearConfirmation: () => set({ confirmation: null }),
}))
