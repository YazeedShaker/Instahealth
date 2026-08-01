import type { AllocationSlot } from '@instahealth/core'
import type { SupabaseClient } from '@supabase/supabase-js'

// The branch's daily slot picture for the P04 allocation view.
//
// ⚠ NO NEW RPC, ON PURPOSE. `get_branch_slots` is the SAME function the patient
// picker reads, and it already returns `active_hold_count` — the one number the
// desk cannot see in the raw table, because holds are invisible under RLS. Any
// second reader would be a second definition of "is this slot free", which is
// exactly what SPEC-P04's consistency section forbids.
//
// ⚠ AND IT DOES NOT SCOPE ITSELF. SPEC-P04 says "RLS already scopes reads to
// the member's branch — verify, don't assume." Verified: it does NOT.
// `get_branch_slots(p_branch_id, …)` takes the branch as an ARGUMENT and is
// granted to `anon`, so it answers for whatever branch it is handed. That is
// deliberate — the patient app browses any branch's free times, and a slot grid
// carries no PII. The dashboard is safe for a different reason: `branchId` comes
// from the server-side `provider_users` lookup and never from the URL
// (ENGINEERING-WORKFLOW §6a). Patient NAMES come from
// `get_branch_bookings_for_date`, which DOES enforce branch membership.

export interface AllocationSlotRow extends AllocationSlot {
  id: string
  /** Present only when this branch's own booking read returned one. */
  patientNameAr: string | null
}

interface SlotRpcRow {
  id: string
  slot_date: string
  slot_time: string
  capacity: number | null
  booked_count: number | null
  is_blocked: boolean | null
  active_hold_count: number | null
}

interface BookingRpcRow {
  slot_id: string
  patient_name_ar: string | null
  status: string | null
}

/** Statuses that no longer occupy the slot. `cancel_booking` decrements
 * `booked_count`, so the slot itself is already free — carrying the old name
 * onto it would label a bookable slot with a patient who is not coming. */
const RELEASED_STATUSES = new Set(['cancelled'])

/* eslint-disable @typescript-eslint/no-explicit-any -- the dashboard's Supabase
   client is created untyped, so rpc() resolves to `any`; row shapes are
   narrowed by hand above. */
export async function fetchBranchAllocationDay(
  supabase: SupabaseClient<any, any, any>,
  branchId: string,
  isoDate: string,
): Promise<AllocationSlotRow[]> {
  // Both reads are independent — issue them together rather than in sequence
  // (CLAUDE.md §5: Promise.all for independent async calls).
  const [slotsResult, bookingsResult] = await Promise.all([
    supabase.rpc('get_branch_slots', {
      p_branch_id: branchId,
      p_from: isoDate,
      p_to: isoDate,
    }),
    supabase.rpc('get_branch_bookings_for_date', {
      p_branch_id: branchId,
      p_date: isoDate,
      p_limit: 200,
      p_offset: 0,
    }),
  ])
  if (slotsResult.error) throw slotsResult.error

  // A failed NAME lookup must not cost the desk the whole grid: the slot states
  // are the point of the screen, the names are an enrichment. Degrade, don't
  // blank.
  const namesBySlot = new Map<string, string>()
  if (bookingsResult.error === null) {
    for (const booking of (bookingsResult.data ?? []) as BookingRpcRow[]) {
      if (booking.status !== null && RELEASED_STATUSES.has(booking.status)) continue
      if (booking.patient_name_ar === null) continue
      namesBySlot.set(booking.slot_id, booking.patient_name_ar)
    }
  }

  return ((slotsResult.data ?? []) as SlotRpcRow[])
    .map((row) => ({
      id: row.id,
      slotDate: row.slot_date,
      slotTime: row.slot_time,
      capacity: row.capacity ?? 0,
      bookedCount: row.booked_count ?? 0,
      activeHoldCount: row.active_hold_count ?? 0,
      isBlocked: row.is_blocked ?? false,
      patientNameAr: namesBySlot.get(row.id) ?? null,
    }))
    .sort((a, b) => a.slotTime.localeCompare(b.slotTime))
}
