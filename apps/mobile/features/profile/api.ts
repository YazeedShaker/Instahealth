import { supabase } from '../../lib/supabase'

// PROF-01 — the account-deletion call. All semantics live SERVER-side in the
// `delete-account` Edge Function (cancel future bookings via the real path,
// anonymize the users row, delete the auth user). The client sends NOTHING —
// the bearer token is the identity.

export type DeleteAccountResult = { kind: 'ok' } | { kind: 'error' }

export async function deleteAccount(): Promise<DeleteAccountResult> {
  const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
  if (error !== null) return { kind: 'error' }
  const result = data as { success?: boolean } | null
  return result?.success === true ? { kind: 'ok' } : { kind: 'error' }
}
