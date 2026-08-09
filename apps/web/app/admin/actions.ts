'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getLoginErrorMessageAr, toLoginErrorKey } from '../../lib/auth/errors'
import { createClient } from '../../lib/supabase/server'

// All admin auth transitions live here as SERVER ACTIONS rather than in a
// client component talking to supabase-js directly. Two reasons:
//  ① the @supabase/ssr server client writes the session COOKIE, so an aal2
//     upgrade is visible to the very next Server Component render — a browser
//     client would leave the server rendering the pre-verify state;
//  ② the failure counter must be recorded on a path we control. It still is
//     not airtight (mfa.verify is a platform endpoint anyone can call with the
//     anon key), which is exactly why the LOCK is enforced at the /admin gate
//     rather than here. Stated in the migration too.

export interface AdminAuthState {
  errorAr: string | null
  /** Mirrors the server counter so the design's «بقيت لك ٣ محاولات» cannot
   * drift from what is actually enforced. */
  attemptsRemaining?: number
  lockedUntil?: string | null
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// ── Step 1 · password ───────────────────────────────────────────────────────
export async function adminSignIn(
  _prev: AdminAuthState,
  formData: FormData,
): Promise<AdminAuthState> {
  const parsed = credentialsSchema.safeParse({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  })
  if (!parsed.success) return { errorAr: getLoginErrorMessageAr('invalidCredentials') }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { errorAr: getLoginErrorMessageAr(toLoginErrorKey(error)) }

  // ROLE GATE, the P01 law applied to the admin portal: a patient's or a
  // receptionist's credentials are perfectly valid against the auth server,
  // which has no idea this is the admin panel. Sign a non-admin straight back
  // OUT rather than leaving a half-authenticated session behind.
  const { data: state } = await supabase.rpc('get_admin_auth_state')
  const isAdmin = (state as { is_admin?: boolean } | null)?.is_admin === true
  if (!isAdmin) {
    await supabase.auth.signOut()
    return { errorAr: 'هذا الحساب لا يملك صلاحية الدخول إلى لوحة الإدارة.' }
  }

  if (!data.session) return { errorAr: getLoginErrorMessageAr('invalidCredentials') }

  // The gate in the layout decides WHICH step comes next — password change,
  // enrollment, or verify. This action does not duplicate that decision.
  redirect('/admin/overview')
}

// ── Forced password change (the temp password from seed 005) ────────────────
const passwordChangeSchema = z
  .object({
    password: z.string().min(12, 'كلمة المرور يجب أن تكون ١٢ حرفاً على الأقل.'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'الكلمتان غير متطابقتين.' })

export async function adminChangePassword(
  _prev: AdminAuthState,
  formData: FormData,
): Promise<AdminAuthState> {
  const parsed = passwordChangeSchema.safeParse({
    password: String(formData.get('password') ?? ''),
    confirm: String(formData.get('confirm') ?? ''),
  })
  if (!parsed.success) {
    return { errorAr: parsed.error.issues[0]?.message ?? 'كلمة المرور غير صالحة.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { errorAr: 'تعذّر تغيير كلمة المرور. حاول مرة أخرى.' }

  // Only NOW is the flag cleared — and only by the SECURITY DEFINER function,
  // because admin_users carries no client UPDATE policy at all.
  const { data } = await supabase.rpc('complete_admin_password_change')
  if ((data as { success?: boolean } | null)?.success !== true) {
    return { errorAr: 'تم تغيير كلمة المرور لكن تعذّر تحديث حالة الحساب.' }
  }

  redirect('/admin/overview')
}

// ── Enrollment · step 1: mint a factor and hand back the QR ─────────────────
export interface EnrollStart {
  factorId: string
  /** otpauth:// URI — the QR encodes exactly this. */
  uri: string
  /** The manual key, for someone who cannot scan. */
  secret: string
}

export async function adminBeginEnrollment(): Promise<
  { ok: true; data: EnrollStart } | { ok: false; errorAr: string }
> {
  const supabase = await createClient()

  // An abandoned enrollment leaves an UNVERIFIED factor behind, and Supabase
  // rejects a second factor with the same friendly name. Clear any unverified
  // leftovers so a reload is never a dead end.
  const { data: existing } = await supabase.auth.mfa.listFactors()
  for (const f of existing?.all ?? []) {
    if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `instahealth-admin-${Date.now()}`,
    issuer: 'InstaHealth',
  })
  if (error || !data) return { ok: false, errorAr: 'تعذّر بدء الربط. حدّث الصفحة وحاول مرة أخرى.' }

  return {
    ok: true,
    data: { factorId: data.id, uri: data.totp.uri, secret: data.totp.secret },
  }
}

// ── Enrollment · step 2: confirm the binding, then mint recovery codes ──────
const codeSchema = z.object({
  factorId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/, 'الرمز ٦ أرقام.'),
})

export async function adminConfirmEnrollment(
  _prev: { errorAr: string | null; codes?: string[] },
  formData: FormData,
): Promise<{ errorAr: string | null; codes?: string[] }> {
  const parsed = codeSchema.safeParse({
    factorId: String(formData.get('factorId') ?? ''),
    code: String(formData.get('code') ?? '').replace(/\D/g, ''),
  })
  if (!parsed.success) return { errorAr: 'أدخل الرمز كاملاً — ٦ أرقام.' }

  const supabase = await createClient()
  const challenge = await supabase.auth.mfa.challenge({ factorId: parsed.data.factorId })
  if (challenge.error) return { errorAr: 'تعذّر التحقق. حاول مرة أخرى.' }

  const verify = await supabase.auth.mfa.verify({
    factorId: parsed.data.factorId,
    challengeId: challenge.data.id,
    code: parsed.data.code,
  })
  if (verify.error) {
    return { errorAr: 'الرمز غير صحيح أو انتهت صلاحيته. انتظر الرمز التالي في التطبيق.' }
  }

  // The session is aal2 as of this line, which is what
  // generate_admin_recovery_codes() requires. The plaintext codes exist ONLY
  // in this response — they are bcrypt-hashed in the database and can never be
  // read back. Shown once, per the design.
  const { data: gen } = await supabase.rpc('generate_admin_recovery_codes')
  const result = gen as { success?: boolean; codes?: string[] } | null
  if (result?.success !== true || !result.codes) {
    return { errorAr: 'تم الربط لكن تعذّر توليد رموز الاستعادة. جرّب توليدها من الإعدادات.' }
  }

  await supabase.rpc('clear_admin_totp_failures')
  return { errorAr: null, codes: result.codes }
}

// ── Step 2 · the returning login's TOTP verify ──────────────────────────────
export async function adminVerifyTotp(
  _prev: AdminAuthState,
  formData: FormData,
): Promise<AdminAuthState> {
  const raw = String(formData.get('code') ?? '').replace(/\D/g, '')
  const supabase = await createClient()

  const { data: factors } = await supabase.auth.mfa.listFactors()
  const factor = factors?.totp?.[0]
  if (!factor) redirect('/admin/login/enroll')

  if (!/^\d{6}$/.test(raw)) return { errorAr: 'أدخل الرمز كاملاً — ٦ أرقام.' }

  const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id })
  if (challenge.error) return { errorAr: 'تعذّر التحقق. حاول مرة أخرى.' }

  const verify = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: challenge.data.id,
    code: raw,
  })

  if (verify.error) {
    const { data: failure } = await supabase.rpc('record_admin_totp_failure')
    const f = failure as { attempts_remaining?: number; locked_until?: string | null } | null
    return {
      errorAr: 'الرمز غير صحيح أو انتهت صلاحيته. انتظر الرمز التالي في التطبيق وأدخله كاملاً.',
      attemptsRemaining: f?.attempts_remaining ?? 0,
      lockedUntil: f?.locked_until ?? null,
    }
  }

  await supabase.rpc('clear_admin_totp_failures')
  redirect('/admin/overview')
}

// ── The recovery path — a SUPERVISED TOTP RESET, never a login ──────────────
//
// ⚠ FOUNDER RULING ②, FALLBACK BRANCH, and the copy says so plainly. A recovery
// code does NOT sign anyone in and does NOT produce aal2: Supabase offers no
// sound way to elevate a session without the factor (proven from Node — the
// admin MFA namespace exposes only deleteFactor and listFactors, and its own
// docs state "Recovery codes are not supported"). What a code buys is the
// right to UNBIND the lost authenticator and enrol a new one.
export async function adminUseRecoveryCode(
  _prev: AdminAuthState,
  formData: FormData,
): Promise<AdminAuthState> {
  const code = String(formData.get('code') ?? '').trim()
  if (!/^[0-9A-Za-z]{4}-?[0-9A-Za-z]{4}$/.test(code)) {
    return { errorAr: 'صيغة الرمز غير صحيحة — ثمانية أحرف مثل ABCD-2345.' }
  }

  const supabase = await createClient()

  // Consumption is single-use and derives the account from auth.uid() — there
  // is no identity parameter to forge (the create_slot_hold law).
  const { data } = await supabase.rpc('consume_admin_recovery_code', { p_code: code })
  const result = data as { success?: boolean; error?: string } | null

  if (result?.success !== true) {
    if (result?.error === 'locked') {
      return { errorAr: 'الدخول مقفل مؤقتاً. انتظر انتهاء المهلة ثم حاول مرة أخرى.' }
    }
    return { errorAr: 'رمز الاستعادة غير صحيح أو مستخدم من قبل.' }
  }

  // The reset itself needs the SERVICE ROLE (deleteFactor + global sign-out),
  // so it lives in the `admin-recovery-reset` Edge Function — the same
  // boundary settle-payment uses. The code is already consumed at this point,
  // which is deliberate: a code must not be re-usable if the reset half fails.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-recovery-reset`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
      },
      body: '{}',
    },
  )

  if (!response.ok) {
    return {
      errorAr:
        'تم قبول الرمز لكن تعذّر إلغاء ربط التطبيق. تواصل مع الدعم الفني — لا تستخدم رمزاً آخر.',
    }
  }

  // Every session is dead now, including this one. Back to step one, where the
  // gate will route to enrollment because no verified factor remains.
  await supabase.auth.signOut()
  redirect('/admin/login?reset=1')
}

export async function adminSignOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/admin/login')
}

// ── Recovery-code acknowledgement + regeneration ────────────────────────────
//
// ⚠ WHY ACKNOWLEDGEMENT IS SERVER STATE. A local checkbox was silently defeated
// by Next's post-action revalidation: enrollment made the session aal2, the
// route re-rendered, the gate saw a fully-authorised admin and redirected to
// /admin/overview — destroying eight one-time codes before they were displayed.
// Found by running the flow. Migration 20260808231917 carries the full story.
export async function adminAcknowledgeRecoveryCodes(): Promise<
  { ok: true } | { ok: false; errorAr: string }
> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('acknowledge_admin_recovery_codes')
  const result = data as { success?: boolean; error?: string } | null

  if (result?.success !== true) {
    if (result?.error === 'no_codes') {
      return { ok: false, errorAr: 'لا توجد رموز صالحة لتأكيدها. ولّد مجموعة جديدة أولاً.' }
    }
    return { ok: false, errorAr: 'تعذّر تأكيد حفظ الرموز. حاول مرة أخرى.' }
  }
  return { ok: true }
}

/** Mint a fresh batch, superseding the previous one entirely. Requires aal2,
 * which the caller already has — this path is only reachable once enrolled.
 *
 * Called through `useTransition`, not `useActionState`: there is no form data
 * and no previous state to thread, and inventing both just to satisfy an action
 * signature is two unused parameters pretending to be an interface. */
export async function adminRegenerateRecoveryCodes(): Promise<{
  errorAr: string | null
  codes?: string[]
}> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('generate_admin_recovery_codes')
  const result = data as { success?: boolean; error?: string; codes?: string[] } | null

  if (result?.success !== true || !result.codes) {
    if (result?.error === 'aal2_required') {
      return { errorAr: 'انتهت صلاحية الجلسة. سجّل الدخول مرة أخرى ثم أعد المحاولة.' }
    }
    return { errorAr: 'تعذّر توليد رموز جديدة. حاول مرة أخرى.' }
  }
  return { errorAr: null, codes: result.codes }
}
