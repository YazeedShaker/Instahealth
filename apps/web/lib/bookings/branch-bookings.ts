import type { BranchBooking } from '@instahealth/core'
import type { SupabaseClient } from '@supabase/supabase-js'

// Reads for the dashboard. ALWAYS through get_branch_bookings_for_date, never
// a table query: `users` has no provider SELECT policy, so a receptionist
// cannot read the patient name and phone the desk exists to use. The function
// re-checks branch membership internally, so the branch id below being wrong
// (or tampered with) returns zero rows rather than someone else's day.
//
// P02 widened the function rather than joining from the client — the same rule
// F07 set for get_patient_bookings: add columns to the function.

interface BranchBookingRow {
  id: string
  booking_ref: string | null
  status: string
  payment_status: string | null
  payment_method: string | null
  total_amount: number | null
  patient_notes: string | null
  slot_id: string
  slot_date: string
  slot_time: string
  created_at: string
  confirmed_at: string | null
  arrived_at: string | null
  completed_at: string | null
  no_show_at: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  cancellation_reason: string | null
  closed_by: string | null
  patient_name_ar: string | null
  patient_phone: string | null
  services: unknown
}

function parseServices(value: unknown): BranchBooking['services'] {
  if (!Array.isArray(value)) return []
  const services: BranchBooking['services'] = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue
    const row = entry as Record<string, unknown>
    if (typeof row.id !== 'string') continue
    services.push({
      id: row.id,
      nameAr: typeof row.nameAr === 'string' ? row.nameAr : '',
      nameEn: typeof row.nameEn === 'string' ? row.nameEn : '',
      priceEgp: Number(row.priceEgp ?? 0),
      preparationNotesAr:
        typeof row.preparationNotesAr === 'string' ? row.preparationNotesAr : null,
      preparationNotesEn:
        typeof row.preparationNotesEn === 'string' ? row.preparationNotesEn : null,
    })
  }
  return services
}

/** Narrow the two discriminators to their domain unions. Anything unexpected
 * becomes null rather than a bogus label — the drawer would otherwise attribute
 * a cancellation to a party that does not exist. */
function parseCancelledBy(value: string | null): BranchBooking['cancelledBy'] {
  return value === 'patient' || value === 'provider' || value === 'admin' ? value : null
}

function parseClosedBy(value: string | null): BranchBooking['closedBy'] {
  return value === 'provider' || value === 'admin' || value === 'system' ? value : null
}

function toBranchBooking(row: BranchBookingRow): BranchBooking {
  return {
    id: row.id,
    bookingRef: row.booking_ref,
    status: row.status as BranchBooking['status'],
    paymentStatus: (row.payment_status ?? 'pending') as BranchBooking['paymentStatus'],
    method: row.payment_method,
    totalEgp: Number(row.total_amount ?? 0),
    patientNotes: row.patient_notes,
    slotId: row.slot_id,
    slotDate: row.slot_date,
    slotTime: row.slot_time,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    arrivedAt: row.arrived_at,
    completedAt: row.completed_at,
    noShowAt: row.no_show_at,
    cancelledAt: row.cancelled_at,
    cancelledBy: parseCancelledBy(row.cancelled_by),
    cancellationReason: row.cancellation_reason,
    closedBy: parseClosedBy(row.closed_by),
    patientNameAr: row.patient_name_ar,
    patientPhone: row.patient_phone,
    services: parseServices(row.services),
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the generated Database
   type now carries these RPCs, but the dashboard's Supabase client is created
   untyped (createClient() in lib/supabase/client.ts), so the rpc() overloads
   still resolve to `any` here. The row shape is narrowed by hand above. */
/** What the desk asked the DATABASE for. Filtering happens server-side so the
 * client never holds a whole branch's history to search through it. */
export interface BranchBookingsQuery {
  search?: string
  status?: string | null
  limit?: number
  offset?: number
}

export interface BranchBookingsPage {
  bookings: BranchBooking[]
  /** Rows matching the FILTER, not the page — the count the pager needs. */
  total: number
}

export async function fetchBranchBookings(
  supabase: SupabaseClient<any, any, any>,
  branchId: string,
  isoDate: string,
  query: BranchBookingsQuery = {},
): Promise<BranchBookingsPage> {
  const { data, error } = await supabase.rpc('get_branch_bookings_for_date', {
    p_branch_id: branchId,
    p_date: isoDate,
    p_search: query.search?.trim() ? query.search.trim() : null,
    p_status: query.status ?? null,
    p_limit: query.limit ?? null,
    p_offset: query.offset ?? 0,
  })
  if (error) throw error

  const rows = (data ?? []) as (BranchBookingRow & { total_count: number | null })[]
  return {
    bookings: rows.map(toBranchBooking),
    // An empty page reports no total, and zero IS the right answer there.
    total: rows.length > 0 ? Number(rows[0]?.total_count ?? rows.length) : 0,
  }
}

export type MarkOutcomeResult =
  | { kind: 'ok' }
  /** The row moved under us — someone else marked it, or it was cancelled. */
  | { kind: 'illegalTransition'; from: string; to: string }
  | { kind: 'notAllowed' }
  /** The slot is on a later day. Enforced server-side since migration
   * 20260729021321; the UI hides the action too, so seeing this means the two
   * disagreed and the SERVER won — which is the correct outcome. */
  | { kind: 'slotInFuture' }
  | { kind: 'error' }

export async function markBookingOutcome(
  supabase: SupabaseClient<any, any, any>,
  bookingId: string,
  outcome: 'arrived' | 'completed' | 'no_show',
): Promise<MarkOutcomeResult> {
  const { data, error } = await supabase.rpc('mark_booking_outcome', {
    p_booking_id: bookingId,
    p_outcome: outcome,
  })
  if (error) return { kind: 'error' }

  const result = data as { success?: boolean; error?: string; from?: string; to?: string } | null
  // `unchanged: true` is also success — the RPC is idempotent so a double-click
  // must not raise a second error toast.
  if (result?.success === true) return { kind: 'ok' }
  if (result?.error === 'illegal_transition') {
    return { kind: 'illegalTransition', from: result.from ?? '', to: result.to ?? '' }
  }
  if (result?.error === 'slot_in_future') return { kind: 'slotInFuture' }
  if (result?.error === 'booking_not_found') return { kind: 'notAllowed' }
  return { kind: 'error' }
}

export type CancelOnBehalfResult =
  | { kind: 'ok' }
  /** Already completed or already cancelled — the row moved under us. */
  | { kind: 'notCancellable'; status: string }
  | { kind: 'notAllowed' }
  | { kind: 'error' }

/**
 * Cancel on the patient's behalf — the desk taking a phone cancellation.
 *
 * Goes through the same `cancel_booking` the patient app uses. Branch staff
 * have been authorized callers since F07's fix, and are deliberately EXEMPT
 * from the slot-start boundary that binds a patient, so reception can close out
 * a booking whose time has already passed.
 *
 * `p_cancelled_by: 'provider'` is a CLAIM the server verifies against the
 * caller's real capacity (migration 20260729021321) — before that the database
 * wrote whatever it was told, and a patient could label their own cancellation
 * as the branch's. If this ever returns `invalid_canceller`, the signed-in user
 * is not actually staff for the booking's branch.
 */
export async function cancelBookingOnBehalf(
  supabase: SupabaseClient<any, any, any>,
  bookingId: string,
  reasonAr: string,
): Promise<CancelOnBehalfResult> {
  const { data, error } = await supabase.rpc('cancel_booking', {
    p_booking_id: bookingId,
    p_reason: reasonAr,
    p_cancelled_by: 'provider',
  })
  if (error) return { kind: 'error' }

  const result = data as { success?: boolean; error?: string; status?: string } | null
  if (result?.success === true) return { kind: 'ok' }
  if (result?.error === 'cannot_cancel') {
    return { kind: 'notCancellable', status: result.status ?? '' }
  }
  // `booking_not_found` is deliberately indistinguishable from a missing row —
  // the function never confirms a stranger's booking id exists.
  if (result?.error === 'booking_not_found' || result?.error === 'invalid_canceller') {
    return { kind: 'notAllowed' }
  }
  return { kind: 'error' }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
