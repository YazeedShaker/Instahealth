import {
  DashboardHeaderSkeleton,
  DayStripSkeleton,
  Shimmer,
} from '../../../components/dashboard/BookingsSkeleton'

// Streamed while SlotsPage fetches the slot window, the day's slots AND the
// day's bookings. Both routes below the header are `force-dynamic`, so without
// this the click left the OLD screen on display with no feedback (the P02
// follow-up lesson). The skeleton mirrors the real layout — same grid, same
// card widths — so nothing jumps when the data lands.
export default function Loading() {
  return (
    <>
      <DashboardHeaderSkeleton />
      <DayStripSkeleton />
      <main className="flex min-h-0 flex-1 gap-4 overflow-y-auto px-6 pb-6 pt-4">
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--ih-neutral-0)',
            border: '1px solid var(--ih-neutral-200)',
            borderRadius: 12,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Shimmer width={110} height={15} />
            <Shimmer width={220} height={12} />
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10 }}
          >
            {Array.from({ length: 12 }, (_, index) => (
              <Shimmer key={index} width="100%" height={68} radius={10} />
            ))}
          </div>
        </div>
        <div
          style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <Shimmer width="100%" height={148} radius={12} />
          <Shimmer width="100%" height={168} radius={12} />
          <Shimmer width="100%" height={150} radius={12} />
        </div>
      </main>
    </>
  )
}
