// admin-staff-accounts — the SERVICE-ROLE write path for A05.
//
// WHY THIS IS AN EDGE FUNCTION AND NOT AN RPC: every action here has two
// halves, and one of them lives in GoTrue rather than in Postgres. Creating an
// account means an `auth.users` row AND a `provider_users` row; disabling one
// means a BAN AND a deactivation. A SECURITY DEFINER function can do the
// Postgres half and is blind to the other, which would leave accounts whose two
// halves disagree — deactivated but still able to sign in, or banned but still
// listed as active staff. The service role is the only caller that can do both.
//
// ⚠ IT RE-CHECKS THE CALLER ITSELF. Reaching this function proves only that
// someone holds a valid JWT; ENGINEERING-WORKFLOW §5's law is that every
// boundary carries its OWN authorization check and never inherits one. The
// caller's uid comes from the auth server, never from the token's own claims,
// and there is no identity PARAMETER anywhere in this file — the admin is
// whoever the JWT resolves to and the account is addressed by its own id.
//
// NO CORS HEADERS, deliberately: the only caller is the Next.js server action,
// server-to-server. Same posture as admin-recovery-reset and send-sms.
//
// ⚠ NEVER LOG A TEMP PASSWORD, an email, or a staff member's name.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

/** The design's «تنتهي صلاحيتها بعد ٧٢ ساعة إن لم تُستخدم». Enforced at login by
 *  get_provider_login_state(); recorded here as the issue time it counts from. */
const TEMP_PASSWORD_TTL_HOURS = 72

/** A 100-year ban is Supabase's idiom for "indefinite" — the API takes a
 *  duration, not a flag. `none` lifts it. */
const BAN_FOREVER = '876000h'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

// ⚠ NO 0/O/1/l/I. The founder reads this aloud down a phone or types it into
// WhatsApp — there is no email delivery in v1 (spec: "shown-once + founder
// relays it"), so a character pair that looks alike is a support call.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/**
 * `Nile-7K4Q-2xR9` — the shape the approved frame draws.
 *
 * Entropy is 8 characters over a 56-symbol alphabet ≈ 46 bits, which is chosen
 * rather than inherited: this credential is single-use, dies unused after 72
 * hours, must be replaced at first login, and is only ever attackable online
 * against a rate-limited auth server. The readable prefix carries no entropy
 * and is not counted — it exists so the founder can tell two slips of paper
 * apart, which is a real failure mode when onboarding a branch at a time.
 */
function generateTempPassword(providerNameEn: string | null): string {
  const bytes = new Uint32Array(8)
  crypto.getRandomValues(bytes)
  const chars = Array.from(bytes, (n) => ALPHABET[n % ALPHABET.length])

  const word = (providerNameEn ?? '').replace(/[^A-Za-z]/g, '').slice(0, 6)
  const prefix = word.length >= 2 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : 'IH'

  return `${prefix}-${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
}

const isEmail = (value: unknown): value is string =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'not_authenticated' }, 401)

  // Verify the caller's JWT with the AUTH SERVER — never trust its own claims.
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const {
    data: { user: caller },
    error: callerError,
  } = await asCaller.auth.getUser()
  if (callerError || !caller) return json({ error: 'not_authenticated' }, 401)

  /**
   * End every open session on a staff account.
   *
   * Called AS THE ADMIN, not on the service role: `auth.uid()` inside the
   * function is the founder, so it keeps the same admin check every other
   * A04/A05 writer carries rather than needing an internal-caller bypass.
   * Best-effort — the `is_active` gate is what actually keeps a disabled
   * account out, so a failure here must not fail the caller's request.
   */
  const revokeSessions = async (providerUserId: string): Promise<void> => {
    const { error } = await asCaller.rpc('admin_revoke_provider_sessions', {
      p_provider_user_id: providerUserId,
    })
    if (error) console.log(`session revoke failed for ${providerUserId}: ${error.code ?? 'unknown'}`)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: adminRow } = await admin
    .from('admin_users')
    .select('auth_user_id')
    .eq('auth_user_id', caller.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!adminRow) return json({ error: 'not_authorized' }, 403)

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  const audit = async (
    providerUserId: string,
    action: string,
    newValues: Record<string, unknown> = {},
    oldValues: Record<string, unknown> = {},
  ) => {
    await admin.from('provider_user_history').insert({
      provider_user_id: providerUserId,
      action,
      source: 'admin',
      old_values: oldValues,
      new_values: newValues,
      changed_by: caller.id,
    })
  }

  switch (body.action) {
    // ─────────────────────────────────────────────────────────────────────
    // CREATE — «إنشاء وتوليد كلمة مؤقتة». Step 1 of the approved 2-step flow;
    // the temp password in the response IS step 2, and it is the only time it
    // exists anywhere outside GoTrue's hash.
    // ─────────────────────────────────────────────────────────────────────
    case 'create': {
      const name = String(body.name ?? '').trim()
      const email = String(body.email ?? '')
        .trim()
        .toLowerCase()
      const branchId = body.branchId

      if (name.length < 2) return json({ error: 'name_required' }, 400)
      if (!isEmail(email)) return json({ error: 'invalid_email' }, 400)
      if (!isUuid(branchId)) return json({ error: 'invalid_branch' }, 400)

      // ⚠ THE PROVIDER IS DERIVED FROM THE BRANCH, never accepted alongside it.
      // Taking both would let a caller pair a branch with a provider it does
      // not belong to and mint an account whose scope contradicts itself —
      // §5's "clients supply identities, never values", applied to a
      // relationship instead of an amount.
      const { data: branch } = await admin
        .from('branches')
        .select('id, name_ar, provider_id, providers(name_en)')
        .eq('id', branchId)
        .maybeSingle()
      if (!branch) return json({ error: 'branch_not_found' }, 404)

      const password = generateTempPassword(
        (branch.providers as { name_en?: string } | null)?.name_en ?? null,
      )

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name },
      })
      if (createError || !created?.user) {
        // GoTrue reports an existing address as a 422; surfacing it as its own
        // key lets the dialog say «البريد مستخدم بالفعل» instead of "unknown".
        const taken = /already|registered|exists/i.test(createError?.message ?? '')
        return json({ error: taken ? 'email_taken' : 'auth_create_failed' }, taken ? 409 : 500)
      }

      const { data: inserted, error: insertError } = await admin
        .from('provider_users')
        .insert({
          auth_user_id: created.user.id,
          provider_id: branch.provider_id,
          branch_ids: [branch.id],
          name,
          role: 'receptionist',
          is_active: true,
          must_change_password: true,
          temp_password_issued_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (insertError || !inserted) {
        // ⚠ COMPENSATE. Without this the auth user survives with no
        // provider_users row: invisible to the staff list, unable to reach the
        // portal, and holding the email address so the retry fails with
        // `email_taken` forever. There is no transaction across GoTrue and
        // Postgres, so the rollback has to be written by hand.
        await admin.auth.admin.deleteUser(created.user.id)
        return json({ error: 'staff_row_failed' }, 500)
      }

      await audit(inserted.id, 'account_created', {
        name,
        branch_id: branch.id,
        branch_name_ar: branch.name_ar,
      })
      await audit(inserted.id, 'temp_password_issued', { ttl_hours: TEMP_PASSWORD_TTL_HOURS })

      console.log(`staff account created by ${caller.id} for branch ${branch.id}`)

      return json({
        success: true,
        providerUserId: inserted.id,
        tempPassword: password,
        ttlHours: TEMP_PASSWORD_TTL_HOURS,
      })
    }

    // ─────────────────────────────────────────────────────────────────────
    // REGENERATE — «تُبطِل كلمة المرور الحالية فوراً وتُخرِج الحساب من جلساته».
    // Setting a new password is what invalidates the old one; the ban/unban
    // pair is what evicts the refresh tokens issued under it.
    // ─────────────────────────────────────────────────────────────────────
    case 'regenerate_temp': {
      const providerUserId = body.providerUserId
      if (!isUuid(providerUserId)) return json({ error: 'invalid_account' }, 400)

      const { data: account } = await admin
        .from('provider_users')
        .select('id, auth_user_id, is_active, providers(name_en)')
        .eq('id', providerUserId)
        .maybeSingle()
      if (!account) return json({ error: 'account_not_found' }, 404)
      if (!account.is_active) return json({ error: 'account_disabled' }, 409)

      const password = generateTempPassword(
        (account.providers as { name_en?: string } | null)?.name_en ?? null,
      )

      const { error: pwError } = await admin.auth.admin.updateUserById(account.auth_user_id, {
        password,
      })
      if (pwError) return json({ error: 'auth_update_failed' }, 500)

      const { error: flagError } = await admin
        .from('provider_users')
        .update({ must_change_password: true, temp_password_issued_at: new Date().toISOString() })
        .eq('id', account.id)
      if (flagError) return json({ error: 'staff_row_failed' }, 500)

      await revokeSessions(account.id)
      await audit(account.id, 'temp_password_issued', { ttl_hours: TEMP_PASSWORD_TTL_HOURS })

      return json({ success: true, tempPassword: password, ttlHours: TEMP_PASSWORD_TTL_HOURS })
    }

    // ─────────────────────────────────────────────────────────────────────
    // DISABLE — the confirm promises «يقطع الدخول في نفس اللحظة».
    //
    // ⚠ THREE THINGS, AND THE THIRD IS THE ONE THAT MAKES THE PROMISE TRUE:
    //   ① the BAN stops any new sign-in and any token refresh;
    //   ② deleting the auth.sessions rows evicts the refresh tokens already
    //      issued — see migration 20260810141427 for why the ban/unban trick
    //      that suggests itself here does the opposite of what it looks like;
    //   ③ `is_active = false` is read by getProviderContext() on EVERY
    //      dashboard render, so an access token still inside its 60-minute TTL
    //      buys the holder nothing but a redirect to /login.
    //
    // ③ is not belt-and-braces, it is the enforcement. A01 measured that
    // Supabase access tokens are STATELESS: nothing server-side can revoke one
    // early, so any promise of immediate lockout has to be kept by the gate
    // that runs on each request rather than by the token.
    //
    // ⚠ ORDER: the session revoke comes AFTER the ban and never before it.
    // Reversed, the account could refresh in the gap and walk out with a fresh
    // hour.
    // ─────────────────────────────────────────────────────────────────────
    case 'disable': {
      const providerUserId = body.providerUserId
      if (!isUuid(providerUserId)) return json({ error: 'invalid_account' }, 400)

      const { data: account } = await admin
        .from('provider_users')
        .select('id, auth_user_id, is_active')
        .eq('id', providerUserId)
        .maybeSingle()
      if (!account) return json({ error: 'account_not_found' }, 404)
      if (!account.is_active) return json({ success: true, unchanged: true })

      const { error: banError } = await admin.auth.admin.updateUserById(account.auth_user_id, {
        ban_duration: BAN_FOREVER,
      })
      if (banError) return json({ error: 'auth_update_failed' }, 500)

      const { error: rowError } = await admin
        .from('provider_users')
        .update({ is_active: false })
        .eq('id', account.id)
      if (rowError) {
        // Leave nothing half-done: an account banned in GoTrue but still
        // `is_active` reads as working staff on the list the founder trusts.
        await admin.auth.admin.updateUserById(account.auth_user_id, { ban_duration: 'none' })
        return json({ error: 'staff_row_failed' }, 500)
      }

      await revokeSessions(account.id)
      await audit(account.id, 'account_disabled', { is_active: false }, { is_active: true })

      return json({ success: true })
    }

    // ─────────────────────────────────────────────────────────────────────
    // ENABLE — «إعادة التفعيل تُعيد الدخول بكلمة مؤقتة جديدة». Never the old
    // password: it was live when the account was disabled and whoever knew it
    // then still knows it now.
    // ─────────────────────────────────────────────────────────────────────
    case 'enable': {
      const providerUserId = body.providerUserId
      if (!isUuid(providerUserId)) return json({ error: 'invalid_account' }, 400)

      const { data: account } = await admin
        .from('provider_users')
        .select('id, auth_user_id, is_active, providers(name_en)')
        .eq('id', providerUserId)
        .maybeSingle()
      if (!account) return json({ error: 'account_not_found' }, 404)

      const password = generateTempPassword(
        (account.providers as { name_en?: string } | null)?.name_en ?? null,
      )

      const { error: authError } = await admin.auth.admin.updateUserById(account.auth_user_id, {
        ban_duration: 'none',
        password,
      })
      if (authError) return json({ error: 'auth_update_failed' }, 500)

      const { error: rowError } = await admin
        .from('provider_users')
        .update({
          is_active: true,
          must_change_password: true,
          temp_password_issued_at: new Date().toISOString(),
        })
        .eq('id', account.id)
      if (rowError) {
        await admin.auth.admin.updateUserById(account.auth_user_id, { ban_duration: BAN_FOREVER })
        return json({ error: 'staff_row_failed' }, 500)
      }

      await audit(account.id, 'account_enabled', { is_active: true }, { is_active: false })
      await audit(account.id, 'temp_password_issued', { ttl_hours: TEMP_PASSWORD_TTL_HOURS })

      return json({ success: true, tempPassword: password, ttlHours: TEMP_PASSWORD_TTL_HOURS })
    }

    default:
      return json({ error: 'unknown_action' }, 400)
  }
})
