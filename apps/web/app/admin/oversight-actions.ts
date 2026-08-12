'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { CANCEL_REASON_CODES } from '../../lib/oversight/cancel-reasons'
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

const ERROR_AR: Record<string, string> = {
  not_authorized: 'لا تملك صلاحية هذا الإجراء.',
  booking_not_found: 'لم يُعثر على الحجز.',
  review_not_found: 'لم يُعثر على هذا التقييم.',
  invalid_state: 'حالة غير صالحة.',
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
  reasonCode: z.enum(CANCEL_REASON_CODES),
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

// ── F08 · review moderation ─────────────────────────────────────────────────
// ⚠ THE QUEUE SCREEN IS v2 — the bundle annotates «طابور المراجعة في الإدارة —
// نسخة ٢». v1 surfaces the action where a moderator already is: the booking
// drawer of the visit the review is about. So there is exactly one entry point
// and it carries the context the decision needs.

const hideReviewSchema = z.object({
  reviewId: z.string().uuid(),
  hidden: z.boolean(),
  reasonCode: z.string().trim().max(64).optional(),
  reasonNote: z.string().trim().max(500).optional(),
})

export async function setReviewHiddenAction(input: {
  reviewId: string
  hidden: boolean
  reasonCode?: string
  reasonNote?: string
}): Promise<OversightActionResult> {
  const parsed = hideReviewSchema.safeParse(input)
  if (!parsed.success) return { ok: false, errorAr: 'بيانات غير صالحة.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_set_review_hidden', {
    p_review_id: parsed.data.reviewId,
    p_hidden: parsed.data.hidden,
    p_reason_code: parsed.data.reasonCode,
    p_reason_note: parsed.data.reasonNote,
  })
  if (error) return { ok: false, errorAr: 'تعذّر إتمام العملية. حاول مرة أخرى.' }

  const result = data as unknown as { ok: boolean; error?: string }
  if (!result.ok) {
    return { ok: false, errorAr: ERROR_AR[result.error ?? ''] ?? 'تعذّر إتمام العملية.' }
  }

  // The branch aggregate moved server-side the instant the flag flipped (the
  // trigger owns it), so the surfaces that read it must re-render.
  revalidatePath('/admin/bookings')
  return { ok: true, errorAr: null }
}
