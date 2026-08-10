'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { env } from '../../lib/env'
import { createClient } from '../../lib/supabase/server'

// A05 — the staff accounts' writes, all through the `admin-staff-accounts`
// Edge Function.
//
// ⚠ WHY NOT AN RPC: every action has one half in GoTrue and one in Postgres.
// Creating an account is an auth.users row AND a provider_users row; disabling
// one is a BAN AND a deactivation AND a session revoke. A SECURITY DEFINER
// function can do the Postgres half and is blind to the other, which leaves
// accounts whose halves disagree.
//
// ⚠ AND WHY THE SERVER ACTION RATHER THAN THE BROWSER: the function is called
// server-to-server with the founder's own access token, exactly like A01's
// recovery reset. It has no CORS headers on purpose — a browser must never be
// a caller.

export interface StaffActionResult {
  ok: boolean
  errorAr: string | null
  /** Present ONLY on create / regenerate / enable. Shown once and never stored.
   *  ⚠ Never logged, never persisted, never revalidated into a server payload
   *  — it lives in the client component's state until the founder dismisses it. */
  tempPassword?: string
  providerUserId?: string
}

const ERROR_AR: Record<string, string> = {
  not_authenticated: 'انتهت جلستك. سجّل الدخول مرة أخرى.',
  not_authorized: 'لا تملك صلاحية هذا الإجراء.',
  invalid_body: 'تعذّر تنفيذ الإجراء. حدّث الصفحة وحاول مرة أخرى.',
  name_required: 'اسم المستخدم مطلوب.',
  invalid_email: 'صيغة البريد غير صحيحة.',
  invalid_branch: 'اختر فرعاً.',
  branch_not_found: 'لم يُعثر على الفرع أو أنه غير نشط.',
  email_taken: 'هذا البريد مستخدم بالفعل في حساب آخر.',
  auth_create_failed: 'تعذّر إنشاء الحساب. حاول مرة أخرى.',
  auth_update_failed: 'تعذّر تحديث الحساب. حاول مرة أخرى.',
  staff_row_failed: 'تعذّر حفظ بيانات الحساب. لم يُنشأ شيء ناقص — حاول مرة أخرى.',
  account_not_found: 'لم يُعثر على الحساب.',
  account_disabled: 'الحساب معطّل — فعّله أولاً.',
  unknown_action: 'تعذّر تنفيذ الإجراء.',
}

const toArabicError = (code?: string): string =>
  code === undefined
    ? 'تعذّر تنفيذ الإجراء. حدّث الصفحة وحاول مرة أخرى.'
    : (ERROR_AR[code] ?? 'تعذّر تنفيذ الإجراء. حدّث الصفحة وحاول مرة أخرى.')

async function callEdge(body: Record<string, unknown>): Promise<StaffActionResult> {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (session === null) return { ok: false, errorAr: toArabicError('not_authenticated') }

  let response: Response
  try {
    response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-staff-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
  } catch {
    return { ok: false, errorAr: toArabicError() }
  }

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean
    error?: string
    tempPassword?: string
    providerUserId?: string
  } | null

  if (!response.ok || payload?.success !== true) {
    return { ok: false, errorAr: toArabicError(payload?.error) }
  }

  revalidatePath('/admin/staff')
  return {
    ok: true,
    errorAr: null,
    tempPassword: payload.tempPassword,
    providerUserId: payload.providerUserId,
  }
}

const uuid = z.string().uuid()

const createSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  branchId: uuid,
})

export async function createStaffAccountAction(input: unknown): Promise<StaffActionResult> {
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errorAr: 'راجِع الاسم والبريد والفرع.' }
  return callEdge({ action: 'create', ...parsed.data })
}

export async function regenerateTempPasswordAction(
  providerUserId: string,
): Promise<StaffActionResult> {
  if (!uuid.safeParse(providerUserId).success) return { ok: false, errorAr: toArabicError() }
  return callEdge({ action: 'regenerate_temp', providerUserId })
}

export async function disableStaffAccountAction(
  providerUserId: string,
): Promise<StaffActionResult> {
  if (!uuid.safeParse(providerUserId).success) return { ok: false, errorAr: toArabicError() }
  return callEdge({ action: 'disable', providerUserId })
}

export async function enableStaffAccountAction(providerUserId: string): Promise<StaffActionResult> {
  if (!uuid.safeParse(providerUserId).success) return { ok: false, errorAr: toArabicError() }
  return callEdge({ action: 'enable', providerUserId })
}
