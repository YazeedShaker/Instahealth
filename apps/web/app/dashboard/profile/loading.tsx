import { DashboardHeaderSkeleton, Shimmer } from '../../../components/dashboard/BookingsSkeleton'

// Streamed while the profile loads server-side, so navigating here paints the
// shell immediately instead of leaving the previous screen up.
export default function Loading() {
  return (
    <>
      <DashboardHeaderSkeleton />
      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Shimmer width="100%" height={38} radius={8} />
          <div
            className="rounded-xl border border-ih-neutral-200 bg-white p-5"
            style={{ boxShadow: 'var(--ih-shadow-sm)' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Shimmer width={110} height={12} />
                  <Shimmer width="100%" height={44} radius={8} />
                </div>
              ))}
            </div>
          </div>
          <div
            className="rounded-xl border border-ih-neutral-200 bg-white p-5"
            style={{ boxShadow: 'var(--ih-shadow-sm)' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
