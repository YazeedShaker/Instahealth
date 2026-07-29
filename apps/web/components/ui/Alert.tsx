import { ALERTS, ALERT_BASE, resolveTokenCss, type AlertType } from '@instahealth/design-tokens'
import type { ReactNode } from 'react'

// Thin shell over the shared contract. The 3px rule sits on the INLINE START
// edge, so it lands on the right under RTL without any direction logic here.
export function Alert({
  type = 'info',
  children,
  testId,
}: {
  type?: AlertType
  children: ReactNode
  testId?: string
}) {
  const spec = ALERTS[type]
  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      data-testid={testId}
      style={{
        background: resolveTokenCss(spec.background),
        borderRadius: ALERT_BASE.borderRadius,
        padding: `${ALERT_BASE.paddingY}px ${ALERT_BASE.paddingX}px`,
        borderInlineStartWidth: ALERT_BASE.accentWidth,
        borderInlineStartStyle: 'solid',
        borderInlineStartColor: resolveTokenCss(spec.accent),
        display: 'flex',
        gap: ALERT_BASE.gap,
        alignItems: 'flex-start',
      }}
    >
      {/* Colour is never the only signal — the icon carries the type too. */}
      <span
        aria-hidden="true"
        style={{
          color: resolveTokenCss(spec.accent),
          fontWeight: 700,
          flexShrink: 0,
          fontSize: ALERT_BASE.fontSize,
          lineHeight: ALERT_BASE.lineHeight,
        }}
      >
        {spec.icon}
      </span>
      <span
        style={{
          fontSize: ALERT_BASE.fontSize,
          color: spec.text,
          lineHeight: ALERT_BASE.lineHeight,
        }}
      >
        {children}
      </span>
    </div>
  )
}
