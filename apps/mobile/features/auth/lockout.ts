// Client-side OTP attempt lockout — UX, not security (server limits stay
// whatever Supabase enforces). Pure functions, `now` always injected.

export const MAX_OTP_ATTEMPTS = 3
export const OTP_LOCKOUT_MINUTES = 5

const MILLISECONDS_PER_MINUTE = 60_000
const MILLISECONDS_PER_SECOND = 1000

export interface LockoutState {
  failedAttempts: number
  lockedUntil: number | null
}

export const INITIAL_LOCKOUT_STATE: LockoutState = { failedAttempts: 0, lockedUntil: null }

/** Records a failed verification. The 3rd failure starts a 5-minute lock. */
export function recordFailedAttempt(state: LockoutState, now: number): LockoutState {
  const failedAttempts = state.failedAttempts + 1
  if (failedAttempts >= MAX_OTP_ATTEMPTS) {
    return { failedAttempts, lockedUntil: now + OTP_LOCKOUT_MINUTES * MILLISECONDS_PER_MINUTE }
  }
  return { ...state, failedAttempts }
}

export function isLockedOut(state: LockoutState, now: number): boolean {
  return state.lockedUntil !== null && now < state.lockedUntil
}

/** Whole seconds until the lock lifts, clamped at 0. */
export function getRemainingLockSeconds(state: LockoutState, now: number): number {
  if (state.lockedUntil === null) return 0
  const remainingMs = state.lockedUntil - now
  if (remainingMs <= 0) return 0
  return Math.ceil(remainingMs / MILLISECONDS_PER_SECOND)
}

export function resetLockout(): LockoutState {
  return INITIAL_LOCKOUT_STATE
}
