import { describe, expect, test } from 'vitest'

import {
  getRemainingLockSeconds,
  INITIAL_LOCKOUT_STATE,
  isLockedOut,
  MAX_OTP_ATTEMPTS,
  recordFailedAttempt,
  resetLockout,
} from './lockout'

const NOW = 1_700_000_000_000
const FIVE_MINUTES_MS = 5 * 60 * 1000

function failTimes(times: number, now: number) {
  let state = INITIAL_LOCKOUT_STATE
  for (let attempt = 0; attempt < times; attempt += 1) {
    state = recordFailedAttempt(state, now)
  }
  return state
}

describe('lockout', () => {
  test('first two failures do not lock', () => {
    const state = failTimes(MAX_OTP_ATTEMPTS - 1, NOW)
    expect(state.failedAttempts).toBe(2)
    expect(state.lockedUntil).toBeNull()
    expect(isLockedOut(state, NOW)).toBe(false)
  })

  test('third failure locks for exactly 5 minutes', () => {
    const state = failTimes(MAX_OTP_ATTEMPTS, NOW)
    expect(state.lockedUntil).toBe(NOW + FIVE_MINUTES_MS)
    expect(isLockedOut(state, NOW)).toBe(true)
  })

  test('unlocks at exactly 5:00 — not a millisecond early', () => {
    const state = failTimes(MAX_OTP_ATTEMPTS, NOW)
    expect(isLockedOut(state, NOW + FIVE_MINUTES_MS - 1)).toBe(true)
    expect(isLockedOut(state, NOW + FIVE_MINUTES_MS)).toBe(false)
  })

  test('remaining seconds counts down and clamps at 0', () => {
    const state = failTimes(MAX_OTP_ATTEMPTS, NOW)
    expect(getRemainingLockSeconds(state, NOW)).toBe(300)
    expect(getRemainingLockSeconds(state, NOW + 90_000)).toBe(210)
    expect(getRemainingLockSeconds(state, NOW + FIVE_MINUTES_MS + 1000)).toBe(0)
    expect(getRemainingLockSeconds(INITIAL_LOCKOUT_STATE, NOW)).toBe(0)
  })

  test('reset clears attempts and lock', () => {
    const locked = failTimes(MAX_OTP_ATTEMPTS, NOW)
    expect(isLockedOut(locked, NOW)).toBe(true)
    const cleared = resetLockout()
    expect(cleared.failedAttempts).toBe(0)
    expect(isLockedOut(cleared, NOW)).toBe(false)
  })

  test('recordFailedAttempt never mutates its input', () => {
    const before = { ...INITIAL_LOCKOUT_STATE }
    recordFailedAttempt(INITIAL_LOCKOUT_STATE, NOW)
    expect(INITIAL_LOCKOUT_STATE).toEqual(before)
  })
})
