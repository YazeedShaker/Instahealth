import type {
  CommissionStatementLine,
  CommissionStatementTotals,
  StatementEventKind,
  StatementMethod,
  StatementStatusValue,
} from '@instahealth/core'
import type { SupabaseClient } from '@supabase/supabase-js'

// A02 — the server-side read for the commission statement.
//
// ⚠ ONE RPC PER RENDER, ON PURPOSE. `get_commission_statement_view` returns the
// version history, the rows to show, the live recompute AND the change
// detection in a single round trip. Splitting them would let the snapshot and
// the live figure it is being compared against come from two different moments
// — and "the numbers moved between two reads" is exactly the failure this
// screen exists to make visible, so it must not be able to manufacture one.
//
// ⚠ MONEY CROSSES THIS BOUNDARY AS INTEGER PIASTERS and stays that way until a
// formatter renders it. There is no float anywhere in this path.

export interface StatementVersionSummary {
  id: string
  version: number
  status: StatementStatusValue
  issuedAt: string
  sentAt: string | null
  settledAt: string | null
  supersededBy: string | null
  commissionTotalPiasters: number
}

export interface StatementSnapshot {
  id: string
  version: number
  status: StatementStatusValue
  issuedAt: string
  sentAt: string | null
  settledAt: string | null
  supersededBy: string | null
  totals: CommissionStatementTotals
}

export interface CommissionStatementView {
  providerId: string
  month: string
  /** null until the month has been issued at least once — the LIVE DRAFT state. */
  statement: StatementSnapshot | null
  isDraft: boolean
  lines: readonly CommissionStatementLine[]
  liveTotals: CommissionStatementTotals
  changedSinceIssue: boolean
  deltaCommissionPiasters: number
  creditForward: boolean
  versions: readonly StatementVersionSummary[]
}

interface RawTotals {
  gmv_piasters: number | string
  commissionable_count: number
  commission_total_piasters: number | string
  excluded_count: number
  excluded_amount_piasters: number | string
}

// Postgres BIGINT arrives over PostgREST as a STRING once it could exceed the
// safe integer range. Coercing at the boundary — rather than hoping — is what
// keeps `Number(...)` out of the render path.
const asNumber = (value: number | string | null | undefined): number => Number(value ?? 0)

function mapTotals(raw: RawTotals): CommissionStatementTotals {
  return {
    gmvPiasters: asNumber(raw.gmv_piasters),
    commissionableCount: asNumber(raw.commissionable_count),
    commissionTotalPiasters: asNumber(raw.commission_total_piasters),
    excludedCount: asNumber(raw.excluded_count),
    excludedAmountPiasters: asNumber(raw.excluded_amount_piasters),
  }
}

interface RawLine {
  booking_ref: string
  booking_date: string
  method: StatementMethod
  event_date: string | null
  event_kind: StatementEventKind
  amount_piasters: number | string
  rate_percent: number | string | null
  commission_piasters: number | string
  excluded: boolean
  excluded_reason: string | null
}

interface RawView {
  provider_id: string
  month: string
  statement: {
    id: string
    version: number
    status: StatementStatusValue
    issued_at: string
    sent_at: string | null
    settled_at: string | null
    superseded_by: string | null
    totals: RawTotals
  } | null
  is_draft: boolean
  lines: RawLine[]
  live_totals: RawTotals
  changed_since_issue: boolean
  delta_commission_piasters: number | string
  credit_forward: boolean
  versions: {
    id: string
    version: number
    status: StatementStatusValue
    issued_at: string
    sent_at: string | null
    settled_at: string | null
    superseded_by: string | null
    commission_total_piasters: number | string
  }[]
}

export async function fetchCommissionStatement(
  supabase: SupabaseClient,
  providerId: string,
  month: string,
  version: number | null = null,
): Promise<CommissionStatementView> {
  const { data, error } = await supabase.rpc('get_commission_statement_view', {
    p_provider_id: providerId,
    p_month: month,
    p_version: version,
  })
  if (error) throw new Error(error.message)

  const raw = data as unknown as RawView
  return {
    providerId: raw.provider_id,
    month: raw.month,
    statement:
      raw.statement === null
        ? null
        : {
            id: raw.statement.id,
            version: raw.statement.version,
            status: raw.statement.status,
            issuedAt: raw.statement.issued_at,
            sentAt: raw.statement.sent_at,
            settledAt: raw.statement.settled_at,
            supersededBy: raw.statement.superseded_by,
            totals: mapTotals(raw.statement.totals),
          },
    isDraft: raw.is_draft,
    lines: raw.lines.map((l) => ({
      bookingRef: l.booking_ref,
      bookingDate: l.booking_date,
      method: l.method,
      eventDate: l.event_date,
      eventKind: l.event_kind,
      amountPiasters: asNumber(l.amount_piasters),
      ratePercent: l.rate_percent === null ? null : asNumber(l.rate_percent),
      commissionPiasters: asNumber(l.commission_piasters),
      excluded: l.excluded,
      excludedReason: l.excluded_reason,
    })),
    liveTotals: mapTotals(raw.live_totals),
    changedSinceIssue: raw.changed_since_issue,
    deltaCommissionPiasters: asNumber(raw.delta_commission_piasters),
    creditForward: raw.credit_forward,
    versions: raw.versions.map((v) => ({
      id: v.id,
      version: v.version,
      status: v.status,
      issuedAt: v.issued_at,
      sentAt: v.sent_at,
      settledAt: v.settled_at,
      supersededBy: v.superseded_by,
      commissionTotalPiasters: asNumber(v.commission_total_piasters),
    })),
  }
}

export interface StatementProvider {
  id: string
  nameAr: string
  branchCount: number
}

/** The partner picker's options. Admin SELECT on `providers` and `branches`
 *  already exists, so this is a plain read — no new function needed. */
export async function fetchStatementProviders(
  supabase: SupabaseClient,
): Promise<StatementProvider[]> {
  const { data, error } = await supabase
    .from('providers')
    .select('id, name_ar, branches(id)')
    .eq('is_active', true)
    .order('name_ar')
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const provider = row as { id: string; name_ar: string; branches: { id: string }[] | null }
    return {
      id: provider.id,
      nameAr: provider.name_ar,
      branchCount: provider.branches?.length ?? 0,
    }
  })
}

/** The month options: every month from the first booking to the current Cairo
 *  month. Arbitrary ranges are explicitly out of scope (SPEC-A02) — a statement
 *  is a CALENDAR MONTH, because that is what a partner is invoiced for. */
export function buildMonthOptions(now: Date, count = 12): string[] {
  const cairo = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
  }).format(now)
  const [yearRaw, monthRaw] = cairo.split('-')
  let year = Number(yearRaw)
  let month = Number(monthRaw)

  const months: string[] = []
  for (let i = 0; i < count; i += 1) {
    months.push(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`)
    month -= 1
    if (month === 0) {
      month = 12
      year -= 1
    }
  }
  return months
}
