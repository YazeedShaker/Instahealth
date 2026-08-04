import type { BranchProfilePayload, Database, Json } from '@instahealth/core'
import type { SupabaseClient } from '@supabase/supabase-js'

// The branch profile surface (P05). Reads go straight at `branches` under RLS;
// the ONLY write path is the `update_branch_profile` RPC, which derives the
// branch from the caller's membership — no id travels with the payload
// (CLAUDE.md §8, migration 20260804121655).

export interface BranchProfile {
  nameAr: string
  phone: string | null
  whatsapp: string | null
  addressAr: string | null
  addressEn: string | null
  governorate: string | null
  district: string | null
  operatingHours: Json | null
  holidayMode: boolean
  isActive: boolean
  slotAllocation: number
  rating: number | null
  reviewCount: number
  /** From the audit trail — NULL when the profile has never been edited, so
   * «آخر تحديث» can be honest instead of inventing a date. */
  lastChangedAt: string | null
}

type Client = SupabaseClient<Database>

export async function fetchBranchProfile(
  supabase: Client,
  branchId: string,
): Promise<BranchProfile> {
  const [{ data: branch, error }, { data: history }] = await Promise.all([
    supabase
      .from('branches')
      .select(
        'name_ar, phone, whatsapp, address_ar, address_en, governorate, district, operating_hours, holiday_mode, is_active, instahealth_slot_allocation, rating, review_count',
      )
      .eq('id', branchId)
      .single(),
    supabase
      .from('branch_profile_history')
      .select('changed_at')
      .eq('branch_id', branchId)
      .order('changed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (error !== null || branch === null) throw new Error('branch_profile_load_failed')

  return {
    nameAr: branch.name_ar,
    phone: branch.phone,
    whatsapp: branch.whatsapp,
    addressAr: branch.address_ar,
    addressEn: branch.address_en,
    governorate: branch.governorate,
    district: branch.district,
    operatingHours: branch.operating_hours,
    holidayMode: branch.holiday_mode ?? false,
    isActive: branch.is_active ?? false,
    slotAllocation: branch.instahealth_slot_allocation ?? 0,
    rating: branch.rating,
    reviewCount: branch.review_count ?? 0,
    lastChangedAt: history?.changed_at ?? null,
  }
}

export type UpdateProfileResult =
  | { kind: 'ok' }
  | { kind: 'unchanged' }
  /** Server refused. `reason` maps through core's getProfileErrorAr. */
  | { kind: 'rejected'; reason: string }
  | { kind: 'error' }

/**
 * Saves the four branch-maintained fields. The SERVER re-validates everything —
 * core's schema is the while-typing mirror, this call is the one that counts.
 * Optional fields are sent as '' rather than null: the function's
 * NULLIF(TRIM(…)) folds empty to NULL, and the generated arg types are
 * non-nullable strings.
 */
export async function updateBranchProfile(
  supabase: Client,
  payload: BranchProfilePayload,
): Promise<UpdateProfileResult> {
  const { data, error } = await supabase.rpc('update_branch_profile', {
    p_phone: payload.phone,
    p_whatsapp: payload.whatsapp ?? '',
    p_address_ar: payload.addressAr,
    p_address_en: payload.addressEn ?? '',
  })
  if (error) return { kind: 'error' }

  const result = data as { success?: boolean; unchanged?: boolean; error?: string } | null
  if (result?.success === true) {
    return result.unchanged === true ? { kind: 'unchanged' } : { kind: 'ok' }
  }
  return { kind: 'rejected', reason: result?.error ?? 'unknown' }
}
