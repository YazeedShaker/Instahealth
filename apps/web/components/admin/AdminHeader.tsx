import {
  ADMIN_ACCENT,
  ADMIN_PILL,
  ADMIN_SOON_CHIP,
  resolveTokenCss,
} from '@instahealth/design-tokens'

import { adminSignOut } from '../../app/admin/actions'

// Header per `Admin - Analytics.dc.html`, which is the handoff's canonical
// rendering of the admin shell chrome: title · «قريباً» when the surface is a
// placeholder · the «لوحة الإدارة» pill · spacer · the identity block with the
// avatar disc, «مؤسِّس», and logout.
//
// ⚠ The header WRAPS rather than clips (VIEW-01 ③): at 150% browser zoom the
// partner header put 763px of content in 691px and cut the logout off. A
// portal whose sign-out disappears when someone zooms is not acceptable, so
// `flex-wrap` here is load-bearing, not cosmetic.
export function AdminHeader({
  title,
  displayName,
  soon = false,
  subtitle,
}: {
  title: string
  displayName: string
  soon?: boolean
  /** The counts line the list frames draw under the title — «١٤ خدمة · ١١
   *  منشورة · ٢ مسودة · ١ موقوفة». Extended into the shared header rather than
   *  re-implemented per page (§9: extend the contract, never the page). */
  subtitle?: string
}) {
  // The disc shows the first letter of the admin's name — «م» for المؤسس in
  // the handoff. Derived, never hardcoded.
  const initial = displayName.trim().charAt(0) || 'م'

  return (
    <header
      data-print="hide"
      data-testid="admin-header"
      className="flex min-h-[56px] shrink-0 flex-wrap items-center gap-4 border-b border-ih-neutral-200 bg-white px-6 py-2.5 shadow-sm"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="truncate text-[16px] font-extrabold text-ih-neutral-800">{title}</h1>
          {soon ? (
            <span
              data-testid="admin-soon-chip"
              style={{
                padding: `${ADMIN_SOON_CHIP.paddingY}px ${ADMIN_SOON_CHIP.paddingX}px`,
                borderRadius: ADMIN_SOON_CHIP.borderRadius,
                fontSize: ADMIN_SOON_CHIP.fontSize,
                fontWeight: ADMIN_SOON_CHIP.fontWeight,
                color: resolveTokenCss(ADMIN_SOON_CHIP.color),
                background: resolveTokenCss(ADMIN_SOON_CHIP.background),
                border: `${ADMIN_SOON_CHIP.borderWidth}px solid ${resolveTokenCss(ADMIN_SOON_CHIP.borderColor)}`,
                whiteSpace: 'nowrap',
              }}
            >
              قريباً
            </span>
          ) : null}
        </div>
        {subtitle === undefined ? null : (
          <span
            data-testid="admin-header-subtitle"
            className="truncate text-[12px] text-ih-neutral-500"
          >
            {subtitle}
          </span>
        )}
      </div>

      <span
        style={{
          flexShrink: 0,
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

      <div className="flex-1" />

      <div className="flex shrink-0 items-center gap-2 whitespace-nowrap border-e border-ih-neutral-200 pe-4">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold text-white"
          style={{ background: ADMIN_ACCENT.ink }}
        >
          {initial}
        </span>
        <div className="flex flex-col">
          <span
            data-testid="admin-identity"
            className="text-[12px] font-semibold text-ih-neutral-700"
          >
            مؤسِّس
          </span>
          <form action={adminSignOut}>
            <button
              type="submit"
              data-testid="admin-logout"
              className="cursor-pointer text-[11px] text-ih-neutral-500 underline hover:text-ih-neutral-700"
            >
              تسجيل خروج
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
