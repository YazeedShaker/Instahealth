import type { BranchBooking } from '@instahealth/core'
import type { SupabaseClient } from '@supabase/supabase-js'

// Reads for the Today view. ALWAYS through get_branch_bookings_for_date, never
// a table query: `users` has no provider SELECT policy, so a receptionist
// cannot read the patient name and phone the desk exists to use. The function
// re-checks branch membership internally, so the branch id below being wrong
// (or tampered with) returns zero rows rather than someone else's day.

interface BranchBookingRow {
  id: string
  booking_ref: string | null
  status: string
  payment_status: string | null
  payment_method: string | null
  total_amount: number | null
  patient_notes: string | null
  slot_id: string
  slot_time: string
  created_at: string
  arrived_at: string | null
  completed_at: string | null
  no_show_at: string | null
  cancelled_at: string | null
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
    slotTime: row.slot_time,
    createdAt: row.created_at,
    arrivedAt: row.arrived_at,
    completedAt: row.completed_at,
    noShowAt: row.no_show_at,
    cancelledAt: row.cancelled_at,
    patientNameAr: row.patient_name_ar,
    patientPhone: row.patient_phone,
    services: parseServices(row.services),
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the generated Database
   type does not yet carry these two RPCs; the row shape is narrowed by hand
   above and by the DTOs the functions declare. */
export async function fetchBranchBookings(
  supabase: SupabaseClient<any, any, any>,
  branchId: string,
  isoDate: string,
): Promise<BranchBooking[]> {
  const { data, error } = await supabase.rpc('get_branch_bookings_for_date', {
    p_branch_id: branchId,
    p_date: isoDate,
  })
  if (error) throw error
  return ((data ?? []) as BranchBookingRow[]).map(toBranchBooking)
}

export type MarkOutcomeResult =
  | { kind: 'ok' }
  /** The row moved under us — someone else marked it, or it was cancelled. */
  | { kind: 'illegalTransition'; from: string; to: string }
  | { kind: 'notAllowed' }
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
  if (result?.error === 'booking_not_found') return { kind: 'notAllowed' }
  return { kind: 'error' }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
