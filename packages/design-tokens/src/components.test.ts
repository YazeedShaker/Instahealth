import { describe, expect, test } from 'vitest'

import {
  ALERTS,
  BUTTON_BASE,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  STATUS_BADGES,
  STATUS_BADGE_BASE,
  type ButtonVariant,
  type StatusBadgeKey,
} from './components'
import { resolveTokenCss, resolveTokenNative } from './resolve'

// These assertions are transcribed from the design-system bundle at
// design/handoff/project/_ds/**/_ds_bundle.js. They exist so a future edit that
// "tidies" a value has to argue with the design system, not just with taste.

describe('Button contract matches the design system', () => {
  test('sizes are the bundle rem values converted at a 16px root', () => {
    // sm: 0.375rem 0.875rem / 0.8125rem
    expect(BUTTON_SIZES.sm).toEqual({ paddingY: 6, paddingX: 14, fontSize: 13 })
    // md: 0.625rem 1.25rem / 0.9375rem
    expect(BUTTON_SIZES.md).toEqual({ paddingY: 10, paddingX: 20, fontSize: 15 })
    // lg: 0.875rem 1.75rem / 1rem
    expect(BUTTON_SIZES.lg).toEqual({ paddingY: 14, paddingX: 28, fontSize: 16 })
  })

  test('radius is 8 and the tap floor is 44 — for every size', () => {
    expect(BUTTON_BASE.borderRadius).toBe(8)
    expect(BUTTON_BASE.minHeight).toBe(44)
  })

  test('every variant is defined and carries a usable foreground', () => {
    const variants: ButtonVariant[] = [
      'primary',
      'secondary',
      'outline',
      'ghost',
      'destructive',
      'accent',
    ]
    for (const variant of variants) {
      const spec = BUTTON_VARIANTS[variant]
      expect(spec).toBeDefined()
      expect(spec.color.length).toBeGreaterThan(0)
      expect(spec.fontWeight).toBeGreaterThanOrEqual(600)
    }
  })

  test('accent is the one weight exception (700)', () => {
    expect(BUTTON_VARIANTS.accent.fontWeight).toBe(700)
    expect(BUTTON_VARIANTS.primary.fontWeight).toBe(600)
  })

  test('outline is the only bordered variant', () => {
    const bordered = Object.entries(BUTTON_VARIANTS)
      .filter(([, spec]) => spec.borderWidth > 0)
      .map(([name]) => name)
    expect(bordered).toEqual(['outline'])
    expect(BUTTON_VARIANTS.outline.borderWidth).toBe(1.5)
  })

  test('disabled opacity is 0.45, matching the mobile app the design shipped with', () => {
    expect(BUTTON_BASE.disabledOpacity).toBe(0.45)
  })
})

describe('StatusBadge contract', () => {
  test('covers every bookings.status value the DB allows', () => {
    const dbStatuses: StatusBadgeKey[] = [
      'pending',
      'pending_payment',
      'confirmed',
      'arrived',
      'completed',
      'cancelled',
      'no_show',
    ]
    for (const status of dbStatuses) {
      expect(STATUS_BADGES[status]).toBeDefined()
      expect(STATUS_BADGES[status].labelAr.length).toBeGreaterThan(0)
      expect(STATUS_BADGES[status].labelEn.length).toBeGreaterThan(0)
    }
  })

  // The one people "fix" by accident.
  test('confirmed is CERULEAN #028090 on the success tint, not a green', () => {
    expect(STATUS_BADGES.confirmed.color).toBe('#028090')
    expect(STATUS_BADGES.confirmed.background).toBe('semantic.successBg')
  })

  test('arrived is the provider-only addition, on the primary tint', () => {
    expect(STATUS_BADGES.arrived.labelAr).toBe('وصل')
    expect(STATUS_BADGES.arrived.background).toBe('primary.50')
  })

  test('pill geometry matches the bundle', () => {
    expect(STATUS_BADGE_BASE.borderRadius).toBe(9999)
    expect(STATUS_BADGE_BASE.paddingY).toBe(4) // 0.25rem
    expect(STATUS_BADGE_BASE.paddingX).toBe(12) // 0.75rem
    expect(STATUS_BADGE_BASE.fontSize).toBe(12) // 0.75rem
  })
})

describe('Alert contract', () => {
  test('each type pairs an AA text colour with its tint — never the base hue', () => {
    expect(ALERTS.error.text).toBe('#991B1B')
    expect(ALERTS.warning.text).toBe('#92400E')
    expect(ALERTS.success.text).toBe('#017A61')
    expect(ALERTS.info.text).toBe('#01677A')
    for (const spec of Object.values(ALERTS)) {
      expect(spec.text).not.toBe(spec.accent)
    }
  })

  test('every type has an icon — colour is never the only signal', () => {
    for (const spec of Object.values(ALERTS)) {
      expect(spec.icon.length).toBeGreaterThan(0)
    }
  })
})

describe('token resolution', () => {
  test('web refs become CSS custom properties', () => {
    expect(resolveTokenCss('primary.400')).toBe('var(--ih-primary-400)')
    expect(resolveTokenCss('semantic.errorBg')).toBe('var(--ih-error-bg)')
    expect(resolveTokenCss('border.strong')).toBe('var(--ih-border-strong)')
    expect(resolveTokenCss('shadow.card')).toBe('var(--ih-shadow-card)')
  })

  test('native refs become literals', () => {
    expect(resolveTokenNative('primary.400')).toBe('#02C39A')
    expect(resolveTokenNative('neutral.100')).toBe('#EEF1F3')
    expect(resolveTokenNative('text.primary')).toBe('#111C21')
    expect(resolveTokenNative('border.strong')).toBe('#CDD4D8')
  })

  test('literals pass through both resolvers untouched', () => {
    for (const literal of ['#FFFFFF', 'transparent', '#991B1B']) {
      expect(resolveTokenCss(literal)).toBe(literal)
      expect(resolveTokenNative(literal)).toBe(literal)
    }
  })

  test('an unknown native token THROWS rather than rendering undefined', () => {
    expect(() => resolveTokenNative('primary.9999')).toThrow(/unknown token/)
    expect(() => resolveTokenNative('nonsense')).toThrow(/malformed/)
  })

  // The contract is only useful if every ref in it actually resolves.
  test('EVERY token ref in the contract resolves on both platforms', () => {
    const refs = [
      ...Object.values(BUTTON_VARIANTS).flatMap((v) => [
        v.background,
        v.color,
        v.borderColor,
        v.hoverBackground,
      ]),
      ...Object.values(STATUS_BADGES).flatMap((s) => [s.background, s.color]),
      ...Object.values(ALERTS).flatMap((a) => [a.background, a.accent, a.text]),
    ].filter((ref): ref is string => ref !== null)

    for (const ref of refs) {
      expect(resolveTokenCss(ref)).toBeTruthy()
      expect(() => resolveTokenNative(ref)).not.toThrow()
    }
  })
})
