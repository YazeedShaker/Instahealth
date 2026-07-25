import { SLOT_WINDOW_DAYS, type SlotSectionInput } from '@instahealth/core'
import { useQuery } from '@tanstack/react-query'

import { supabase } from '../../lib/supabase'

const CAIRO_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' })
const DAY_MS = 24 * 60 * 60 * 1000
// 24/7 branch at 30-min slots = 48/day; the 30-day window tops out ~1.5k rows.
const SLOT_QUERY_LIMIT = 2000

/** Every slot row in the booking window for this branch — one fetch, ordered
 * (date, time). Grouping/labels/status happen in core's buildSlotDaySections. */
export function useBookingSlots(branchId: string | null) {
  return useQuery({
    queryKey: ['booking', 'slots', branchId],
    enabled: branchId !== null,
    queryFn: async (): Promise<SlotSectionInput[]> => {
      const now = new Date()
      const today = CAIRO_DATE.format(now)
      const windowEnd = CAIRO_DATE.format(new Date(now.getTime() + SLOT_WINDOW_DAYS * DAY_MS))

      const { data, error } = await supabase
        .from('slots')
        .select('id, slot_date, slot_time, capacity, booked_count, is_blocked')
        .eq('branch_id', branchId as string)
        .gte('slot_date', today)
        .lte('slot_date', windowEnd)
        .order('slot_date', { ascending: true })
        .order('slot_time', { ascending: true })
        .limit(SLOT_QUERY_LIMIT)
      if (error) throw error

      return data.map((slot) => ({
        id: slot.id,
        slotDate: slot.slot_date,
        slotTime: slot.slot_time,
        capacity: slot.capacity,
        bookedCount: slot.booked_count,
        isBlocked: slot.is_blocked,
      }))
    },
    staleTime: 30 * 1000,
  })
}
