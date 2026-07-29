import { createClient } from '../supabase/server'

// Who is at the desk, and which branch are they allowed to see?
//
// Everything here is derived SERVER-side from the session. The branch id in
// particular is never read from a URL or a form field — it comes from
// provider_users, so a receptionist cannot ask for another branch's day by
// editing a query string. (The RPCs re-check membership anyway; this just means
// the UI never even forms the wrong request.)

export interface ProviderContext {
  userId: string
  email: string | null
  displayName: string
  branchId: string
  branchNameAr: string
  slotAllocation: number
  /** Expected minutes per visit, for the drawer's «مدة الخدمة المتوقعة» line.
   * NULL when the branch never declared one — the line then disappears rather
   * than inventing a number. */
  slotDurationMinutes: number | null
}

export type ProviderLookup =
  | { kind: 'ok'; context: ProviderContext }
  /** Signed in, but not provider staff — a patient session, most likely. */
  | { kind: 'notProvider' }
  | { kind: 'signedOut' }

export async function getProviderContext(): Promise<ProviderLookup> {
  const supabase = await createClient()

  // getUser(), never getSession(): getUser revalidates the JWT against the auth
  // server, so a forged or stale cookie cannot manufacture a provider session.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { kind: 'signedOut' }

  const { data: membership } = await supabase
    .from('provider_users')
    .select('branch_ids, role, is_active')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const branchId = membership?.branch_ids?.[0] ?? null
  if (!membership || branchId === null) return { kind: 'notProvider' }

  // MULTI-BRANCH IS OUT OF SCOPE (spec §B): the schema stores branch_ids as an
  // ARRAY, so a user could legitimately have several. P01 takes the first and
  // this is the flag the spec asked for — a branch switcher is P03+ work.
  const { data: branch } = await supabase
    .from('branches')
    .select('name_ar, instahealth_slot_allocation, slot_duration_minutes')
    .eq('id', branchId)
    .maybeSingle()

  if (!branch) return { kind: 'notProvider' }

  return {
    kind: 'ok',
    context: {
      userId: user.id,
      email: user.email ?? null,
      displayName:
        (user.user_metadata as { full_name?: string } | null)?.full_name ??
        user.email ??
        'مكتب الاستقبال',
      branchId,
      branchNameAr: branch.name_ar,
      slotAllocation: branch.instahealth_slot_allocation ?? 0,
      slotDurationMinutes: branch.slot_duration_minutes,
    },
  }
}
