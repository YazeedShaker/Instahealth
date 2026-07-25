import { describe, expect, test } from 'vitest'

import { HOLD_WARNING_SECONDS, SLOT_HOLD_MINUTES } from '../constants'
import {
  formatHoldCountdown,
  getHoldChipState,
  getRemainingHoldSeconds,
  getSlotStatus,
  holdExpiresAt,
  isHoldExpiringSoon,
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
