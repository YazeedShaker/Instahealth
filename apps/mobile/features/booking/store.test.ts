import type { BranchServiceItem } from '@instahealth/core'
import { beforeEach, describe, expect, it } from 'vitest'

import { useBookingStore } from './store'

function makeService(overrides: Partial<BranchServiceItem> = {}): BranchServiceItem {
  return {
    id: 'svc-1',
    branchServiceId: 'bs-1',
    nameAr: 'صورة دم كاملة',
    nameEn: 'CBC',
    priceEgp: 150,
    preparationNotesAr: null,
    preparationNotesEn: null,
    fastingHours: null,
    categorySlug: 'labs',
    categoryNameAr: 'تحاليل',
    categoryNameEn: 'Labs',
    categoryIcon: '🧪',
    categorySortOrder: 1,
    ...overrides,
  }
}

describe('booking store', () => {
  beforeEach(() => {
    useBookingStore.getState().reset()
  })

  it('starts with no branch and no selection', () => {
    const state = useBookingStore.getState()
    expect(state.branchId).toBeNull()
    expect(state.selectedServices).toEqual([])
  })

  it('toggleService adds then removes the same service', () => {
    const service = makeService()
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    useBookingStore.getState().toggleService(service)
    expect(useBookingStore.getState().selectedServices).toEqual([service])

    useBookingStore.getState().toggleService(service)
    expect(useBookingStore.getState().selectedServices).toEqual([])
  })

  it('keeps selection order as services are added', () => {
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    useBookingStore.getState().toggleService(makeService({ id: 'a' }))
    useBookingStore.getState().toggleService(makeService({ id: 'b' }))
    expect(useBookingStore.getState().selectedServices.map((service) => service.id)).toEqual([
      'a',
      'b',
    ])
  })

  it('removing one service leaves the others selected', () => {
    const first = makeService({ id: 'a' })
    const second = makeService({ id: 'b' })
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    useBookingStore.getState().toggleService(first)
    useBookingStore.getState().toggleService(second)
    useBookingStore.getState().toggleService(first)
    expect(useBookingStore.getState().selectedServices).toEqual([second])
  })

  it('opening a DIFFERENT branch resets the selection', () => {
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    useBookingStore.getState().toggleService(makeService())
    useBookingStore.getState().openBranch('branch-2', 'مستشفى تاون')

    const state = useBookingStore.getState()
    expect(state.branchId).toBe('branch-2')
    expect(state.branchNameAr).toBe('مستشفى تاون')
    expect(state.selectedServices).toEqual([])
  })

  it('re-opening the SAME branch keeps the selection (return within session)', () => {
    const service = makeService()
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    useBookingStore.getState().toggleService(service)
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    expect(useBookingStore.getState().selectedServices).toEqual([service])
  })

  it('clearSelection empties services but keeps the branch', () => {
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    useBookingStore.getState().toggleService(makeService())
    useBookingStore.getState().clearSelection()

    const state = useBookingStore.getState()
    expect(state.branchId).toBe('branch-1')
    expect(state.selectedServices).toEqual([])
  })
})

const HOLD = {
  holdId: 'hold-1',
  slotId: 'slot-1',
  slotDate: '2026-01-20',
  slotTime: '09:30:00',
  expiresAt: '2026-01-20T07:40:00+00:00',
}

describe('booking flow state (F05)', () => {
  beforeEach(() => {
    useBookingStore.getState().reset()
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    useBookingStore.getState().toggleService(makeService())
  })

  it('setHold stores the server hold; clearHold drops it', () => {
    useBookingStore.getState().setHold(HOLD)
    expect(useBookingStore.getState().hold).toEqual(HOLD)

    useBookingStore.getState().clearHold()
    expect(useBookingStore.getState().hold).toBeNull()
  })

  it('re-picking replaces the hold (last RPC wins)', () => {
    useBookingStore.getState().setHold(HOLD)
    useBookingStore.getState().setHold({ ...HOLD, holdId: 'hold-2', slotId: 'slot-2' })
    expect(useBookingStore.getState().hold?.holdId).toBe('hold-2')
  })

  it('pending booking is stored and clearable', () => {
    useBookingStore
      .getState()
      .setPendingBooking({ id: 'bk-1', bookingRef: 'IH-2026-00001', slotId: 'slot-1' })
    expect(useBookingStore.getState().pendingBooking?.id).toBe('bk-1')

    useBookingStore.getState().clearPendingBooking()
    expect(useBookingStore.getState().pendingBooking).toBeNull()
  })

  it('clearFlowState drops hold + booking + notes but KEEPS the selection', () => {
    useBookingStore.getState().setHold(HOLD)
    useBookingStore.getState().setPendingBooking({ id: 'bk-1', bookingRef: null, slotId: 'slot-1' })
    useBookingStore.getState().setNotes('لدي حساسية')
    useBookingStore.getState().clearFlowState()

    const state = useBookingStore.getState()
    expect(state.hold).toBeNull()
    expect(state.pendingBooking).toBeNull()
    expect(state.notes).toBe('')
    expect(state.selectedServices).toHaveLength(1)
    expect(state.branchId).toBe('branch-1')
  })

  it('opening a DIFFERENT branch wipes flow state along with the selection', () => {
    useBookingStore.getState().setHold(HOLD)
    useBookingStore.getState().setNotes('ملاحظة')
    useBookingStore.getState().openBranch('branch-2', 'مستشفى تاون')

    const state = useBookingStore.getState()
    expect(state.hold).toBeNull()
    expect(state.notes).toBe('')
    expect(state.selectedServices).toEqual([])
  })

  it('re-opening the SAME branch keeps hold and notes (return within session)', () => {
    useBookingStore.getState().setHold(HOLD)
    useBookingStore.getState().setNotes('ملاحظة')
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')

    const state = useBookingStore.getState()
    expect(state.hold).toEqual(HOLD)
    expect(state.notes).toBe('ملاحظة')
  })
})

// The confirm → /confirmation hand-off. Clearing the store is what defuses the
// cleanup landmine, but it ALSO empties the two fields the flow guards read —
// so the clear and the stand-down flag must land in ONE update, or the layout
// redirects to /home and the payment screen to /slot while the replace to
// /confirmation is still in flight (device symptom: the next booking opened a
// blank, unclickable flow).
describe('confirmation hand-off (F06)', () => {
  beforeEach(() => {
    useBookingStore.getState().reset()
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    useBookingStore.getState().toggleService(makeService())
    useBookingStore.getState().setHold(HOLD)
    useBookingStore.getState().setPendingBooking({ id: 'bk-1', bookingRef: null, slotId: 'slot-1' })
  })

  it('completeBooking clears the flow state the cleanup watcher acts on', () => {
    useBookingStore.getState().completeBooking()

    const state = useBookingStore.getState()
    expect(state.hold).toBeNull()
    expect(state.pendingBooking).toBeNull()
  })

  it('completeBooking clears the selection AND raises the hand-off flag together', () => {
    useBookingStore.getState().completeBooking()

    const state = useBookingStore.getState()
    // Both guards' inputs are empty — only the flag keeps them from navigating.
    expect(state.selectedServices).toEqual([])
    expect(state.branchId).toBeNull()
    expect(state.confirmedHandoff).toBe(true)
  })

  it('the flag is lowered once the confirmation screen has mounted', () => {
    useBookingStore.getState().completeBooking()
    useBookingStore.getState().clearConfirmedHandoff()
    expect(useBookingStore.getState().confirmedHandoff).toBe(false)
  })

  it('reset does NOT raise the flag — only a confirmed booking does', () => {
    useBookingStore.getState().reset()
    expect(useBookingStore.getState().confirmedHandoff).toBe(false)
  })

  it('the next booking starts with the guards armed again', () => {
    useBookingStore.getState().completeBooking()
    useBookingStore.getState().clearConfirmedHandoff()
    useBookingStore.getState().openBranch('branch-2', 'مستشفى تاون')
    useBookingStore.getState().toggleService(makeService({ id: 'b' }))

    const state = useBookingStore.getState()
    expect(state.confirmedHandoff).toBe(false)
    expect(state.selectedServices).toHaveLength(1)
    expect(state.hold).toBeNull()
  })
})
