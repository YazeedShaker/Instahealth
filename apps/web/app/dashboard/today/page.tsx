import type { BranchBooking } from '@instahealth/core'
import type { Metadata } from 'next'

import { getProviderContext } from '../../../lib/auth/provider'
import { createClient } from '../../../lib/supabase/server'
import { fetchBranchBookings } from '../../../lib/bookings/branch-bookings'
import { TodayView } from '../../../components/dashboard/TodayView'

export const metadata: Metadata = {
  title: 'اليوم — بوابة الشركاء',
}

// Never cache: the desk's whole job is seeing what is true right now.
export const dynamic = 'force-dynamic'

/** Today in CAIRO, not in the server's timezone — slots are Egypt wall clock,
 * so a Frankfurt-hosted render must still ask for the Egyptian date. */
function cairoToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
}

export default async function TodayPage() {
  // The layout already redirected anyone who is not staff, so this is staff.
  const lookup = await getProviderContext()
  if (lookup.kind !== 'ok') return null
  const { context } = lookup

  const isoDate = cairoToday()
  const supabase = await createClient()

  // Server-rendered first paint: the desk sees today's list immediately rather
  // than a skeleton that resolves after hydration.
  let initialBookings: BranchBooking[]
  let loadFailed = false
  try {
    initialBookings = await fetchBranchBookings(supabase, context.branchId, isoDate)
  } catch {
    initialBookings = []
    loadFailed = true
  }

  return (
    <TodayView
      branchId={context.branchId}
      branchNameAr={context.branchNameAr}
      displayName={context.displayName}
      slotAllocation={context.slotAllocation}
      isoDate={isoDate}
      initialBookings={initialBookings}
      initialLoadFailed={loadFailed}
    />
  )
}
