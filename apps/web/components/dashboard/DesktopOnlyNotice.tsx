import { Logo } from '../ui/Logo'

// The calm "this is a desktop tool" screen, shown INSTEAD of a broken
// half-render when the viewport cannot carry the dashboard (SPEC/DESIGN-02:
// desktop-first, 1366×768 floor — this is the graceful floor, not a mobile
// layout).
//
// ⚠ WHY THIS IS PURE CSS, and why the breakpoint is not simply 1024:
//
// Browser zoom SHRINKS the CSS viewport, so a real desk machine reports a
// narrow width. Measured: 1366 @125% = 1093px, @150% = 911px. A naive
// `max-width: 1023px` gate would therefore tell a receptionist on her actual
// office desktop, who zoomed to 150% because she cannot read 12px text, to
// "use a computer" — the exact insult this screen exists to avoid.
//
// So the gate is two conditions, and each one carries its own justification:
//
//   1. `max-width: 859px` — below this NOTHING can render the table, whatever
//      the device. It sits comfortably under the 911px that 150% zoom produces
//      at the 1366 floor, so legitimate zoom always keeps the dashboard.
//   2. `max-width: 1023px AND pointer: coarse` — a TOUCH device that narrow is
//      a phone or a small tablet, never a zoomed desk machine. This is what
//      catches a phone in LANDSCAPE (up to 932px), which width alone cannot
//      distinguish from a zoomed desktop.
//
// The copy names all three real causes (small screen, narrow window, heavy
// zoom) because the person seeing it cannot be assumed to know which applies.
export function DesktopOnlyNotice() {
  return (
    <div
      data-too-narrow=""
      dir="rtl"
      style={{
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: 'var(--ih-neutral-100)',
        boxSizing: 'border-box',
      }}
    >
      <div
        data-testid="desktop-only-notice"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          maxWidth: 380,
          textAlign: 'center',
          background: 'var(--ih-neutral-0)',
          border: '1px solid var(--ih-neutral-200)',
          borderRadius: 12,
          boxShadow: 'var(--ih-shadow-sm)',
          padding: 32,
        }}
      >
        <Logo size={44} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--ih-neutral-800)' }}>
            لوحة التحكم مصممة لشاشة الكمبيوتر
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              lineHeight: 1.7,
              color: 'var(--ih-neutral-600)',
            }}
          >
            افتحها على جهاز المكتب، أو وسّع النافذة، أو قلّل تكبير المتصفح — لتظهر قائمة حجوزات
            اليوم كاملة.
          </p>
        </div>
        <a
          data-testid="desktop-only-support"
          href="mailto:partners@instahealth.eg"
          dir="ltr"
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: 'var(--ih-primary-600)',
            textDecoration: 'none',
          }}
        >
          partners@instahealth.eg
        </a>
      </div>
    </div>
  )
}
