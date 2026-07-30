import { DashboardHeaderSkeleton, Shimmer } from '../../../components/dashboard/BookingsSkeleton'

// Streamed while the service list loads server-side, so navigating here paints
// the shell immediately instead of leaving the previous screen up.
const GRID = 'grid grid-cols-[1fr_190px_150px_110px_150px] items-center gap-3'

export default function Loading() {
  return (
    <>
      <DashboardHeaderSkeleton />
      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <div className="mb-3">
          <Shimmer width="100%" height={38} radius={8} />
        </div>
        <div
          className="overflow-hidden rounded-xl border border-ih-neutral-200 bg-white"
          style={{ boxShadow: 'var(--ih-shadow-sm)' }}
        >
          <div
            className={`${GRID} border-b border-ih-neutral-200 bg-ih-neutral-50 px-4 py-2.5 text-[11.5px] font-bold text-ih-neutral-500`}
          >
            <div>الخدمة</div>
            <div>السعر (EGP)</div>
            <div>آخر تحديث</div>
            <div>متاحة</div>
            <div />
          </div>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className={`${GRID} min-h-16 border-b border-ih-neutral-100 px-4`}>
              <Shimmer width="55%" />
              <Shimmer width={62} height={18} />
              <Shimmer width={78} height={11} />
              <Shimmer width={44} height={26} radius={999} />
              <Shimmer width={96} height={32} radius={8} />
            </div>
          ))}
        </div>
      </main>
    </>
  )
}
