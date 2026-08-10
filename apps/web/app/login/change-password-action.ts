'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '../../lib/supabase/server'

export interface ChangePasswordResult {
  ok: boolean
  errorAr: string
}

// A05 — clears `must_change_password` AFTER the client has successfully changed
// the password. Idempotent and narrow: the RPC only ever moves the flag from
// TRUE to FALSE for the caller's own active account, so it is not a general
// switch and takes no identity parameter.
export async function completeProviderPasswordChangeAction(): Promise<ChangePasswordResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('complete_provider_password_change')
  if (error) {
    return { ok: false, errorAr: 'تعذّر إكمال العملية. حدّث الصفحة وحاول مرة أخرى.' }
  }
  const result = data as { success?: boolean } | null
  if (result?.success !== true) {
    return { ok: false, errorAr: 'تعذّر إكمال العملية. حدّث الصفحة وحاول مرة أخرى.' }
  }
  revalidatePath('/dashboard', 'layout')
  return { ok: true, errorAr: '' }
}
