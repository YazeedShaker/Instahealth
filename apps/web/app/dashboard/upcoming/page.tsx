import { formatCairoIsoDate, type BranchBooking } from '@instahealth/core'
import type { Metadata } from 'next'

import { UpcomingView } from '../../../components/dashboard/UpcomingView'
import { getProviderContext } from '../../../lib/auth/provider'
import { BOOKINGS_PAGE_SIZE } from '../../../hooks/useBranchBookings'
import { fetchBranchBookings } from '../../../lib/bookings/branch-bookings'
import { fetchBranchDays, type BranchDay } from '../../../lib/bookings/branch-days'
import { createClient } from '../../../lib/supabase/server'

export const metadata: Metadata = {
  title: 'الأيام القادمة — بوابة الشركاء',
}

// Never cache: the desk's whole job is seeing what is true right now.
export const dynamic = 'force-dynamic'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function addDays(isoDate: string, days: number): string {
  const at = new Date(`${isoDate}T12:00:00Z`)
  at.setUTCDate(at.getUTCDate() + days)
  return at.toISOString().slice(0, 10)
}

export default async function UpcomingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  // The layout already redirected anyone who is not staff, so this is staff.
  const lookup = await getProviderContext()
  if (lookup.kind !== 'ok') return null
  const { context } = lookup

  const cairoTodayIso = formatCairoIsoDate(new Date())
  const tomorrowIso = addDays(cairoTodayIso, 1)
  const supabase = await createClient()

  // The window the strip can offer. `fetchBranchDays` returns only dates that
  // actually have slots, so the 30-day generation ceiling caps this by itself.
  let days: BranchDay[] = []
  try {
    days = await fetchBranchDays(
      supabase,
      context.branchId,
      tomorrowIso,
      addDays(cairoTodayIso, 30),
    )
  } catch {
    days = []
  }

  // The requested day, defaulting to tomorrow. Validated against the days the
  // branch actually has rather than trusted: a hand-edited query string can
  // only ever select one of THIS branch's days, and the RPC re-checks branch
  // membership regardless.
  const { date } = await searchParams
  const requested = typeof date === 'string' && ISO_DATE_RE.test(date) ? date : null
  const isoDate =
    requested !== null && days.some((day) => day.isoDate === requested)
      ? requested
      : (days[0]?.isoDate ?? tomorrowIso)

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
    <UpcomingView
      branchId={context.branchId}
      branchNameAr={context.branchNameAr}
      displayName={context.displayName}
      slotDurationMinutes={context.slotDurationMinutes}
      isoDate={isoDate}
      tomorrowIso={tomorrowIso}
      cairoTodayIso={cairoTodayIso}
      days={days}
      initialBookings={initialBookings}
      initialTotal={initialTotal}
      initialLoadFailed={loadFailed}
    />
  )
}
