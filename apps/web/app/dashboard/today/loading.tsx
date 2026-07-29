import {
  BookingsTableSkeleton,
  DashboardHeaderSkeleton,
} from '../../../components/dashboard/BookingsSkeleton'

// Streamed while TodayPage fetches server-side. Next swaps this for the real
// screen the moment the data lands, so the shell is on screen immediately
// instead of the previous page sitting there looking unresponsive.
export default function Loading() {
  return (
    <>
      <DashboardHeaderSkeleton />
      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <BookingsTableSkeleton />
      </main>
    </>
  )
}
