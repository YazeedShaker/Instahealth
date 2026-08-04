// delete-account — the App Store-mandatory account deletion (SPEC-PROF-01).
//
// THE RATIFIED SEMANTICS: anonymize, don't destroy. Bookings, payments and
// notifications rows STAY (commission history, partner invoicing — the
// standing money law); the PERSON is scrubbed: users row → tombstone
// («مستخدم محذوف», unique non-phone), then the auth user is deleted so every
// session dies and the phone number is freed for a fresh registration.
//
// ⚠ ORDERING IS THE SAFETY ARGUMENT (spec: reason it out and state it):
//   cancel bookings → release holds → ANONYMIZE → auth-delete, in that order.
//   If auth-delete came FIRST and the anonymize step crashed, the PII would
//   persist with NO login left that could retry through the app — orphaned
//   personal data recoverable only by an admin. Anonymize-first inverts the
//   failure: a crash leaves a LIVE login whose data is already scrubbed, and
//   the retry (the patient is still signed in) completes the auth deletion.
//   The scrubbed-but-signed-in interim is safe — scrubbing is exactly what
//   the caller just asked for.
//
// IDEMPOTENT within a verified session: every step tolerates having already
// happened (cancel → `cannot_cancel` is fine, anonymize writes the same
// values, auth-delete tolerates user_not_found), so a partial-failure rerun
// completes the remainder. After the auth user is gone the bearer token no
// longer verifies — a repeat call gets 401, which is correct: an unverifiable
// caller must never learn whether an account existed.
//
// The client cannot self-delete: users have no DELETE policy anywhere and
// auth.admin requires the service key, which lives only here.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

// CORS — this function is CLIENT-invoked, and Expo's web target makes it
// cross-origin (ENGINEERING-WORKFLOW §6: every client-invoked function needs
// the OPTIONS short-circuit + CORS headers on EVERY response, errors included).
// `*` is safe here for the same reason as settle-payment: auth is an explicit
// bearer token, never an ambient cookie.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' }

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (request.method !== 'POST') {
    return json(405, { success: false, error: 'method_not_allowed' })
  }

  // Resolve the caller from THEIR bearer token — the platform's verify_jwt has
  // already rejected unauthenticated calls; this pins the deletion to the
  // token's own user. No user id travels in the request body (§5: clients
  // supply identities never — here not even that; the token IS the identity).
  const authHeader = request.headers.get('Authorization') ?? ''
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()
  if (userError !== null || user === null) {
    return json(401, { success: false, error: 'not_authenticated' })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)

  try {
    // ── 1 · cancel upcoming bookings through the REAL cancel path ─────────
    // cancel_booking releases the slot, stamps cancelled_by='patient' (the
    // internal caller acts for the patient — the same contract the
    // abandoned-booking cleanup uses) and the desk sees the cancellation via
    // the normal realtime broadcast. Nothing bespoke.
    const { data: bookings, error: bookingsError } = await admin
      .from('bookings')
      .select('id, status, slot:slots!inner(slot_date, slot_time)')
      .eq('user_id', user.id)
      .in('status', ['pending_payment', 'confirmed', 'arrived'])
    if (bookingsError !== null) throw bookingsError

    const cairoNow = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Africa/Cairo',
      dateStyle: 'short',
      timeStyle: 'medium',
    })
      .format(new Date())
      .replace(' ', 'T')

    for (const booking of bookings ?? []) {
      const slot = booking.slot as unknown as { slot_date: string; slot_time: string }
      const startsAt = `${slot.slot_date}T${slot.slot_time}`
      if (startsAt <= cairoNow) continue // past bookings stay as history
      const { data: result, error: cancelError } = await admin.rpc('cancel_booking', {
        p_booking_id: booking.id,
        p_reason: 'حذف الحساب',
        p_cancelled_by: 'patient',
      })
      if (cancelError !== null) throw cancelError
      const outcome = result as { success?: boolean; error?: string } | null
      // `cannot_cancel` = the desk closed it while we iterated — that booking
      // is history now, which is the correct end state. Anything else is real.
      if (outcome?.success !== true && outcome?.error !== 'cannot_cancel') {
        throw new Error(`cancel_booking failed: ${outcome?.error ?? 'unknown'}`)
      }
    }

    // ── 2 · release any active slot hold (frees a slot mid-checkout) ──────
    const { error: holdsError } = await admin.from('slot_holds').delete().eq('user_id', user.id)
    if (holdsError !== null) throw holdsError

    // ── 3 · ANONYMIZE the users row (the tombstone) ───────────────────────
    // phone → `del-` + the uuid's first 16 hex chars: EXACTLY 20 chars —
    // users.phone is varchar(20), which the first tombstone format blew
    // through (proven live: `value too long for varchar(20)`, and the
    // ordering held — nothing was half-deleted). 64 bits of the uuid keeps it
    // unique per user (users_phone_key), identical on rerun (idempotent), and
    // frees the REAL number for the fresh registration after the auth user
    // goes. `del-` can never collide with a real phone.
    const tombstonePhone = `del-${user.id.replaceAll('-', '').slice(0, 16)}`
    const { error: scrubError } = await admin
      .from('users')
      .update({
        name_ar: 'مستخدم محذوف',
        name_en: null,
        email: null,
        date_of_birth: null,
        gender: null,
        sms_reminders: false,
        phone: tombstonePhone,
      })
      .eq('id', user.id)
    if (scrubError !== null) throw scrubError

    // ── 4 · delete the auth user — sessions die, the number is freed ──────
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError !== null && !/not.?found/i.test(deleteError.message)) {
      throw deleteError
    }

    return json(200, { success: true })
  } catch (error) {
    console.error('delete-account failed:', error)
    // The caller retries with a still-valid session (auth-delete is LAST, so
    // a partial failure leaves the login alive) — see the ordering note above.
    return json(500, { success: false, error: 'deletion_failed' })
  }
})
