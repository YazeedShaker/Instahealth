import { logAuthErrorDev } from './errors'
import { useAuthStore } from './store'
import { releaseAllHolds } from '../booking/api'
import { useBookingStore } from '../booking/store'
import { supabase } from '../../lib/supabase'

// THE logout. Single home (SPEC-PROF-01: no orphaned logout elsewhere) — the
// profile screen's button and any future caller go through this one function.
export async function performLogout(): Promise<void> {
  useAuthStore.getState().markManualSignOut()
  // Release any active slot holds BEFORE the session clears — after signOut
  // the RLS delete-own path is gone and the hold would block its slot for up
  // to 10 minutes. Best-effort: server-side expiry is the safety net.
  const userId = useAuthStore.getState().session?.user.id
  if (userId !== undefined) {
    await releaseAllHolds(userId)
  }
  useBookingStore.getState().reset()
  try {
    await supabase.auth.signOut()
  } catch (error) {
    logAuthErrorDev('signOut', error)
  }
  useAuthStore.getState().reset()
}

/** Local teardown AFTER the server already deleted the account: the auth user
 * is gone, so holds/bookings were handled server-side and the server half of
 * signOut would 403 — clear the LOCAL session only. */
export async function performPostDeletionCleanup(): Promise<void> {
  useAuthStore.getState().markManualSignOut()
  useBookingStore.getState().reset()
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch (error) {
    logAuthErrorDev('signOut(local)', error)
  }
  useAuthStore.getState().reset()
}
