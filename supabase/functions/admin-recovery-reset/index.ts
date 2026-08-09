// admin-recovery-reset — the SERVICE-ROLE half of the A01 recovery path.
//
// ⚠ WHAT THIS IS NOT: it is not a login. A recovery code cannot produce an
// aal2 session, and this function does not try to fake one. Founder ruling ②,
// fallback branch, proven from Node against the live project before any of
// this was written:
//
//   · `auth.admin.mfa` exposes exactly `deleteFactor` and `listFactors`.
//     No challenge, no verify, nothing named aal/assurance/elevate.
//   · Supabase's own MFA reference says "Recovery codes are not supported".
//   · The only way a server could satisfy mfa.verify is to read
//     `auth.mfa_factors.secret` — stored in PLAINTEXT — and compute the user's
//     own code. That is forging the second factor, not recovering it, and it
//     is precisely the "lookalike that bypasses MFA" SPEC-A01 forbids.
//
// So a valid code buys exactly one thing: UNBIND the lost authenticator, kill
// every session, and force re-enrollment on the next login.
//
// ⚠ THE ACCEPTED WINDOW, stated rather than discovered: between the reset and
// the re-enrollment the account is protected by PASSWORD ALONE. That is
// bounded (the very next sign-in is forced through enrollment before it can
// reach anything) and it is the price of any recovery mechanism that does not
// hand the second factor to the server. Note also that Supabase access tokens
// are stateless with a 60-minute TTL, so "kill every session" does not revoke
// an already-issued token — which is why the /admin gate additionally requires
// a LIVE verified factor and treats a stale aal2 token as un-enrolled.
//
// NO CORS HEADERS, deliberately. The only caller is the Next.js server action
// (server-to-server), never a browser — same posture as send-sms and
// cleanup-holds. Adding CORS here would invite a caller that should not exist.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'not_authenticated' }, 401)

  // Verify the caller's JWT with the AUTH SERVER — never trust the token's
  // own claims. The uid comes from here and from nowhere else, so there is no
  // identity parameter for a caller to forge.
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user },
    error: userError,
  } = await asCaller.auth.getUser()
  if (userError || !user) return json({ error: 'not_authenticated' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ⚠ Re-check that the caller is an active admin ON THE SERVICE ROLE. The
  // caller already passed consume_admin_recovery_code, which checks the same
  // thing — but §5's law is that every SECURITY DEFINER-equivalent boundary
  // carries its OWN authorization check rather than inheriting one.
  const { data: adminRow } = await admin
    .from('admin_users')
    .select('auth_user_id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!adminRow) return json({ error: 'not_authorized' }, 403)

  // ⚠ AND re-check that a code was ACTUALLY consumed in the last minute. This
  // function is reachable by any signed-in admin at aal1, so without this it
  // would be a factor-reset endpoint requiring no recovery code at all — which
  // would make the codes decorative. The consumption is the authorization.
  const { data: consumed } = await admin
    .from('admin_recovery_codes')
    .select('id, used_at')
    .eq('auth_user_id', user.id)
    .not('used_at', 'is', null)
    .gte('used_at', new Date(Date.now() - 60_000).toISOString())
    .limit(1)
  if (!consumed || consumed.length === 0) return json({ error: 'no_recent_recovery_code' }, 403)

  // Unenroll every factor. deleteFactor also logs the user out of all active
  // sessions when the factor was verified (documented, and confirmed in the
  // spike), so this is both halves of the reset.
  const { data: factors, error: listError } = await admin.auth.admin.mfa.listFactors({
    userId: user.id,
  })
  if (listError) return json({ error: 'list_failed' }, 500)

  for (const factor of factors?.factors ?? []) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user.id })
    if (error) return json({ error: 'delete_failed', detail: error.message }, 500)
  }

  // Belt and braces: an explicit global sign-out, in case no factor was
  // verified and deleteFactor therefore revoked nothing.
  await admin.auth.admin.signOut(token, 'global')

  // ⚠ NEVER log the code, the factor secret, or the admin's email.
  console.log(`admin recovery reset completed for ${user.id} — ${factors?.factors?.length ?? 0} factor(s) removed`)

  return json({ success: true, factorsRemoved: factors?.factors?.length ?? 0 })
})
