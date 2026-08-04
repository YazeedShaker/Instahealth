import type { Database } from '@instahealth/core'
import type { SupabaseClient } from '@supabase/supabase-js'

// Reads and writes for the prices editor.
//
// Both go through SECURITY DEFINER functions that re-check branch membership,
// so a tampered branch id returns nothing rather than someone else's price
// list. The write additionally validates the price server-side — the client's
// guard rails are UX, not the boundary (ENGINEERING-WORKFLOW §5).

export interface BranchServiceRow {
  branchServiceId: string
  serviceId: string
  nameAr: string
  nameEn: string
  categorySlug: string
  categoryNameAr: string
  priceEgp: number
  isAvailable: boolean
  preparationNotesAr: string | null
  /** NULL when never edited — the UI shows «لم يُحدَّث بعد», never a made-up date. */
  lastChangedAt: string | null
}

type Client = SupabaseClient<Database>
type EditorRpcRow =
  Database['public']['Functions']['get_branch_services_for_editor']['Returns'][number]

function toRow(row: EditorRpcRow): BranchServiceRow {
  return {
    branchServiceId: row.branch_service_id,
    serviceId: row.service_id,
    nameAr: row.name_ar,
    nameEn: row.name_en,
    categorySlug: row.category_slug,
    categoryNameAr: row.category_name_ar,
    priceEgp: Number(row.price),
    isAvailable: row.is_available === true,
    // The generator types RETURNS TABLE columns non-nullable, but both of
    // these are NULL at runtime for never-edited / no-prep rows.
    preparationNotesAr: (row.preparation_notes_ar as string | null) ?? null,
    lastChangedAt: (row.last_changed_at as string | null) ?? null,
  }
}

export async function fetchBranchServices(
  supabase: Client,
  branchId: string,
): Promise<BranchServiceRow[]> {
  const { data, error } = await supabase.rpc('get_branch_services_for_editor', {
    p_branch_id: branchId,
  })
  if (error) throw error
  return (data ?? []).map(toRow)
}

export type UpdateServiceResult =
  | { kind: 'ok'; priceEgp: number; isAvailable: boolean; changedAt: string | null }
  /** Nothing actually differed — a success, and no audit row was written. */
  | { kind: 'unchanged' }
  /** Server refused. `reason` maps through core's getPriceErrorAr. */
  | { kind: 'rejected'; reason: string }
  | { kind: 'error' }

/**
 * Saves a price and/or availability.
 *
 * The price is sent as an integer and the SERVER decides whether it is
 * allowed — bounds and the 10x absurd-jump ratio live in
 * `update_branch_service`. The editor mirrors those rules so the desk is told
 * while typing rather than after saving, but the mirror is a courtesy: this
 * call is the one that counts.
 */
export async function updateBranchService(
  supabase: Client,
  branchServiceId: string,
  priceEgp: number,
  isAvailable: boolean,
): Promise<UpdateServiceResult> {
  const { data, error } = await supabase.rpc('update_branch_service', {
    p_branch_service_id: branchServiceId,
    p_price_egp: priceEgp,
    p_is_available: isAvailable,
  })
  if (error) return { kind: 'error' }

  // The RPC returns Json; narrowing to the function's documented result shape
  // is still a cast — Json permits property access on nothing.
  const result = data as {
    success?: boolean
    unchanged?: boolean
    error?: string
    price?: number
    is_available?: boolean
    changed_at?: string
  } | null

  if (result?.success === true) {
    if (result.unchanged === true) return { kind: 'unchanged' }
    return {
      kind: 'ok',
      priceEgp: Number(result.price ?? priceEgp),
      isAvailable: result.is_available === true,
      changedAt: result.changed_at ?? null,
    }
  }
  if (typeof result?.error === 'string') return { kind: 'rejected', reason: result.error }
  return { kind: 'error' }
}
