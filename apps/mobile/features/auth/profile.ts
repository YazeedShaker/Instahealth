import type { UserRow } from '@instahealth/core'

import { supabase } from '../../lib/supabase'

// NOTE (spec deviation, verified against the live DB): there is NO trigger that
// creates the public.users row on first sign-in. The RLS policy
// "users: patient inserts own row" (INSERT WITH CHECK id = auth.uid()) exists
// exactly for this — the client creates its OWN row, scoped by RLS.

/** Fetches the patient's profile row, creating it on first sign-in. */
export async function ensureProfile(userId: string, phone: string): Promise<UserRow> {
  const { data: existing, error: selectError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (selectError) throw selectError
  if (existing) return existing

  const { data: created, error: insertError } = await supabase
    .from('users')
    .insert({ id: userId, phone })
    .select('*')
    .single()
  if (insertError) throw insertError
  return created
}

/** First-time name entry — RLS-scoped update of the patient's own row. */
export async function updateProfileName(userId: string, nameAr: string): Promise<UserRow> {
  const { data, error } = await supabase
    .from('users')
    .update({ name_ar: nameAr.trim() })
    .eq('id', userId)
    .select('*')
    .single()
  if (error) throw error
  return data
}
