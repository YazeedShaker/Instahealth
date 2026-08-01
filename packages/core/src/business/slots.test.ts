import { describe, expect, test } from 'vitest'

import { HOLD_WARNING_SECONDS, SLOT_HOLD_MINUTES } from '../constants'
import {
  formatHoldCountdown,
  getHoldChipState,
  getRemainingHoldSeconds,
  getSlotAllocationState,
  getSlotStatus,
  holdExpiresAt,
  isHoldExpiringSoon,
  isSlotInThePast,
  summarizeDayAllocation,
  type AllocationSlot,
} from './slots'

describe('getSlotStatus', () => {
  test('available when capacity remains beyond bookings and holds', () => {
    expect(
      getSlotStatus({ capacity: 5, bookedCount: 2, activeHoldCount: 1, isBlocked: false }),
    ).toBe('available')
  })

  test('full when booked + holds reach capacity', () => {
    expect(
      getSlotStatus({ capacity: 5, bookedCount: 3, activeHoldCount: 2, isBlocked: false }),
    ).toBe('full')
  })

  test('full when booked + holds exceed capacity', () => {
    expect(
      getSlotStatus({ capacity: 5, bookedCount: 5, activeHoldCount: 1, isBlocked: false }),
    ).toBe('full')
  })

  test('full when blocked regardless of capacity', () => {
    expect(
      getSlotStatus({ capacity: 5, bookedCount: 0, activeHoldCount: 0, isBlocked: true }),
    ).toBe('full')
  })
})

describe('holdExpiresAt', () => {
  test('adds exactly SLOT_HOLD_MINUTES to creation time', () => {
    const createdAt = new Date('2026-07-23T10:00:00.000Z')
    const expected = new Date(createdAt.getTime() + SLOT_HOLD_MINUTES * 60 * 1000)
    expect(holdExpiresAt(createdAt)).toEqual(expected)
  })
})

describe('getRemainingHoldSeconds', () => {
  const expiresAt = new Date('2026-07-23T10:10:00.000Z')

  test('whole seconds remaining before expiry', () => {
    expect(getRemainingHoldSeconds(expiresAt, new Date('2026-07-23T10:05:00.000Z'))).toBe(300)
  })

  test('exactly at expiry → 0', () => {
    expect(getRemainingHoldSeconds(expiresAt, expiresAt)).toBe(0)
  })

  test('after expiry clamps to 0, never negative', () => {
    expect(getRemainingHoldSeconds(expiresAt, new Date('2026-07-23T10:15:00.000Z'))).toBe(0)
  })

  test('sub-second remainder floors to whole seconds', () => {
    expect(getRemainingHoldSeconds(expiresAt, new Date('2026-07-23T10:09:58.100Z'))).toBe(1)
  })
})

describe('isHoldExpiringSoon', () => {
  test('flips exactly at HOLD_WARNING_SECONDS', () => {
    expect(isHoldExpiringSoon(HOLD_WARNING_SECONDS)).toBe(false)
    expect(isHoldExpiringSoon(HOLD_WARNING_SECONDS - 1)).toBe(true)
  })

  test('true all the way down to 0', () => {
    expect(isHoldExpiringSoon(0)).toBe(true)
  })
})

describe('getHoldChipState', () => {
  test('calm above the warning threshold', () => {
    expect(getHoldChipState(600)).toBe('calm')
    expect(getHoldChipState(HOLD_WARNING_SECONDS)).toBe('calm')
  })

  test('warning strictly under the threshold', () => {
    expect(getHoldChipState(HOLD_WARNING_SECONDS - 1)).toBe('warning')
    expect(getHoldChipState(1)).toBe('warning')
  })

  test('expired at zero and below', () => {
    expect(getHoldChipState(0)).toBe('expired')
    expect(getHoldChipState(-5)).toBe('expired')
  })
})

describe('formatHoldCountdown', () => {
  test('renders zero-padded Arabic-Indic MM:SS', () => {
    expect(formatHoldCountdown(572)).toBe('٠٩:٣٢')
    expect(formatHoldCountdown(60)).toBe('٠١:٠٠')
    expect(formatHoldCountdown(7)).toBe('٠٠:٠٧')
  })

  test('clamps negatives to ٠٠:٠٠', () => {
    expect(formatHoldCountdown(-10)).toBe('٠٠:٠٠')
  })
})

describe('getSlotAllocationState — the P04 grid, derived from the picker predicate', () => {
  const NOW = { cairoTodayIso: '2026-01-20', cairoNowHHMM: '14:00' }
  const slot = (over: Partial<AllocationSlot> = {}): AllocationSlot => ({
    capacity: 1,
    bookedCount: 0,
    activeHoldCount: 0,
    isBlocked: false,
    slotDate: '2026-01-20',
    slotTime: '16:00:00',
    ...over,
  })

  test('a blocked slot is blocked whatever else is true of it', () => {
    expect(getSlotAllocationState(slot({ isBlocked: true, bookedCount: 1 }), NOW)).toBe('blocked')
  })

  test('a slot at capacity by BOOKINGS reads booked', () => {
    expect(getSlotAllocationState(slot({ bookedCount: 1 }), NOW)).toBe('booked')
  })

  test('a slot full only because of live HOLDS reads held, never available', () => {
    // The F05 lesson: the picker refuses this slot, so the dashboard must not
    // advertise it as free. Held is exactly the state the desk cannot see in
    // the raw table, because holds are invisible under RLS.
    expect(getSlotAllocationState(slot({ activeHoldCount: 1 }), NOW)).toBe('held')
    expect(getSlotStatus(slot({ activeHoldCount: 1 }))).toBe('full')
  })

  test('an empty slot whose time has gone by reads past', () => {
    expect(getSlotAllocationState(slot({ slotTime: '09:00:00' }), NOW)).toBe('past')
  })

  test('a BOOKED slot in the past keeps reading booked — it is that patient, not dead time', () => {
    expect(getSlotAllocationState(slot({ slotTime: '09:00:00', bookedCount: 1 }), NOW)).toBe(
      'booked',
    )
  })

  test('a slot later today is available', () => {
    expect(getSlotAllocationState(slot(), NOW)).toBe('available')
  })

  test('a future DATE is never past, whatever the clock says', () => {
    expect(
      getSlotAllocationState(slot({ slotDate: '2026-01-21', slotTime: '09:00:00' }), NOW),
    ).toBe('available')
  })

  test('a past DATE is past even at a late hour', () => {
    expect(
      getSlotAllocationState(slot({ slotDate: '2026-01-19', slotTime: '23:00:00' }), NOW),
    ).toBe('past')
  })

  test('the slot starting exactly now has started', () => {
    expect(isSlotInThePast({ slotDate: '2026-01-20', slotTime: '14:00:00' }, NOW)).toBe(true)
    expect(isSlotInThePast({ slotDate: '2026-01-20', slotTime: '14:01:00' }, NOW)).toBe(false)
  })
})

describe('summarizeDayAllocation — the summary cannot disagree with the grid', () => {
  const row = (bookedCount: number, capacity = 1): AllocationSlot => ({
    capacity,
    bookedCount,
    activeHoldCount: 0,
    isBlocked: false,
    slotDate: '2026-01-20',
    slotTime: '09:00:00',
  })

  test('counts booked against capacity across the day', () => {
    expect(summarizeDayAllocation([row(1), row(1), row(0), row(0), row(0)])).toEqual({
      booked: 2,
      capacity: 5,
      fillPercent: 40,
    })
  })

  test('an ungenerated day is 0/0 and 0% — never NaN', () => {
    expect(summarizeDayAllocation([])).toEqual({ booked: 0, capacity: 0, fillPercent: 0 })
  })

  test('bookings can never exceed the capacity they are drawn against', () => {
    // Defensive: a stale/miscounted row must not render 150%.
    expect(summarizeDayAllocation([row(3, 1)])).toEqual({
      booked: 1,
      capacity: 1,
      fillPercent: 100,
    })
  })
})
