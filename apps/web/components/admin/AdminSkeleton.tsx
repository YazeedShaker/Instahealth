import { Shimmer } from '../dashboard/BookingsSkeleton'

// Loading states for the admin portal.
//
// ⚠ THE PARTNER PORTAL HAD FIVE `loading.tsx` FILES AND THE ADMIN PORTAL HAD
// ZERO — for every one of its seven data screens. Each is `force-dynamic` and
// fetches server-side BEFORE first paint, which is precisely the case the
// dashboard skeletons were written for: the click registers, the old screen
// stays put, and the founder clicks again. The oversight screens are the
// slowest in the product (they aggregate across every provider), so this is
// where the missing feedback cost the most.
//
// ⚠ NO NEW VISUAL LANGUAGE. `Shimmer` is imported from the dashboard's
// skeleton file rather than re-declared, so both portals shimmer with the one
// `.ih-shimmer` sweep in globals.css. A second shimmer would be a second thing
// to keep in step — the hand-copy failure mode from §3a.
//
// Every skeleton MIRRORS the real layout it stands in for (same header height,
// same `p-6` main, same card chrome) so nothing jumps when the data lands.

/** Mirrors `AdminHeader`: min-h-56, px-6 py-2.5, title over optional subtitle,
 *  the «لوحة الإدارة» pill, then the identity block pushed to the end. */
export function AdminHeaderSkeleton({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div className="flex min-h-[56px] shrink-0 flex-wrap items-center gap-4 border-b border-ih-neutral-200 bg-white px-6 py-2.5 shadow-sm">
      <div className="flex min-w-0 flex-col gap-1">
        <Shimmer width={168} height={16} />
        {subtitle ? <Shimmer width={232} height={11} /> : null}
      </div>
      <Shimmer width={96} height={22} radius={999} />
      <div className="flex-1" />
      <div className="flex items-center gap-2.5">
        <Shimmer width={28} height={28} radius={999} />
        <Shimmer width={64} height={12} />
      </div>
    </div>
  )
}

/** The card chrome every admin panel uses: white, rounded-xl, hairline border,
 *  an optional titled head. */
function Panel({ children, head = true }: { children: React.ReactNode; head?: boolean }) {
  return (
    <div
      className="overflow-hidden rounded-xl border border-ih-neutral-200 bg-white"
      style={{ boxShadow: 'var(--ih-shadow-sm)' }}
    >
      {head ? (
        <div className="border-b border-ih-neutral-200 px-5 py-4">
          <Shimmer width={160} height={14} />
        </div>
      ) : null}
      {children}
    </div>
  )
}

/** A list/table panel — the shape behind bookings, catalog, staff and network.
 *  `columns` are FRACTIONS of the row, so the skeleton compresses the way the
 *  real grids do instead of overflowing at the 1366 desktop floor. */
export function AdminTableSkeleton({
  rows = 6,
  columns = [0.18, 0.3, 0.2, 0.16, 0.16],
}: {
  rows?: number
  columns?: readonly number[]
}) {
  return (
    <Panel>
      <div
        className="grid gap-3 border-b border-ih-neutral-200 bg-ih-neutral-50 px-4 py-2.5"
        style={{ gridTemplateColumns: columns.map((c) => `${c}fr`).join(' ') }}
      >
        {columns.map((_, index) => (
          <Shimmer key={index} width="60%" height={11} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="grid min-h-14 items-center gap-3 border-b border-ih-neutral-100 px-4"
          style={{ gridTemplateColumns: columns.map((c) => `${c}fr`).join(' ') }}
        >
          {columns.map((_, col) => (
            // Varied widths so the block reads as content rather than a bar chart.
            <Shimmer key={col} width={col === 0 ? '55%' : col % 2 === 0 ? '70%' : '85%'} />
          ))}
        </div>
      ))}
    </Panel>
  )
}

/** The stat-card row on «نظرة عامة» and «التحليلات». */
export function AdminStatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3.5" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-3 rounded-xl border border-ih-neutral-200 bg-white p-5"
          style={{ boxShadow: 'var(--ih-shadow-sm)' }}
        >
          <Shimmer width="55%" height={11} />
          <Shimmer width={72} height={26} radius={8} />
          <Shimmer width="80%" height={10} />
        </div>
      ))}
    </div>
  )
}

/** A stack of text lines — the «يحتاج انتباهك» panel and the detail asides. */
export function AdminListPanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Panel>
      <div className="flex flex-col gap-3.5 px-5 py-4">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Shimmer width={26} height={26} radius={999} />
            <div className="flex flex-1 flex-col gap-1.5">
              <Shimmer width={index % 2 === 0 ? '62%' : '48%'} height={12} />
              <Shimmer width="34%" height={10} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

/** The toolbar the list screens draw above their table — search + filter chips.
 *
 *  ⚠ THE CONTROLS ARE DRAWN AS EMPTY CHROME, NOT AS BARE SHIMMERS, AND THAT IS
 *  NOT A STYLE CHOICE. `.ih-shimmer` sweeps between `--ih-neutral-100` and
 *  `--ih-neutral-50`, and the admin shell's background IS `--ih-neutral-100` —
 *  so a shimmer resting directly on the page is invisible. The first version of
 *  this toolbar was exactly that, and the capture showed a bare grey gap where
 *  the search box belongs. Everything else here survives only because it sits
 *  inside a white card. Mirror the real control's border and the placeholder
 *  reads as a control; drop the border and it reads as nothing at all.
 *
 *  (Found by reading the screenshot, which is the entire reason §9 asks.) */
export function AdminToolbarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Mirrors the real search input: 40px, 1.5px neutral-200, white. */}
      <div className="flex min-h-[40px] w-[280px] items-center rounded-lg border-[1.5px] border-ih-neutral-200 bg-white px-3.5">
        <Shimmer width="62%" height={11} />
      </div>
      <div className="flex-1" />
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="flex min-h-[30px] items-center rounded-full border border-ih-neutral-200 bg-white px-3.5"
        >
          <Shimmer width={52} height={10} />
        </div>
      ))}
    </div>
  )
}

/** The standard admin page body: `p-6`, scrollable, matching every `<main>`.
 *
 *  The testid is what lets the fidelity harness WAIT for the skeleton instead of
 *  racing it — a loading state is a latency window, and §9's rule is to
 *  reproduce the window rather than hope to catch it. */
export function AdminMain({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-testid="admin-loading"
      className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-6"
    >
      {children}
    </div>
  )
}
