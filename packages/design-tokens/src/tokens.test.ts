import { describe, expect, test } from 'vitest'

import { colors, spacing, typography } from './tokens'
import { nativewindTheme } from './nativewind'
import { tailwindExtension } from './tokens'

describe('design tokens', () => {
  test('exposes the brand teal as primary-400', () => {
    expect(colors.primary[400]).toBe('#02C39A')
  })

  test('exposes the cream accent as accent-300', () => {
    expect(colors.accent[300]).toBe('#F0F3BD')
  })

  test('spacing follows the 4px base grid', () => {
    expect(spacing[1]).toBe('0.25rem')
    expect(spacing[4]).toBe('1rem')
  })

  test('arabic font stack leads with Cairo', () => {
    expect(typography.fonts.arabic).toContain('Cairo')
  })

  test('web and mobile consume the same palette', () => {
    expect(tailwindExtension.colors['ih-primary'][400]).toBe(colors.primary[400])
    expect(nativewindTheme.colors['ih-primary'][400]).toBe(colors.primary[400])
    expect(nativewindTheme.colors['ih-accent'][300]).toBe(colors.accent[300])
  })
})
