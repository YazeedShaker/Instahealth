'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '../../lib/supabase/server'

// A02 — the statement's two writes, both RPC-backed.
//
// ⚠ NOTHING HERE DECIDES ANYTHING. Every guard — settled is terminal, the legal
// transition walk, the double-issue refusal — lives inside the SECURITY DEFINER
// functions, where it cannot be bypassed by calling the API directly. These
// actions exist to carry the call and revalidate the route, and they translate
// the server's refusal codes into the founder's language. If a rule appears
// here that is not also in the function, the rule is decoration.

const issueSchema = z.object({
  providerId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const transitionSchema = z.object({
  statementId: z.string().uuid(),
  to: z.enum(['sent', 'settled']),
})

export interface StatementActionResult {
  ok: boolean
  errorAr: string | null
}

// The server's error codes, rendered once. A code the UI has never seen must
// still say something true rather than falling through to a blank toast.
const ERROR_AR: Record<string, string> = {
  already_settled: 'هذا الكشف مُسوّى ولا يُعاد إصداره. الفرق اللاحق يُرحَّل إلى كشف الشهر التالي.',
  no_changes_since_last_issue: 'لا جديد منذ آخر إصدار — لا داعي لإصدار نسخة جديدة.',
  illegal_transition: 'لا يمكن الانتقال إلى هذه الحالة من الحالة الحالية.',
  unsupported_transition: 'حالة غير معروفة.',
  superseded_is_read_only: 'هذه نسخة ملغاة — محفوظة للسجل ولا تقبل التعديل.',
  statement_not_found: 'لم يُعثر على الكشف.',
  not_authorized: 'لا تملك صلاحية هذا الإجراء.',
}

function toArabicError(code: string | undefined): string {
  return code === undefined
    ? 'تعذّر تنفيذ الإجراء. حدّث الصفحة وحاول مرة أخرى.'
    : (ERROR_AR[code] ?? 'تعذّر تنفيذ الإجراء. حدّث الصفحة وحاول مرة أخرى.')
}

export async function issueStatementAction(
  providerId: string,
  month: string,
): Promise<StatementActionResult> {
  const parsed = issueSchema.safeParse({ providerId, month })
  if (!parsed.success) return { ok: false, errorAr: 'طلب غير صالح.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('issue_statement', {
    p_provider_id: parsed.data.providerId,
    p_month: parsed.data.month,
  })
  if (error) return { ok: false, errorAr: toArabicError(undefined) }

  const result = data as { success?: boolean; error?: string } | null
  if (result?.success !== true) return { ok: false, errorAr: toArabicError(result?.error) }

  revalidatePath('/admin/commissions')
  return { ok: true, errorAr: null }
}

export async function transitionStatementAction(
  statementId: string,
  to: 'sent' | 'settled',
): Promise<StatementActionResult> {
  const parsed = transitionSchema.safeParse({ statementId, to })
  if (!parsed.success) return { ok: false, errorAr: 'طلب غير صالح.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('transition_statement', {
    p_statement_id: parsed.data.statementId,
    p_to: parsed.data.to,
  })
  if (error) return { ok: false, errorAr: toArabicError(undefined) }

  const result = data as { success?: boolean; error?: string } | null
  if (result?.success !== true) return { ok: false, errorAr: toArabicError(result?.error) }

  revalidatePath('/admin/commissions')
  return { ok: true, errorAr: null }
}
