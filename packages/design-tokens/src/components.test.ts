import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it, test } from 'vitest'

import {
  ALERTS,
  BUTTON_BASE,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  CHIP_BASE,
  PREPARATION_NOTE,
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
      PREPARATION_NOTE.background,
      PREPARATION_NOTE.borderColor,
      PREPARATION_NOTE.titleColor,
      PREPARATION_NOTE.bodyColor,
      CHIP_BASE.defaultBackground,
      CHIP_BASE.defaultColor,
    ].filter((ref): ref is string => ref !== null)

    for (const ref of refs) {
      expect(resolveTokenCss(ref)).toBeTruthy()
      expect(() => resolveTokenNative(ref)).not.toThrow()
    }
  })
})

describe('⚠ every token ref must resolve to a variable tokens.css actually defines', () => {
  // THE GUARD FOR A BUG THAT SHIPPED TWICE.
  //
  // `resolveTokenCss` kebab-joins a dotted ref into `var(--ih-…)`. It cannot
  // know whether that variable exists, and an undefined CSS variable is NOT an
  // error — the browser drops the whole declaration and the property falls back
  // to its initial value. So a typo in a token ref is invisible in review, in
  // typecheck, in lint, and in every unit test that only checks the string.
  //
  // It has cost this project two defects with the same root cause:
  //   · `CARD.background = 'surface.base'`   → var(--ih-surface-base) undefined
  //     → background dropped → EVERY base Card painted transparent, showing the
  //     page grey instead of white (found 2026-08-11).
  //   · `CARD.borderColor = 'border.base'`   → var(--ih-border-base) undefined
  //     → border-color fell back to `currentColor` → EVERY Card and every card
  //     divider drew a near-black outline (found 2026-08-12, by the founder).
  //
  // Both were `.base` suffixes that `tokens.ts` declares and `tokens.css` does
  // not emit. This test reads the CSS as the source of runtime truth and fails
  // on any ref that cannot resolve against it.
  const cssPath = resolve(__dirname, 'tokens.css')
  const css = readFileSync(cssPath, 'utf8')
  const defined = new Set(Array.from(css.matchAll(/--ih-[a-z0-9-]+/g), (match) => match[0]))

  /** Every dotted string literal in the contract — the shape a token ref takes.
   *
   * ⚠ COMMENTS ARE STRIPPED FIRST. The contract's comments deliberately QUOTE
   * the dead refs («'surface.base' asked for var(--ih-surface-base)…») so the
   * next reader understands what went wrong — and scanning prose made this test
   * fail on its own documentation. It must read code. */
  const contract = readFileSync(resolve(__dirname, 'components.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  const refs = new Set(
    Array.from(
      contract.matchAll(/'([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+)'/g),
      (match) => match[1] as string,
    ),
  )

  it('finds refs to check, so a broken regex cannot make this vacuous', () => {
    // ⚠ A test that checks nothing passes. If the literal shape ever changes,
    // this is what says so instead of quietly going green.
    expect(refs.size).toBeGreaterThan(20)
    expect(defined.size).toBeGreaterThan(40)
  })

  it('resolves every ref in components.ts against tokens.css', () => {
    const dead: string[] = []
    for (const ref of refs) {
      const variable = resolveTokenCss(ref as Parameters<typeof resolveTokenCss>[0])
      // Literals (hex, rgba, 'none', 'transparent') are not variable refs.
      if (!variable.startsWith('var(')) continue
      const name = variable.slice(4, -1)
      if (!defined.has(name)) dead.push(`${ref} → ${name}`)
    }
    expect(
      dead,
      `dead token refs — these render as the CSS initial value:\n${dead.join('\n')}`,
    ).toEqual([])
  })
})
