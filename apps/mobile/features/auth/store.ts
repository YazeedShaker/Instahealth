import type { Session, UserRow } from '@instahealth/core'
import { create } from 'zustand'

import { INITIAL_LOCKOUT_STATE, type LockoutState } from './lockout'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

// The ONE auth store. No auth state duplicated in component state.
// `pendingPhone` carries the E.164 number between phone → OTP screens in memory —
// deliberately NOT a route param (CLAUDE.md §8: phone numbers never go in URLs).
interface AuthStore {
  status: AuthStatus
  session: Session | null
  profile: UserRow | null
  pendingPhone: string | null
  lastOtpRequestedAt: number | null
  lockout: LockoutState
  /** True when the session ended WITHOUT the user tapping logout (expiry mid-flow). */
  sessionExpired: boolean
  manualSignOut: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: UserRow | null) => void
  setPendingPhone: (phone: string | null) => void
  setLastOtpRequestedAt: (timestamp: number | null) => void
  setLockout: (lockout: LockoutState) => void
  markManualSignOut: () => void
  clearSessionExpired: () => void
  reset: () => void
}

const INITIAL_STATE = {
  status: 'loading' as AuthStatus,
  session: null,
  profile: null,
  pendingPhone: null,
  lastOtpRequestedAt: null,
  lockout: INITIAL_LOCKOUT_STATE,
  sessionExpired: false,
  manualSignOut: false,
}

export const useAuthStore = create<AuthStore>((set) => ({
  ...INITIAL_STATE,
  setSession: (session) =>
    set((state) => ({
      session,
      status: session ? 'signedIn' : 'signedOut',
      profile: session ? state.profile : null,
      sessionExpired: session === null && state.session !== null && !state.manualSignOut,
      manualSignOut: session === null ? false : state.manualSignOut,
    })),
  setProfile: (profile) => set({ profile }),
  setPendingPhone: (pendingPhone) => set({ pendingPhone }),
  setLastOtpRequestedAt: (lastOtpRequestedAt) => set({ lastOtpRequestedAt }),
  setLockout: (lockout) => set({ lockout }),
  markManualSignOut: () => set({ manualSignOut: true }),
  clearSessionExpired: () => set({ sessionExpired: false }),
  reset: () => set({ ...INITIAL_STATE, status: 'signedOut' }),
}))
