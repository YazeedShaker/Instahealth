import { CURRENCY, SLOT_HOLD_MINUTES } from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'

// Placeholder — proves tokens, fonts, and RTL work on web.
// Becomes a redirect to /provider or /admin once those surfaces exist.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-8">
      {/* Arabic heading in Cairo (dir="rtl" on <html> switches the font stack) */}
      <h1
        className="text-3xl"
        style={{
          fontFamily: 'var(--font-cairo)',
          fontWeight: 700,
          color: 'var(--ih-neutral-900)',
        }}
      >
        إنستاهيلث — منصة الحجوزات الطبية
      </h1>

      {/* English subtitle in Atkinson Hyperlegible */}
      <p
        dir="ltr"
        className="text-base"
        style={{ fontFamily: 'var(--font-atkinson)', color: 'var(--ih-text-secondary)' }}
      >
        InstaHealth — provider dashboard &amp; admin (web shell)
      </p>

      {/* Cream accent element via token */}
      <div
        className="rounded-ih-md p-4"
        style={{ background: 'var(--ih-accent-300)', color: 'var(--ih-primary-700)' }}
      >
        ملاحظات التحضير تظهر هنا — لون الكريم هو بصمتنا البصرية
      </div>

      {/* Primary CTA using the teal token (via token, not hardcoded) */}
      <button
        type="button"
        className="rounded-ih-md px-6 py-4 text-base"
        style={{
          background: 'var(--ih-primary-400)',
          color: 'var(--ih-text-on-primary)',
          fontFamily: 'var(--font-cairo)',
          fontWeight: 600,
        }}
      >
        لوحة تحكم مقدّم الخدمة
      </button>

      <p dir="ltr" className="text-xs" style={{ color: 'var(--ih-neutral-400)' }}>
        core: {CURRENCY} · hold {SLOT_HOLD_MINUTES}m · tokens resolve: {colors.primary[400]}
      </p>
    </main>
  )
}
