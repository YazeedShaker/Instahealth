import { CHIP_MD, CHIP_TONES, resolveTokenCss, type ChipTone } from '@instahealth/design-tokens'
import type { ReactNode } from 'react'

// Thin shell over the shared contract — the larger bordered chip the Branch
// Details handoff introduced for card headers («✎ قابلة للتعديل» /
// «🔒 للعرض فقط»).
export function Chip({
  tone,
  children,
  testId,
}: {
  tone: ChipTone
  children: ReactNode
  testId?: string
}) {
  const spec = CHIP_TONES[tone]
  return (
    <span
      data-testid={testId}
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: CHIP_MD.gap,
        padding: `${CHIP_MD.paddingY}px ${CHIP_MD.paddingX}px`,
        borderRadius: CHIP_MD.borderRadius,
        border: `${CHIP_MD.borderWidth}px solid ${resolveTokenCss(spec.borderColor)}`,
        background: resolveTokenCss(spec.background),
        color: resolveTokenCss(spec.color),
        fontSize: CHIP_MD.fontSize,
        fontWeight: CHIP_MD.fontWeight,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}
