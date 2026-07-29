import type { SupabaseClient } from '@supabase/supabase-js'

// Per-day fill for the Upcoming Days date strip.
//
// Read from `get_branch_slots`, NOT by fetching each day's bookings: the slot
// row already carries `booked_count`, which is the DATABASE's own definition of
// consumed capacity (`confirm_booking` increments it, `cancel_booking`
// decrements it). That is the identical rule core's `countBookedToday` applies
// to a day already on screen, so the strip and the list can never disagree —
// and it is one query for the whole window instead of one per day.
//
// It also caps the strip honestly: the function only returns dates that have
// generated slots, so the 30-day rolling window is a property of the data
// rather than a number duplicated in the UI (DECISION-booking-flow).

export interface BranchDay {
  isoDate: string
  booked: number
  capacity: number
}

interface SlotRow {
  slot_date: string
  booked_count: number | null
  capacity: number | null
  is_blocked: boolean | null
}

/* eslint-disable @typescript-eslint/no-explicit-any -- the dashboard's Supabase
   client is created untyped, so rpc() resolves to `any`; the row shape is
   narrowed by hand above. */
export async function fetchBranchDays(
  supabase: SupabaseClient<any, any, any>,
  branchId: string,
  fromIso: string,
  toIso: string,
): Promise<BranchDay[]> {
  const { data, error } = await supabase.rpc('get_branch_slots', {
    p_branch_id: branchId,
    p_from: fromIso,
    p_to: toIso,
  })
  if (error) throw error

  const byDate = new Map<string, BranchDay>()
  for (const row of (data ?? []) as SlotRow[]) {
    if (row.is_blocked === true) continue
    const existing = byDate.get(row.slot_date) ?? {
      isoDate: row.slot_date,
      booked: 0,
      capacity: 0,
    }
    byDate.set(row.slot_date, {
      isoDate: row.slot_date,
      booked: existing.booked + (row.booked_count ?? 0),
      capacity: existing.capacity + (row.capacity ?? 0),
    })
  }

  return [...byDate.values()].sort((a, b) => a.isoDate.localeCompare(b.isoDate))
}
/* eslint-enable @typescript-eslint/no-explicit-any */
