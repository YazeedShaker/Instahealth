import type { BranchServiceItem } from '@instahealth/core'
import { create } from 'zustand'

// The ONE booking store (spec F04): created at branch-profile selection,
// consumed by the booking flow (F05/F06). No selection state in components.
// Selection RESETS when a DIFFERENT branch opens and survives returning to
// the same branch within the session.
interface BookingStore {
  branchId: string | null
  branchNameAr: string | null
  selectedServices: BranchServiceItem[]
  /** Called when the branch profile mounts — keeps the selection for the same
   * branch, wipes it when the patient opened a different one. */
  openBranch: (branchId: string, branchNameAr: string) => void
  toggleService: (service: BranchServiceItem) => void
  clearSelection: () => void
  reset: () => void
}

const INITIAL_STATE = {
  branchId: null,
  branchNameAr: null,
  selectedServices: [] as BranchServiceItem[],
}

export const useBookingStore = create<BookingStore>((set) => ({
  ...INITIAL_STATE,
  openBranch: (branchId, branchNameAr) =>
    set((state) =>
      state.branchId === branchId
        ? { branchNameAr }
        : { branchId, branchNameAr, selectedServices: [] },
    ),
  toggleService: (service) =>
    set((state) => ({
      selectedServices: state.selectedServices.some((selected) => selected.id === service.id)
        ? state.selectedServices.filter((selected) => selected.id !== service.id)
        : [...state.selectedServices, service],
    })),
  clearSelection: () => set({ selectedServices: [] }),
  reset: () => set({ ...INITIAL_STATE }),
}))
