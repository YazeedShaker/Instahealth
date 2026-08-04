import {
  BRANCH_STATUS_BADGES,
  STATUS_BADGES,
  STATUS_BADGE_BASE,
  resolveTokenCss,
  type BranchStatusKey,
  type StatusBadgeKey,
} from '@instahealth/design-tokens'

// Thin shell over the shared contract. Keys are `bookings.status` values, so
// nothing is translated between the DB and the pill — and the patient app can
// render the identical badge from the identical spec.
export function StatusBadge({ status, testId }: { status: StatusBadgeKey; testId?: string }) {
  const spec = STATUS_BADGES[status]
  return (
    <span
      data-testid={testId}
      data-status={status}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: STATUS_BADGE_BASE.gap,
        padding: `${STATUS_BADGE_BASE.paddingY}px ${STATUS_BADGE_BASE.paddingX}px`,
        borderRadius: STATUS_BADGE_BASE.borderRadius,
        background: resolveTokenCss(spec.background),
        color: resolveTokenCss(spec.color),
        fontSize: STATUS_BADGE_BASE.fontSize,
        fontWeight: STATUS_BADGE_BASE.fontWeight,
        whiteSpace: 'nowrap',
      }}
    >
      {spec.labelAr}
    </span>
  )
}

/** Branch operational state for the locked profile card («● نشط»). Same base
 * metrics; the leading dot is part of the design's rendering, not the label. */
export function BranchStatusBadge({
  status,
  testId,
}: {
  status: BranchStatusKey
  testId?: string
}) {
  const spec = BRANCH_STATUS_BADGES[status]
  return (
    <span
      data-testid={testId}
      data-status={status}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: `${STATUS_BADGE_BASE.paddingY}px ${STATUS_BADGE_BASE.paddingX}px`,
        borderRadius: STATUS_BADGE_BASE.borderRadius,
        background: resolveTokenCss(spec.background),
        color: resolveTokenCss(spec.color),
        fontSize: STATUS_BADGE_BASE.fontSize,
        fontWeight: STATUS_BADGE_BASE.fontWeight,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true">●</span> {spec.labelAr}
    </span>
  )
}
