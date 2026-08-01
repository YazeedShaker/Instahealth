import { formatCairoIsoDate } from '@instahealth/core'
import type { Metadata } from 'next'

import { SlotAllocationView } from '../../../components/dashboard/SlotAllocationView'
import { getProviderContext } from '../../../lib/auth/provider'
import { fetchBranchDays, type BranchDay } from '../../../lib/bookings/branch-days'
import { fetchBranchAllocationDay, type AllocationSlotRow } from '../../../lib/slots/branch-slots'
import { createClient } from '../../../lib/supabase/server'

export const metadata: Metadata = {
  title: 'المواعيد المتاحة — بوابة الشركاء',
}

// Never cache: the desk's whole job is seeing what is true right now.
export const dynamic = 'force-dynamic'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function addDays(isoDate: string, days: number): string {
  const at = new Date(`${isoDate}T12:00:00Z`)
  at.setUTCDate(at.getUTCDate() + days)
  return at.toISOString().slice(0, 10)
}

/** "HH:MM" in Cairo — injected into the view so "has this slot started?" is
 * decided once, on the server, instead of each client guessing from its own
 * clock. Slots are Egyptian wall-clock times; a desk laptop set to the wrong
 * timezone must not change which slots read as past. */
function cairoNowHHMM(now: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)
}

export default async function SlotsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  // The layout already redirected anyone who is not staff, so this is staff.
  const lookup = await getProviderContext()
  if (lookup.kind !== 'ok') return null
  const { context } = lookup

  const now = new Date()
  const cairoTodayIso = formatCairoIsoDate(now)
  const supabase = await createClient()

  // The window the strip can offer. Unlike Upcoming Days this STARTS TODAY —
  // the branch's allocation for today is the thing a desk checks most. Only
  // dates with generated slots come back, so the 30-day ceiling caps it by
  // itself rather than being a number repeated in the UI.
  let days: BranchDay[] = []
  try {
    days = await fetchBranchDays(
      supabase,
      context.branchId,
      cairoTodayIso,
      addDays(cairoTodayIso, 30),
    )
  } catch {
    days = []
  }

  // ⚠ NEVER DERIVE SCOPE FROM THE URL (ENGINEERING-WORKFLOW §6a). The date is
  // validated against the days THIS branch actually has, and `branchId` comes
  // from the server-side provider_users lookup — a hand-edited query string can
  // only ever pick one of this branch's own days.
  const { date } = await searchParams
  const requested = typeof date === 'string' && ISO_DATE_RE.test(date) ? date : null
  const isoDate =
    requested !== null && days.some((day) => day.isoDate === requested)
      ? requested
      : days.some((day) => day.isoDate === cairoTodayIso)
        ? cairoTodayIso
        : (days[0]?.isoDate ?? cairoTodayIso)

  let slots: AllocationSlotRow[] = []
  let loadFailed = false
  try {
    slots = await fetchBranchAllocationDay(supabase, context.branchId, isoDate)
  } catch {
    loadFailed = true
  }

  return (
    <SlotAllocationView
      branchNameAr={context.branchNameAr}
      slotAllocation={context.slotAllocation}
      slotDurationMinutes={context.slotDurationMinutes}
      isoDate={isoDate}
      cairoTodayIso={cairoTodayIso}
      tomorrowIso={addDays(cairoTodayIso, 1)}
      cairoNowHHMM={cairoNowHHMM(now)}
      days={days}
      slots={slots}
      loadFailed={loadFailed}
    />
  )
}
