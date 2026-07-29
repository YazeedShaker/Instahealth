import {
  BookingsTableSkeleton,
  DashboardHeaderSkeleton,
  DayStripSkeleton,
  Shimmer,
} from '../../../components/dashboard/BookingsSkeleton'

// Streamed while UpcomingPage fetches the day AND the slot window. This route
// makes two round trips, so it is the one that felt stuck.
export default function Loading() {
  return (
    <>
      <DashboardHeaderSkeleton />
      <DayStripSkeleton />
      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 12 }}>
          <Shimmer width={150} height={15} />
          <Shimmer width={80} height={12} />
        </div>
        <BookingsTableSkeleton rows={3} />
      </main>
    </>
  )
}
