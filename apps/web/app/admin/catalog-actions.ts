'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '../../lib/supabase/server'

// A04 — the catalog's writes, all RPC-backed.
//
// ⚠ EVERY RULE LIVES IN THE FUNCTION, NOT HERE. The draft-only creation, the
// transition table, the future-facing validation, the audit rows — all inside
// the SECURITY DEFINER bodies where calling the API directly cannot bypass
// them. These actions carry the call and translate refusal codes into the
// founder's language. A rule that appears only here is decoration.

export interface CatalogActionResult {
  ok: boolean
  errorAr: string | null
  serviceId?: string
}

const ERROR_AR: Record<string, string> = {
  not_authorized: 'لا تملك صلاحية هذا الإجراء.',
  service_not_found: 'لم يُعثر على الخدمة.',
  category_not_found: 'لم يُعثر على التصنيف.',
  branch_not_found: 'لم يُعثر على الفرع أو أنه غير نشط.',
  name_required: 'الاسم بالعربية والإنجليزية مطلوبان.',
  invalid_code: 'الرمز يجب أن يكون حروفاً إنجليزية كبيرة وأرقاماً وشرطات — مثل CBC-01.',
  code_taken: 'هذا الرمز مستخدم في خدمة أخرى.',
  preparation_note_too_long: 'ملاحظة التحضير أطول من ٢٠٠ حرف.',
  invalid_tat_hours: 'موعد ظهور النتيجة يجب أن يكون بين ساعة و ١٦٨ ساعة.',
  invalid_transition: 'هذا الانتقال غير مسموح — الخدمة المنشورة لا تعود مسودة.',
  is_active_required: 'حدّد حالة التصنيف.',
  already_linked: 'الفرع مضاف بالفعل لهذه الخدمة.',
}

const toArabicError = (code?: string): string =>
  code === undefined
    ? 'تعذّر تنفيذ الإجراء. حدّث الصفحة وحاول مرة أخرى.'
    : (ERROR_AR[code] ?? 'تعذّر تنفيذ الإجراء. حدّث الصفحة وحاول مرة أخرى.')

// ⚠ A UNION, not `string`. Widening it throws away the generated RPC types and
// with them the compiler's ability to catch a renamed function — the class of
// bug that reaches production as a runtime 404 from PostgREST.
type CatalogRpc =
  | 'admin_create_service'
  | 'admin_update_service'
  | 'admin_set_service_status'
  | 'admin_set_category_active'
  | 'admin_link_service_to_branch'

async function callRpc(
  fn: CatalogRpc,
  args: Record<string, unknown>,
  revalidate: string,
): Promise<CatalogActionResult> {
  const supabase = await createClient()
  // The union keeps the NAME checked; argument SHAPES are validated by Zod at
  // each call site before they reach here. This cast is the one place the two
  // typing systems meet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc(fn, args as any)
  if (error) return { ok: false, errorAr: toArabicError(undefined) }
  const result = data as { success?: boolean; error?: string; service_id?: string } | null
  if (result?.success !== true) return { ok: false, errorAr: toArabicError(result?.error) }
  revalidatePath(revalidate)
  return { ok: true, errorAr: null, serviceId: result.service_id }
}

const uuid = z.string().uuid()

// The code is optional and normalised server-side; an empty string means «none»
// rather than «''», which would collide with the unique index.
const definitionSchema = z.object({
  nameAr: z.string().trim().min(1),
  nameEn: z.string().trim().min(1),
  code: z.string().trim().max(24).optional(),
  categoryId: uuid,
  preparationNotesAr: z.string().trim().max(200).optional(),
  preparationNotesEn: z.string().trim().max(200).optional(),
  tatHours: z.number().int().min(1).max(168).optional(),
})

export async function createServiceAction(input: unknown): Promise<CatalogActionResult> {
  const parsed = definitionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errorAr: 'راجِع الحقول المطلوبة.' }
  const v = parsed.data
  return callRpc(
    'admin_create_service',
    {
      p_name_ar: v.nameAr,
      p_name_en: v.nameEn,
      p_code: v.code === undefined || v.code === '' ? null : v.code,
      p_category_id: v.categoryId,
      p_preparation_notes_ar: v.preparationNotesAr ?? null,
      p_preparation_notes_en: v.preparationNotesEn ?? null,
      p_tat_hours: v.tatHours ?? 24,
    },
    '/admin/catalog',
  )
}

export async function updateServiceAction(
  serviceId: string,
  input: unknown,
): Promise<CatalogActionResult> {
  if (!uuid.safeParse(serviceId).success) return { ok: false, errorAr: toArabicError() }
  const parsed = definitionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errorAr: 'راجِع الحقول المطلوبة.' }
  const v = parsed.data
  return callRpc(
    'admin_update_service',
    {
      p_service_id: serviceId,
      p_name_ar: v.nameAr,
      p_name_en: v.nameEn,
      p_code: v.code === undefined || v.code === '' ? null : v.code,
      p_category_id: v.categoryId,
      p_preparation_notes_ar: v.preparationNotesAr ?? null,
      p_preparation_notes_en: v.preparationNotesEn ?? null,
      p_tat_hours: v.tatHours ?? null,
    },
    '/admin/catalog',
  )
}

export async function setServiceStatusAction(
  serviceId: string,
  to: 'draft' | 'published' | 'suspended',
): Promise<CatalogActionResult> {
  if (!uuid.safeParse(serviceId).success) return { ok: false, errorAr: toArabicError() }
  if (!['draft', 'published', 'suspended'].includes(to)) {
    return { ok: false, errorAr: toArabicError() }
  }
  return callRpc(
    'admin_set_service_status',
    { p_service_id: serviceId, p_to_status: to },
    '/admin/catalog',
  )
}

// THE LAUNCH SWITCH. Network-wide, and since migration 20260810140157 it is a
// booking gate rather than a display filter — so this is the most consequential
// action on the screen.
export async function setCategoryActiveAction(
  categoryId: string,
  isActive: boolean,
): Promise<CatalogActionResult> {
  if (!uuid.safeParse(categoryId).success) return { ok: false, errorAr: toArabicError() }
  if (typeof isActive !== 'boolean') return { ok: false, errorAr: toArabicError() }
  return callRpc(
    'admin_set_category_active',
    { p_category_id: categoryId, p_is_active: isActive },
    '/admin/catalog',
  )
}

export async function linkServiceToBranchAction(
  serviceId: string,
  branchId: string,
): Promise<CatalogActionResult> {
  if (!uuid.safeParse(serviceId).success || !uuid.safeParse(branchId).success) {
    return { ok: false, errorAr: toArabicError() }
  }
  return callRpc(
    'admin_link_service_to_branch',
    { p_service_id: serviceId, p_branch_id: branchId },
    '/admin/catalog',
  )
}
