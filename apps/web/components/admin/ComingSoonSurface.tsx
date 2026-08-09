import { AdminHeader } from './AdminHeader'

// A placeholder surface. It carries the screen's REAL title and says what will
// live there and which spec builds it — a page that only says «قيد البناء»
// teaches the founder nothing and looks broken.
//
// ⚠ Deliberately NOT used for التحليلات. That screen has a FINISHED design in
// the handoff (five approved questions + an activation rule), so SPEC-A01 says
// to render it as designed. A real design rendered as a stub would be a
// regression, not a placeholder.
export function ComingSoonSurface({
  title,
  spec,
  summary,
  bullets,
  testId,
}: {
  title: string
  spec: string
  summary: string
  bullets: readonly string[]
  testId: string
}) {
  return (
    <>
      <AdminHeader title={title} displayName="مؤسِّس" soon />
      <main data-testid={testId} className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-[20px] font-extrabold text-ih-neutral-800">{title}</h2>
            <p className="text-[13.5px] leading-[1.8] text-ih-neutral-600">{summary}</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-ih-neutral-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-ih-neutral-200 px-[18px] py-3.5">
              <span className="text-[14.5px] font-bold text-ih-neutral-800">
                ما ستفعله هذه الصفحة
              </span>
              <span
                data-testid={`${testId}-spec`}
                className="shrink-0 text-[11.5px] text-ih-neutral-500"
              >
                {spec}
              </span>
            </div>
            {bullets.map((bullet) => (
              <div
                key={bullet}
                className="border-b border-ih-neutral-100 px-[18px] py-3.5 text-[13px] leading-[1.7] text-ih-neutral-700 last:border-b-0"
              >
                {bullet}
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
