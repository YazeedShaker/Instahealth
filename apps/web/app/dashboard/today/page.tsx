import { formatCairoIsoDate, type BranchBooking } from '@instahealth/core'
import type { Metadata } from 'next'

import { getProviderContext } from '../../../lib/auth/provider'
import { createClient } from '../../../lib/supabase/server'
import { BOOKINGS_PAGE_SIZE } from '../../../hooks/useBranchBookings'
import { fetchBranchBookings } from '../../../lib/bookings/branch-bookings'
import { TodayView } from '../../../components/dashboard/TodayView'

export const metadata: Metadata = {
  title: 'اليوم — بوابة الشركاء',
}

// Never cache: the desk's whole job is seeing what is true right now.
export const dynamic = 'force-dynamic'

export default async function TodayPage() {
  // The layout already redirected anyone who is not staff, so this is staff.
  const lookup = await getProviderContext()
  if (lookup.kind !== 'ok') return null
  const { context } = lookup

  // Today in CAIRO, not in the server's timezone — slots are Egypt wall clock,
  // so a Frankfurt-hosted render must still ask for the Egyptian date. Shared
  // with the future-day predicate in core, so both sides mean the same "today".
  const isoDate = formatCairoIsoDate(new Date())
  const supabase = await createClient()

  // Server-rendered first paint: the desk sees today's list immediately rather
  // than a skeleton that resolves after hydration.
  // Server-rendered first paint: page one, unfiltered. The client re-queries
  // only once the desk searches, filters or pages.
  let initialBookings: BranchBooking[] = []
  let initialTotal = 0
  let loadFailed = false
  try {
    const page = await fetchBranchBookings(supabase, context.branchId, isoDate, {
      limit: BOOKINGS_PAGE_SIZE,
      offset: 0,
    })
    initialBookings = page.bookings
    initialTotal = page.total
  } catch {
    loadFailed = true
  }

  return (
    <TodayView
      branchId={context.branchId}
      branchNameAr={context.branchNameAr}
      displayName={context.displayName}
      slotAllocation={context.slotAllocation}
      slotDurationMinutes={context.slotDurationMinutes}
      isoDate={isoDate}
      initialBookings={initialBookings}
      initialTotal={initialTotal}
      initialLoadFailed={loadFailed}
    />
  )
}
