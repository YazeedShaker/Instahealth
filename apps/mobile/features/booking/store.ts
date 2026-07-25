import type { BranchServiceItem } from '@instahealth/core'
import { create } from 'zustand'

// The ONE booking store (F04 selection + F05 flow state). No booking state in
// components. Selection RESETS when a DIFFERENT branch opens and survives
// returning to the same branch within the session; the F05 flow state (hold,
// pending booking, notes) is cleared whenever the patient leaves the flow.

/** The active slot hold as returned by create_slot_hold. `expiresAt` is the
 * SERVER's timestamp — client time is display-only (spec: never trust client
 * time for anything but display). */
export interface ActiveHold {
  holdId: string
  slotId: string
  slotDate: string
  slotTime: string
  expiresAt: string // ISO timestamptz from the RPC
}

/** The pending_payment booking row created at review-confirm. `slotId` lets a
 * re-pick detect that the row went stale (patients cannot UPDATE bookings —
 * stale rows are cancelled and recreated). */
export interface PendingBooking {
  id: string
  bookingRef: string | null
  slotId: string
}

interface BookingStore {
  branchId: string | null
  branchNameAr: string | null
  selectedServices: BranchServiceItem[]
  hold: ActiveHold | null
  pendingBooking: PendingBooking | null
  notes: string
  /** Called when the branch profile mounts — keeps the selection for the same
   * branch, wipes everything (incl. flow state) when a different one opened. */
  openBranch: (branchId: string, branchNameAr: string) => void
  toggleService: (service: BranchServiceItem) => void
  clearSelection: () => void
  setHold: (hold: ActiveHold) => void
  clearHold: () => void
  setPendingBooking: (booking: PendingBooking) => void
  clearPendingBooking: () => void
  setNotes: (notes: string) => void
  /** Leaving the booking flow: drop hold + pending booking + notes but KEEP
   * the selection — back on the branch profile it must still be there. */
  clearFlowState: () => void
  reset: () => void
}

const INITIAL_FLOW_STATE = {
  hold: null as ActiveHold | null,
  pendingBooking: null as PendingBooking | null,
  notes: '',
}

const INITIAL_STATE = {
  branchId: null,
  branchNameAr: null,
  selectedServices: [] as BranchServiceItem[],
  ...INITIAL_FLOW_STATE,
}

export const useBookingStore = create<BookingStore>((set) => ({
  ...INITIAL_STATE,
  openBranch: (branchId, branchNameAr) =>
    set((state) =>
      state.branchId === branchId
        ? { branchNameAr }
        : { branchId, branchNameAr, selectedServices: [], ...INITIAL_FLOW_STATE },
    ),
  toggleService: (service) =>
    set((state) => ({
      selectedServices: state.selectedServices.some((selected) => selected.id === service.id)
        ? state.selectedServices.filter((selected) => selected.id !== service.id)
        : [...state.selectedServices, service],
    })),
  clearSelection: () => set({ selectedServices: [] }),
  setHold: (hold) => set({ hold }),
  clearHold: () => set({ hold: null }),
  setPendingBooking: (pendingBooking) => set({ pendingBooking }),
  clearPendingBooking: () => set({ pendingBooking: null }),
  setNotes: (notes) => set({ notes }),
  clearFlowState: () => set({ ...INITIAL_FLOW_STATE }),
  reset: () => set({ ...INITIAL_STATE }),
}))
