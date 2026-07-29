import { beforeEach, describe, expect, it, vi } from 'vitest'

import { handleHoldExpired } from './expiry'
import { useBookingStore } from './store'

// The api module talks to Supabase; the teardown contract is what matters here.
vi.mock('./api', () => ({
  cancelPendingBooking: vi.fn(() => Promise.resolve()),
  releaseHold: vi.fn(() => Promise.resolve()),
}))

const { cancelPendingBooking } = await import('./api')

const HOLD = {
  holdId: 'hold-1',
  slotId: 'slot-1',
  slotDate: '2026-08-01',
  slotTime: '09:00:00',
  expiresAt: '2026-08-01T09:00:00Z',
}
const PENDING = { id: 'booking-1', bookingRef: 'IH-2026-00001', slotId: 'slot-1', totalEgp: 150 }

describe('handleHoldExpired', () => {
  beforeEach(() => {
    useBookingStore.getState().reset()
    vi.mocked(cancelPendingBooking).mockClear()
  })

  it('clears the dead hold and raises the expiry flag', () => {
    useBookingStore.getState().setHold(HOLD)
    handleHoldExpired()
    const state = useBookingStore.getState()
    expect(state.hold).toBeNull()
    expect(state.holdExpired).toBe(true)
  })

  it('cancels the stale pending booking so no orphan row is left behind', () => {
    useBookingStore.getState().setHold(HOLD)
    useBookingStore.getState().setPendingBooking(PENDING)
    handleHoldExpired()
    expect(useBookingStore.getState().pendingBooking).toBeNull()
    expect(cancelPendingBooking).toHaveBeenCalledWith('booking-1', 'hold_expired')
  })

  it('keeps the F04 selection — the patient re-picks a slot, not services', () => {
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    useBookingStore.getState().setHold(HOLD)
    handleHoldExpired()
    expect(useBookingStore.getState().branchId).toBe('branch-1')
  })

  it('is idempotent — a second call cancels nothing again', () => {
    useBookingStore.getState().setHold(HOLD)
    useBookingStore.getState().setPendingBooking(PENDING)
    handleHoldExpired()
    handleHoldExpired()
    expect(cancelPendingBooking).toHaveBeenCalledTimes(1)
  })

  it('still raises the flag when there is nothing left to tear down', () => {
    handleHoldExpired()
    expect(useBookingStore.getState().holdExpired).toBe(true)
    expect(cancelPendingBooking).not.toHaveBeenCalled()
  })
})

describe('successful-confirmation reset (the F05→F06 landmine)', () => {
  beforeEach(() => {
    useBookingStore.getState().reset()
  })

  // If ANY flow state survives the navigation out of /booking, the segments
  // watcher in (app)/_layout runs cleanupFlow and CANCELS the booking that was
  // just confirmed. payment.tsx calls reset() before router.replace for exactly
  // this reason — this test is the regression guard.
  it('reset() leaves no hold or pending booking for the exit watcher to cancel', () => {
    useBookingStore.getState().openBranch('branch-1', 'ساريدار — الدقي')
    useBookingStore.getState().setHold(HOLD)
    useBookingStore.getState().setPendingBooking(PENDING)
    useBookingStore.getState().setNotes('أفضّل الصباح')

    useBookingStore.getState().reset()

    const state = useBookingStore.getState()
    expect(state.hold).toBeNull()
    expect(state.pendingBooking).toBeNull()
    expect(state.holdExpired).toBe(false)
    expect(state.notes).toBe('')
    expect(state.selectedServices).toEqual([])
  })
})
