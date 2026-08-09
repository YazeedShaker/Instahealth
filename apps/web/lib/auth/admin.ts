import { createClient } from '../supabase/server'

// Who is signed into the admin panel, and how far in are they allowed?
//
// ⚠ THE GATE HAS FOUR STATES, NOT THREE, AND THE FOURTH IS THE DANGEROUS ONE.
// Proven from Node against the live project during the A01 spike:
//
//   · Supabase access tokens are STATELESS with a 60-minute TTL. Deleting a
//     factor and killing every session does NOT revoke a token already issued
//     — it keeps working, `aal2` claim and all, until it expires.
//   · So after a recovery reset there is a window of up to an hour in which a
//     stale token still SAYS aal2. Trusting the claim alone would hand that
//     window to exactly the attacker the reset exists to evict.
//
// Therefore the gate never trusts the `aal` claim on its own. It pairs it with
// a LIVE read of whether a verified factor exists — `get_admin_auth_state()`
// reads `auth.mfa_factors` inside a SECURITY DEFINER function, because no
// client can see that table. §1.4's law: the screen decides on the same fact
// the server enforces.
//
//   aal1 + factor      → 'needsTotp'      the verify step, nothing else
//   aal1 + NO factor   → 'needsEnrollment' the enrollment screen, nothing else
//   aal2 + factor      → 'ok'             everything
//   aal2 + NO factor   → 'needsEnrollment' a STALE token that outlived a reset
//
// Gating on aal2 alone in the no-factor case BRICKS the account: no factor
// means aal2 is unreachable, and if aal2 is required to enrol, there is no way
// back in ever again.

export interface AdminContext {
  userId: string
  email: string | null
  /** «الإدارة — المؤسس», from admin_users.name. */
  displayName: string
  recoveryCodesRemaining: number
}

export type AdminLookup =
  | { kind: 'ok'; context: AdminContext }
  /** Password done, a verified factor exists — show the TOTP step only. */
  | {
      kind: 'needsTotp'
      context: AdminContext
      lockedUntil: string | null
      attemptsRemaining: number
    }
  /** No verified factor: first login, or the window after a recovery reset. */
  | { kind: 'needsEnrollment'; context: AdminContext }
  /** Temp password from the seed has not been replaced yet. */
  | { kind: 'needsPasswordChange'; context: AdminContext }
  /** Enrolled and at aal2, but a generated batch of recovery codes was never
   * confirmed as saved. See migration 20260808231917 — without this state the
   * post-action revalidation redirects straight past the one-time display. */
  | { kind: 'needsRecoveryCodes'; context: AdminContext }
  /** Signed in, but not an active admin — a patient or provider session. */
  | { kind: 'notAdmin' }
  | { kind: 'signedOut' }

/** Shape of `get_admin_auth_state()`. */
interface AdminAuthState {
  is_admin: boolean
  reason?: string
  name: string | null
  must_change_password: boolean
  recovery_codes_acknowledged: boolean
  has_verified_factor: boolean
  aal: string | null
  is_locked: boolean
  locked_until: string | null
  attempts_remaining: number
  recovery_codes_remaining: number
}

export async function getAdminContext(): Promise<AdminLookup> {
  const supabase = await createClient()

  // getUser(), never getSession() — getUser revalidates the JWT against the
  // auth server, so a forged cookie cannot manufacture an admin session.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { kind: 'signedOut' }

  // ONE round trip answers every question the gate has. Splitting these into
  // separate reads would let them disagree with each other.
  const { data, error } = await supabase.rpc('get_admin_auth_state')
  if (error || !data) return { kind: 'notAdmin' }

  const state = data as unknown as AdminAuthState
  if (!state.is_admin) return { kind: 'notAdmin' }

  const context: AdminContext = {
    userId: user.id,
    email: user.email ?? null,
    displayName: state.name ?? user.email ?? 'الإدارة',
    recoveryCodesRemaining: state.recovery_codes_remaining ?? 0,
  }

  // ORDER MATTERS. The forced password change comes FIRST: the temp password
  // arrived through a seed and an environment variable, so it must stop being
  // the credential before a second factor is bound to the account.
  if (state.must_change_password) return { kind: 'needsPasswordChange', context }

  // No verified factor → enrollment, whatever the aal claim says. This single
  // line is what makes the fourth state safe.
  if (!state.has_verified_factor) return { kind: 'needsEnrollment', context }

  if (state.aal !== 'aal2') {
    return {
      kind: 'needsTotp',
      context,
      lockedUntil: state.is_locked ? state.locked_until : null,
      attemptsRemaining: state.attempts_remaining ?? 0,
    }
  }

  // ⚠ Enrolled, aal2 — but a batch of codes was minted and never confirmed
  // saved. Route back to the enrollment screen, which either shows the codes
  // the client is still holding or admits they are gone and offers a new set.
  if (!state.recovery_codes_acknowledged) return { kind: 'needsRecoveryCodes', context }

  // ⚠ aal2 AND a live factor — but the lock still applies. The lock is enforced
  // HERE rather than at mfa.verify(), because verify is a platform endpoint
  // reachable with the public anon key and cannot be intercepted. Gating access
  // is the only version of this promise that is actually true.
  if (state.is_locked) {
    return {
      kind: 'needsTotp',
      context,
      lockedUntil: state.locked_until,
      attemptsRemaining: 0,
    }
  }

  return { kind: 'ok', context }
}
