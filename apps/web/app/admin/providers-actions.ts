'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '../../lib/supabase/server'

// A03 — the network's writes, all RPC-backed.
//
// ⚠ EVERY RULE LIVES IN THE FUNCTION, NOT HERE. The future-only rate date, the
// Egypt-bounds pin check, the empty-name refusal, the audit row — all of them
// are inside the SECURITY DEFINER bodies, where calling the API directly cannot
// bypass them. These actions carry the call and translate refusal codes into the
// founder's language. A rule that appears only here is decoration.

export interface NetworkActionResult {
  ok: boolean
  errorAr: string | null
}

const ERROR_AR: Record<string, string> = {
  not_authorized: 'لا تملك صلاحية هذا الإجراء.',
  provider_not_found: 'لم يُعثر على المزود.',
  branch_not_found: 'لم يُعثر على الفرع.',
  name_required: 'الاسم بالعربية والإنجليزية مطلوبان.',
  invalid_percent: 'النسبة يجب أن تكون بين ٠ و ١٠٠.',
  effective_from_must_be_future:
    'تاريخ السريان يجب أن يكون في المستقبل — النسبة لا تُطبَّق بأثر رجعي على حجوزات استُحقت بالفعل.',
  rate_already_set_for_that_date: 'توجد نسبة مسجّلة بالفعل بهذا التاريخ.',
  lat_out_of_range: 'خط العرض خارج حدود مصر — تحقّق من الدبوس.',
  lng_out_of_range: 'خط الطول خارج حدود مصر — تحقّق من الدبوس.',
  invalid_allocation: 'عدد المواعيد اليومية يجب أن يكون بين ١ و ٦٠.',
}

const toArabicError = (code?: string): string =>
  code === undefined
    ? 'تعذّر تنفيذ الإجراء. حدّث الصفحة وحاول مرة أخرى.'
    : (ERROR_AR[code] ?? 'تعذّر تنفيذ الإجراء. حدّث الصفحة وحاول مرة أخرى.')

// ⚠ The name is a UNION, not `string`. Widening it to string throws away the
// generated RPC types — and with them the compiler's ability to catch a
// renamed function or a mistyped argument, which is exactly the class of bug
// that reaches production as a runtime 404 from PostgREST.
type NetworkRpc =
  | 'admin_update_provider'
  | 'admin_update_branch'
  | 'set_provider_commission_rate'
  | 'apply_branch_slot_shape'

async function callRpc(
  fn: NetworkRpc,
  args: Record<string, unknown>,
  revalidate: string,
): Promise<NetworkActionResult> {
  const supabase = await createClient()
  // The union above keeps the NAME checked. The argument SHAPES differ per
  // function, so they are validated by Zod at each call site before they reach
  // here; this cast is the one place the two typing systems meet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc(fn, args as any)
  if (error) return { ok: false, errorAr: toArabicError(undefined) }
  const result = data as { success?: boolean; error?: string } | null
  if (result?.success !== true) return { ok: false, errorAr: toArabicError(result?.error) }
  revalidatePath(revalidate)
  return { ok: true, errorAr: null }
}

const uuid = z.string().uuid()

export async function updateProviderAction(
  providerId: string,
  nameAr: string,
  nameEn: string,
  isActive: boolean,
): Promise<NetworkActionResult> {
  if (!uuid.safeParse(providerId).success) return { ok: false, errorAr: 'طلب غير صالح.' }
  return callRpc(
    'admin_update_provider',
    { p_provider_id: providerId, p_name_ar: nameAr, p_name_en: nameEn, p_is_active: isActive },
    '/admin/providers',
  )
}

const rateSchema = z.object({
  providerId: z.string().uuid(),
  percent: z.number().positive().max(100),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function setCommissionRateAction(
  providerId: string,
  percent: number,
  effectiveFrom: string,
): Promise<NetworkActionResult> {
  const parsed = rateSchema.safeParse({ providerId, percent, effectiveFrom })
  if (!parsed.success) return { ok: false, errorAr: 'طلب غير صالح.' }
  return callRpc(
    'set_provider_commission_rate',
    {
      p_provider_id: parsed.data.providerId,
      p_percent: parsed.data.percent,
      p_effective_from: parsed.data.effectiveFrom,
      p_note: null,
    },
    '/admin/providers',
  )
}

export async function updateBranchAction(
  branchId: string,
  nameAr: string,
  nameEn: string,
  district: string | null,
  lat: number | null,
  lng: number | null,
  isActive: boolean,
): Promise<NetworkActionResult> {
  if (!uuid.safeParse(branchId).success) return { ok: false, errorAr: 'طلب غير صالح.' }
  return callRpc(
    'admin_update_branch',
    {
      p_branch_id: branchId,
      p_name_ar: nameAr,
      p_name_en: nameEn,
      p_district: district,
      p_lat: lat,
      p_lng: lng,
      p_is_active: isActive,
    },
    '/admin/providers',
  )
}

/** The confirm dialog's numbers. Read-only — it changes nothing, which is why
 *  the founder can open it without committing to anything. */
export async function previewSlotShapeAction(
  branchId: string,
  allocation: number,
): Promise<{ ok: boolean; errorAr: string | null; preview: Record<string, unknown> | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('preview_branch_slot_shape', {
    p_branch_id: branchId,
    p_allocation: allocation,
  })
  if (error) return { ok: false, errorAr: toArabicError(undefined), preview: null }
  const result = data as { success?: boolean; error?: string } | null
  if (result?.success !== true) {
    return { ok: false, errorAr: toArabicError(result?.error), preview: null }
  }
  return { ok: true, errorAr: null, preview: result as Record<string, unknown> }
}

export async function applySlotShapeAction(
  branchId: string,
  allocation: number,
): Promise<NetworkActionResult> {
  if (!uuid.safeParse(branchId).success) return { ok: false, errorAr: 'طلب غير صالح.' }
  return callRpc(
    'apply_branch_slot_shape',
    { p_branch_id: branchId, p_allocation: allocation },
    '/admin/providers',
  )
}

export async function previewDeactivationAction(
  providerId: string,
): Promise<{ ok: boolean; preview: Record<string, unknown> | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('preview_provider_deactivation', {
    p_provider_id: providerId,
  })
  if (error) return { ok: false, preview: null }
  return { ok: true, preview: data as Record<string, unknown> }
}
