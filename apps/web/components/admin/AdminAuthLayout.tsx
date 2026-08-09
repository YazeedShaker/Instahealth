import { ADMIN_ACCENT, ADMIN_PILL } from '@instahealth/design-tokens'
import type { ReactNode } from 'react'

import { Logo } from '../ui/Logo'

// The two-panel login chrome from `Admin - Login and TOTP.dc.html`: the form on
// the reading side, and a fixed 460px DEEP-INK authority panel opposite it that
// says why a second step exists. Screens A, B and C all use it with different
// panel copy; the enrollment screen (D) deliberately does NOT — it is a centred
// card, because enrollment is a task, not a doorway.
export function AdminAuthLayout({
  children,
  panelTitle,
  panelBody,
  panelBullets,
  panelFootnote,
}: {
  children: ReactNode
  panelTitle: ReactNode
  panelBody?: string
  panelBullets?: readonly string[]
  panelFootnote?: string
}) {
  return (
    <div dir="rtl" className="flex min-h-screen bg-white font-arabic">
      <div className="flex min-w-0 flex-1 items-center justify-center p-10">
        <div className="flex w-full max-w-[400px] flex-col gap-[22px]">{children}</div>
      </div>

      {/* ⚠ `hidden lg:flex` — the panel is decoration carrying copy, not
          function. Below the desktop floor it is the first thing to go, so the
          form never gets squeezed to reach it. */}
      <aside
        data-testid="admin-auth-panel"
        className="hidden w-[460px] shrink-0 flex-col justify-between lg:flex"
        style={{
          background: ADMIN_ACCENT.ink,
          padding: `${ADMIN_ACCENT.panelPaddingY}px ${ADMIN_ACCENT.panelPaddingX}px`,
        }}
      >
        <Logo variant="white" size={44} />

        <div className="flex flex-col gap-[22px]">
          <div className="font-arabic text-[26px] font-extrabold leading-[1.5] text-white">
            {panelTitle}
          </div>

          {panelBody ? (
            <span className="text-[13.5px] leading-[1.7] text-white/85">{panelBody}</span>
          ) : null}

          {panelBullets?.length ? (
            <div className="flex flex-col gap-3">
              {panelBullets.map((bullet) => (
                <div key={bullet} className="flex items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-white/[0.18] text-[11px] text-white"
                  >
                    ✓
                  </span>
                  <span className="text-[14px] leading-[1.6] text-white/[0.92]">{bullet}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <span className="text-[12px] leading-[1.6] text-white/60">
          {panelFootnote ?? 'كل دخول يُسجَّل بوقته وجهازه في سجل الحساب.'}
        </span>
      </aside>
    </div>
  )
}

/** The logo + «لوحة الإدارة» pill that opens the form column on screen A. */
export function AdminAuthBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo variant="color" size={40} />
      <span
        style={{
          padding: `${ADMIN_PILL.paddingY}px ${ADMIN_PILL.paddingX}px`,
          borderRadius: ADMIN_PILL.borderRadius,
          fontSize: ADMIN_PILL.fontSize,
          fontWeight: ADMIN_PILL.fontWeight,
          letterSpacing: `${ADMIN_PILL.letterSpacing}em`,
          background: ADMIN_PILL.background,
          color: ADMIN_PILL.color,
          whiteSpace: 'nowrap',
        }}
      >
        لوحة الإدارة
      </span>
    </div>
  )
}
