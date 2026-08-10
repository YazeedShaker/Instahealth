import { createClient } from '../supabase/server'

// A05 — the staff accounts' reads.
//
// ⚠ ALL RPCs, and unavoidably so: every column the list draws except the branch
// lives in `auth.users`, which no client can read at all. A SECURITY DEFINER
// function owned by postgres is the only way to join it.

/** The frame's three states. «لم يُستخدم بعد» is `last_sign_in_at IS NULL` — a
 *  fact, not an inference. Derived once, server-side. */
export type StaffState = 'active' | 'never_used' | 'disabled'

export interface StaffAccount {
  providerUserId: string
  nameAr: string | null
  email: string | null
  providerId: string
  providerNameAr: string
  branchId: string | null
  branchNameAr: string | null
  lastSignInAt: string | null
  createdAt: string
  isActive: boolean
  mustChangePassword: boolean
  state: StaffState
}

export interface StaffCounts {
  total: number
  active: number
  neverUsed: number
  disabled: number
}

export interface StaffAuditEntry {
  action: string
  source: 'admin' | 'partner'
  oldValues: Record<string, unknown>
  newValues: Record<string, unknown>
  changedAt: string
  who: string
}

export interface StaffDetail {
  account: StaffAccount & { tempPasswordIssuedAt: string | null }
  audit: StaffAuditEntry[]
}

export interface DisablePreview {
  found: boolean
  nameAr: string | null
  branchId: string | null
  branchNameAr: string | null
  activeAccountsRemaining: number
  isLastActiveAccount: boolean
  otherAccounts: { nameAr: string | null; email: string | null }[]
  upcomingBookings: number
  nearestBooking: { slotDate: string; slotTime: string; serviceNameAr: string | null } | null
  openSlots: number
  hasOpenSession: boolean
  lastSessionActivityAt: string | null
}

export async function fetchStaffAccounts(): Promise<{
  accounts: StaffAccount[]
  counts: StaffCounts
}> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_provider_staff_accounts')
  if (error) throw error
  return data as unknown as { accounts: StaffAccount[]; counts: StaffCounts }
}

export async function fetchStaffDetail(providerUserId: string): Promise<StaffDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_provider_staff_detail', {
    p_provider_user_id: providerUserId,
  })
  if (error) throw error
  const result = data as unknown as { found: boolean } & StaffDetail
  return result?.found === true ? result : null
}

export async function fetchDisablePreview(providerUserId: string): Promise<DisablePreview | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('preview_staff_disable', {
    p_provider_user_id: providerUserId,
  })
  if (error) throw error
  const result = data as unknown as DisablePreview
  return result?.found === true ? result : null
}

export interface BranchOption {
  branchId: string
  branchNameAr: string
  providerNameAr: string
}

/** The create dialog's branch picker. A plain SELECT — the admin already holds
 *  the read policies on `branches` and `providers`, and inventing an RPC would
 *  be a second definition of "which branch is live". */
export async function fetchBranchOptions(): Promise<BranchOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('branches')
    .select('id, name_ar, is_active, provider:providers!inner(name_ar, is_active)')
    .eq('is_active', true)
    .order('name_ar')
  if (error) throw error
  return (data ?? [])
    .filter((row) => row.provider.is_active !== false)
    .map((row) => ({
      branchId: row.id,
      branchNameAr: row.name_ar,
      providerNameAr: row.provider.name_ar,
    }))
}
