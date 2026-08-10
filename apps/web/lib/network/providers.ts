import type { SupabaseClient } from '@supabase/supabase-js'

// A03 — the admin's read layer for the provider network.
//
// ⚠ NO NEW RPC, ON PURPOSE. Everything here is a plain SELECT: an admin already
// reads `providers`, `branches`, `provider_commission_rates` and both history
// tables through policies that survived A03's closure. Adding a read function
// would be a second definition of "what is a provider" beside the one A02's
// statement already uses. The WRITES are all RPCs — that asymmetry is the
// write-path rule, not an inconsistency.

export interface ProviderRate {
  percent: number
  effectiveFrom: string
  note: string | null
  createdAt: string
}

export interface ProviderListRow {
  id: string
  nameAr: string
  nameEn: string
  isActive: boolean
  branchCount: number
  activeBranchCount: number
  districts: string[]
  /** The rate in force TODAY — null only if the data predates A03's guarantee
   *  that a provider cannot exist rate-less. */
  currentPercent: number | null
  updatedAt: string
}

export interface AuditEntry {
  id: string
  oldValues: Record<string, unknown>
  newValues: Record<string, unknown>
  changedAt: string
  /** null when the row came from a seed or a cron rather than a person. */
  changedBy: string | null
}

export interface BranchRow {
  id: string
  nameAr: string
  nameEn: string
  district: string | null
  isActive: boolean
  allocation: number
  lat: number | null
  lng: number | null
  updatedAt: string
}

export interface ProviderDetail {
  id: string
  nameAr: string
  nameEn: string
  isActive: boolean
  rates: ProviderRate[]
  branches: BranchRow[]
  audit: AuditEntry[]
}

/** Africa/Cairo "today" — the date every rate comparison is made against, so
 *  «سارية» means in force now rather than in force in UTC. */
export function cairoToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(now)
}

/** The rate in force on a date: the latest row whose effective_from has arrived.
 *  Mirrors `commission_rate_at` in SQL — which the client may NOT call, because
 *  A02 revoked it from `authenticated` to stop one partner reading another's
 *  percentage. Same rule, applied to rows the admin is allowed to see. */
export function rateInForce(rates: readonly ProviderRate[], on: string): ProviderRate | null {
  const eligible = rates.filter((r) => r.effectiveFrom <= on)
  if (eligible.length === 0) return null
  return eligible.reduce((latest, r) => (r.effectiveFrom > latest.effectiveFrom ? r : latest))
}

export async function fetchProviderList(supabase: SupabaseClient): Promise<ProviderListRow[]> {
  const [{ data: providers, error }, { data: rates }] = await Promise.all([
    supabase
      .from('providers')
      .select('id, name_ar, name_en, is_active, updated_at, branches(id, district, is_active)')
      .order('name_ar'),
    supabase
      .from('provider_commission_rates')
      .select('provider_id, percent, effective_from, note, created_at'),
  ])
  if (error) throw new Error(error.message)

  const today = cairoToday()
  const byProvider = new Map<string, ProviderRate[]>()
  for (const row of rates ?? []) {
    const r = row as {
      provider_id: string
      percent: number
      effective_from: string
      note: string | null
      created_at: string
    }
    const list = byProvider.get(r.provider_id) ?? []
    list.push({
      percent: Number(r.percent),
      effectiveFrom: r.effective_from,
      note: r.note,
      createdAt: r.created_at,
    })
    byProvider.set(r.provider_id, list)
  }

  return (providers ?? []).map((row) => {
    const p = row as {
      id: string
      name_ar: string
      name_en: string
      is_active: boolean
      updated_at: string
      branches: { id: string; district: string | null; is_active: boolean }[] | null
    }
    const branches = p.branches ?? []
    return {
      id: p.id,
      nameAr: p.name_ar,
      nameEn: p.name_en,
      isActive: p.is_active,
      branchCount: branches.length,
      activeBranchCount: branches.filter((b) => b.is_active).length,
      districts: [...new Set(branches.map((b) => b.district).filter((d): d is string => !!d))],
      currentPercent: rateInForce(byProvider.get(p.id) ?? [], today)?.percent ?? null,
      updatedAt: p.updated_at,
    }
  })
}

export async function fetchProviderDetail(
  supabase: SupabaseClient,
  providerId: string,
): Promise<ProviderDetail | null> {
  const [{ data: provider }, { data: rates }, { data: branches }, { data: audit }] =
    await Promise.all([
      supabase
        .from('providers')
        .select('id, name_ar, name_en, is_active')
        .eq('id', providerId)
        .maybeSingle(),
      supabase
        .from('provider_commission_rates')
        .select('percent, effective_from, note, created_at')
        .eq('provider_id', providerId)
        .order('effective_from', { ascending: false }),
      supabase
        .from('branches')
        .select(
          'id, name_ar, name_en, district, is_active, instahealth_slot_allocation, lat, lng, updated_at',
        )
        .eq('provider_id', providerId)
        .order('name_ar'),
      supabase
        .from('provider_profile_history')
        .select('id, old_values, new_values, changed_at, changed_by')
        .eq('provider_id', providerId)
        .order('changed_at', { ascending: false })
        .limit(20),
    ])

  if (!provider) return null
  const p = provider as { id: string; name_ar: string; name_en: string; is_active: boolean }

  return {
    id: p.id,
    nameAr: p.name_ar,
    nameEn: p.name_en,
    isActive: p.is_active,
    rates: (rates ?? []).map((r) => {
      const row = r as {
        percent: number
        effective_from: string
        note: string | null
        created_at: string
      }
      return {
        percent: Number(row.percent),
        effectiveFrom: row.effective_from,
        note: row.note,
        createdAt: row.created_at,
      }
    }),
    branches: (branches ?? []).map((b) => {
      const row = b as {
        id: string
        name_ar: string
        name_en: string
        district: string | null
        is_active: boolean
        instahealth_slot_allocation: number | null
        lat: number | null
        lng: number | null
        updated_at: string
      }
      return {
        id: row.id,
        nameAr: row.name_ar,
        nameEn: row.name_en,
        district: row.district,
        isActive: row.is_active,
        allocation: row.instahealth_slot_allocation ?? 5,
        lat: row.lat,
        lng: row.lng,
        updatedAt: row.updated_at,
      }
    }),
    audit: (audit ?? []).map((a) => {
      const row = a as {
        id: string
        old_values: Record<string, unknown>
        new_values: Record<string, unknown>
        changed_at: string
        changed_by: string | null
      }
      return {
        id: row.id,
        oldValues: row.old_values,
        newValues: row.new_values,
        changedAt: row.changed_at,
        changedBy: row.changed_by,
      }
    }),
  }
}

export interface BranchDetail extends BranchRow {
  providerId: string
  providerNameAr: string
  audit: AuditEntry[]
}

export async function fetchBranchDetail(
  supabase: SupabaseClient,
  branchId: string,
): Promise<BranchDetail | null> {
  const [{ data: branch }, { data: audit }] = await Promise.all([
    supabase
      .from('branches')
      .select(
        'id, provider_id, name_ar, name_en, district, is_active, instahealth_slot_allocation, lat, lng, updated_at, providers(name_ar)',
      )
      .eq('id', branchId)
      .maybeSingle(),
    supabase
      .from('branch_profile_history')
      .select('id, old_values, new_values, changed_at, changed_by')
      .eq('branch_id', branchId)
      .order('changed_at', { ascending: false })
      .limit(20),
  ])
  if (!branch) return null
  const b = branch as {
    id: string
    provider_id: string
    name_ar: string
    name_en: string
    district: string | null
    is_active: boolean
    instahealth_slot_allocation: number | null
    lat: number | null
    lng: number | null
    updated_at: string
    // ⚠ PostgREST types an embedded relation as an ARRAY even when the FK makes
    // it at most one row. Taking [0] is the honest read of what arrives.
    providers: { name_ar: string }[] | null
  }
  return {
    id: b.id,
    providerId: b.provider_id,
    providerNameAr: b.providers?.[0]?.name_ar ?? '',
    nameAr: b.name_ar,
    nameEn: b.name_en,
    district: b.district,
    isActive: b.is_active,
    allocation: b.instahealth_slot_allocation ?? 5,
    lat: b.lat,
    lng: b.lng,
    updatedAt: b.updated_at,
    audit: (audit ?? []).map((a) => {
      const row = a as {
        id: string
        old_values: Record<string, unknown>
        new_values: Record<string, unknown>
        changed_at: string
        changed_by: string | null
      }
      return {
        id: row.id,
        oldValues: row.old_values,
        newValues: row.new_values,
        changedAt: row.changed_at,
        changedBy: row.changed_by,
      }
    }),
  }
}
