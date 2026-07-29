import { CARD, resolveTokenCss } from '@instahealth/design-tokens'
import type { CSSProperties, ReactNode } from 'react'

// Thin shell over the shared contract.
export function Card({
  raised = false,
  topAccent = false,
  padding,
  children,
  style,
  testId,
}: {
  raised?: boolean
  topAccent?: boolean
  /** Override the contract's 20px only when the design shows a flush layout
   * (e.g. a table filling the card edge-to-edge). */
  padding?: number | string
  children: ReactNode
  style?: CSSProperties
  testId?: string
}) {
  return (
    <div
      data-testid={testId}
      style={{
        background: resolveTokenCss(raised ? CARD.raisedBackground : CARD.background),
        borderWidth: CARD.borderWidth,
        borderStyle: 'solid',
        borderColor: resolveTokenCss(CARD.borderColor),
        borderTop: topAccent
          ? `${CARD.topAccentWidth}px solid ${resolveTokenCss(CARD.topAccentColor)}`
          : undefined,
        borderRadius: CARD.borderRadius,
        padding: padding ?? CARD.padding,
        boxShadow: resolveTokenCss(raised ? CARD.raisedShadow : CARD.shadow),
        ...style,
      }}
    >
      {children}
    </div>
  )
}
