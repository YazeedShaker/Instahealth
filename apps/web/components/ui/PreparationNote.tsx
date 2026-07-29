import { PREPARATION_NOTE, resolveTokenCss } from '@instahealth/design-tokens'
import type { ReactNode } from 'react'

// A THIN shell over the shared contract — every value comes from
// packages/design-tokens/src/components.ts, none from this file (CLAUDE.md §3a).

export function PreparationNote({
  title = 'تجهيزات المريض',
  children,
  testId,
}: {
  title?: string
  children: ReactNode
  testId?: string
}) {
  return (
    <div
      data-testid={testId}
      style={{
        background: resolveTokenCss(PREPARATION_NOTE.background),
        borderWidth: PREPARATION_NOTE.borderWidth,
        borderStyle: 'solid',
        borderColor: resolveTokenCss(PREPARATION_NOTE.borderColor),
        borderRadius: PREPARATION_NOTE.borderRadius,
        padding: `${PREPARATION_NOTE.paddingY}px ${PREPARATION_NOTE.paddingX}px`,
      }}
    >
      <div
        style={{
          fontSize: PREPARATION_NOTE.titleFontSize,
          fontWeight: PREPARATION_NOTE.titleFontWeight,
          color: resolveTokenCss(PREPARATION_NOTE.titleColor),
          letterSpacing: PREPARATION_NOTE.titleLetterSpacing,
          marginBottom: PREPARATION_NOTE.titleMarginBottom,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: PREPARATION_NOTE.bodyFontSize,
          color: resolveTokenCss(PREPARATION_NOTE.bodyColor),
          lineHeight: PREPARATION_NOTE.bodyLineHeight,
        }}
      >
        {children}
      </div>
    </div>
  )
}
