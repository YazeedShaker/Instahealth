import { SLOT_WINDOW_DAYS, type SlotSectionInput } from '@instahealth/core'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '../../lib/supabase'

const CAIRO_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' })
const DAY_MS = 24 * 60 * 60 * 1000
// 24/7 branch at 30-min slots = 48/day; the 30-day window tops out ~1.5k rows.

/** Every slot in the booking window for this branch via the get_branch_slots
 * RPC — the DB computes active unexpired hold counts (invisible to the client
 * under RLS), so displayed availability evaluates the SAME predicate
 * create_slot_hold enforces. Grouping/labels/status happen in core. */
export function useBookingSlots(branchId: string | null) {
  return useQuery({
    queryKey: ['booking', 'slots', branchId],
    enabled: branchId !== null,
    queryFn: async (): Promise<SlotSectionInput[]> => {
      const now = new Date()
      const today = CAIRO_DATE.format(now)
      const windowEnd = CAIRO_DATE.format(new Date(now.getTime() + SLOT_WINDOW_DAYS * DAY_MS))

      const { data, error } = await supabase.rpc('get_branch_slots', {
        p_branch_id: branchId as string,
        p_from: today,
        p_to: windowEnd,
      })
      if (error) throw error

      return data.map((slot) => ({
        id: slot.id,
        slotDate: slot.slot_date,
        slotTime: slot.slot_time,
        capacity: slot.capacity,
        bookedCount: slot.booked_count,
        isBlocked: slot.is_blocked,
        activeHoldCount: slot.active_hold_count,
      }))
    },
    // Multi-device liveness: another patient releasing/expiring a hold must
    // show up while THIS phone sits on the picker — RN has no window-focus
    // refetch, so poll while the screen is mounted.
    staleTime: 10 * 1000,
    refetchOnMount: 'always',
    refetchInterval: 15 * 1000,
  })
}
