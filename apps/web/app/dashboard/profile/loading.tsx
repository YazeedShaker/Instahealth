import { DashboardHeaderSkeleton, Shimmer } from '../../../components/dashboard/BookingsSkeleton'

// Streamed while the profile loads server-side. Mirrors the Branch Details
// layout: editable card beside the 380px locked card, so nothing jumps.
export default function Loading() {
  return (
    <>
      <DashboardHeaderSkeleton />
      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div
            className="overflow-hidden rounded-xl border border-ih-neutral-200 bg-white"
            style={{ flex: 1, minWidth: 0, boxShadow: 'var(--ih-shadow-sm)' }}
          >
            <div className="border-b border-ih-neutral-200 px-5 py-4">
              <Shimmer width={180} height={15} />
            </div>
            <div className="flex flex-col gap-4 p-5">
              <Shimmer width="100%" height={40} radius={8} />
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <Shimmer width={110} height={12} />
                  <Shimmer width="100%" height={48} radius={8} />
                </div>
              ))}
            </div>
            <div className="border-t border-ih-neutral-200 bg-ih-neutral-50 px-5 py-3.5">
              <Shimmer width={220} height={12} />
            </div>
          </div>
          <div
            className="overflow-hidden rounded-xl border border-ih-neutral-200 bg-white"
            style={{ width: 380, flexShrink: 0, boxShadow: 'var(--ih-shadow-sm)' }}
          >
            <div className="border-b border-ih-neutral-200 px-5 py-4">
              <Shimmer width={140} height={15} />
            </div>
            <div className="flex flex-col gap-3 px-5 py-3">
              {Array.from({ length: 5 }, (_, index) => (
                <Shimmer key={index} width={index % 2 === 0 ? '70%' : '50%'} height={13} />
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
