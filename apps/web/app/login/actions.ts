'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { getLoginErrorMessageAr, toLoginErrorKey } from '../../lib/auth/errors'
import { createClient } from '../../lib/supabase/server'

// Zod at the boundary (CLAUDE.md §8) — the action never trusts the form.
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
})

export interface LoginState {
  errorAr: string | null
}

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
    next: String(formData.get('next') ?? ''),
  })
  if (!parsed.success) {
    return { errorAr: getLoginErrorMessageAr('invalidCredentials') }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { errorAr: getLoginErrorMessageAr(toLoginErrorKey(error)) }
  }

  // ROLE GATE. A patient's credentials are perfectly valid here — the auth
  // server has no idea this is a staff portal — so being signed in is not the
  // same as being allowed in. Check membership and sign them straight back out
  // rather than leaving a half-authenticated session on a shared front desk.
  const { data: membership } = await supabase
    .from('provider_users')
    .select('branch_ids')
    .eq('auth_user_id', data.user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership || (membership.branch_ids?.length ?? 0) === 0) {
    await supabase.auth.signOut()
    return { errorAr: getLoginErrorMessageAr('notProvider') }
  }

  // Only ever redirect to a path on this site — an open redirect on a login
  // form is a phishing primitive.
  const next = parsed.data.next
  const destination =
    next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard/today'
  redirect(destination)
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
