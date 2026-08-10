'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '../../lib/supabase/server'

// A06 + A07 — the two writes the admin portal's last screens make.
//
// ⚠ EVERY RULE LIVES IN THE FUNCTION. The reason enum, the before-slot-start
// boundary, the slot release, the audit row, the admin check — all inside the
// SECURITY DEFINER bodies, where calling the API directly cannot bypass them.

export interface OversightActionResult {
  ok: boolean
  errorAr: string | null
  slotsCreated?: number
}

/** The frame's dropdown. Kept beside the action because the server rejects
 *  anything else — this list and the CHECK in `admin_cancel_booking` are the
 *  same list, and the server is the enforcement. */
export const CANCEL_REASONS = [
  { code: 'partner_unavailable', labelAr: 'الفرع غير متاح' },
  { code: 'patient_request', labelAr: 'بطلب من المريض' },
  { code: 'duplicate', labelAr: 'حجز مكرر' },
  { code: 'test_booking', labelAr: 'حجز تجريبي' },
  { code: 'other', labelAr: 'سبب آخر' },
] as const

const ERROR_AR: Record<string, string> = {
  not_authorized: 'لا تملك صلاحية هذا الإجراء.',
  booking_not_found: 'لم يُعثر على الحجز.',
  reason_required: 'اختر سبب الإلغاء — يُسجَّل في السجل ولا يُرسَل للمريض.',
  note_required_for_other: 'اكتب السبب حين تختار «سبب آخر».',
  slot_started: 'بدأ موعد هذا الحجز بالفعل — لا يُلغى بعد بدايته.',
  cannot_cancel: 'لا يمكن إلغاء هذا الحجز في حالته الحالية.',
  invalid_canceller: 'تعذّر تسجيل هوية من ألغى الحجز.',
}

const toArabicError = (code?: string): string =>
  code === undefined
    ? 'تعذّر تنفيذ الإجراء. حدّث الصفحة وحاول مرة أخرى.'
    : (ERROR_AR[code] ?? 'تعذّر تنفيذ الإجراء. حدّث الصفحة وحاول مرة أخرى.')

const cancelSchema = z.object({
  bookingId: z.string().uuid(),
  reasonCode: z.enum([
    'partner_unavailable',
    'patient_request',
    'duplicate',
    'test_booking',
    'other',
  ]),
  reasonNote: z.string().trim().max(500).optional(),
})

export async function adminCancelBookingAction(input: unknown): Promise<OversightActionResult> {
  const parsed = cancelSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errorAr: toArabicError('reason_required') }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_cancel_booking', {
    p_booking_id: parsed.data.bookingId,
    p_reason_code: parsed.data.reasonCode,
    p_reason_note: parsed.data.reasonNote ?? undefined,
  })
  if (error) return { ok: false, errorAr: toArabicError() }
  const result = data as { success?: boolean; error?: string } | null
  if (result?.success !== true) return { ok: false, errorAr: toArabicError(result?.error) }

  revalidatePath('/admin/bookings')
  revalidatePath('/admin/overview')
  return { ok: true, errorAr: null }
}

// ⚠ THE ONLY ALERT ACTION THAT MUTATES. Every other alert on the overview
// LINKS to the screen that owns it — an alert panel that can change six
// different things is a second, undocumented admin surface.
export async function runSlotGenerationAction(): Promise<OversightActionResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_run_slot_generation')
  if (error) return { ok: false, errorAr: toArabicError() }
  const result = data as { success?: boolean; error?: string; slotsCreated?: number } | null
  if (result?.success !== true) return { ok: false, errorAr: toArabicError(result?.error) }

  revalidatePath('/admin/overview')
  return { ok: true, errorAr: null, slotsCreated: result.slotsCreated ?? 0 }
}
