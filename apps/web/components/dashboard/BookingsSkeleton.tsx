// Shimmering placeholders for the dashboard's loading states.
//
// Both dashboard routes are `force-dynamic` and fetch their day server-side
// BEFORE first paint, so a navigation used to sit on the old screen with no
// feedback — it read as a click that did not register. A route-level
// `loading.tsx` lets Next paint the shell instantly and stream the rows in.
//
// The skeleton MIRRORS the real layout (same grid, same row height, same
// header) so nothing jumps when the data lands.

import { BOOKINGS_GRID_WITH_ACTIONS } from './BookingRow'

export function Shimmer({
  width,
  height = 12,
  radius = 6,
}: {
  width: number | string
  height?: number
  radius?: number
}) {
  return (
    <span
      aria-hidden="true"
      className="ih-shimmer"
      style={{ display: 'block', width, height, borderRadius: radius }}
    />
  )
}

// The SAME grid the real table uses — imported, not re-typed. It was a
// duplicated literal, which meant the skeleton's columns and the loaded rows'
// columns could drift apart (and did, the moment the real grid learned to
// compress): the table would visibly jump on hydration at narrow widths.
const GRID = BOOKINGS_GRID_WITH_ACTIONS

export function BookingsTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-ih-neutral-200 bg-white"
      style={{ boxShadow: 'var(--ih-shadow-sm)' }}
    >
      <div
        className={`${GRID} border-b border-ih-neutral-200 bg-ih-neutral-50 px-4 py-2.5 text-[11.5px] font-bold text-ih-neutral-500`}
      >
        <div>الموعد</div>
        <div>المريض</div>
        <div>الخدمات</div>
        <div>الدفع</div>
        <div>الحالة</div>
        <div>الإجراء</div>
        <div />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={`${GRID} min-h-16 border-b border-ih-neutral-100 px-4`}>
          <Shimmer width={48} height={16} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <Shimmer width="70%" />
            <Shimmer width="55%" height={10} />
          </div>
          <Shimmer width="60%" />
          <Shimmer width={96} height={22} radius={8} />
          <Shimmer width={62} height={22} radius={999} />
          <Shimmer width={84} height={30} radius={8} />
          <div />
        </div>
      ))}
    </div>
  )
}

export function DashboardHeaderSkeleton() {
  return (
    <div
      style={{
        flexShrink: 0,
        background: 'var(--ih-neutral-0)',
        borderBottom: '1px solid var(--ih-neutral-200)',
        boxShadow: 'var(--ih-shadow-sm)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        minHeight: 56,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <Shimmer width={220} height={15} />
        <Shimmer width={130} height={11} />
      </div>
      <div style={{ flex: 1 }} />
      <Shimmer width={150} height={26} radius={999} />
    </div>
  )
}

export function DayStripSkeleton() {
  return (
    <div
      style={{
        flexShrink: 0,
        background: 'var(--ih-neutral-0)',
        borderBottom: '1px solid var(--ih-neutral-200)',
        padding: '12px 24px',
        display: 'flex',
        gap: 8,
        overflow: 'hidden',
      }}
    >
      {Array.from({ length: 10 }, (_, index) => (
        <div
          key={index}
          style={{
            flexShrink: 0,
            minWidth: 92,
            padding: '9px 12px',
            borderRadius: 10,
            border: '1px solid var(--ih-neutral-200)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <Shimmer width="100%" height={14} />
          <Shimmer width="100%" height={8} />
        </div>
      ))}
    </div>
  )
}
