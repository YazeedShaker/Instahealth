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

  test('semantic error pairing meets AA for small text on the error background', () => {
    // The payment-failure design puts 12px helper text on --ih-error-bg.
    // colors.semantic.error would fail AA there; errorText is the pairing.
    expect(colors.semantic.errorBg).toBe('#FEE2E2')
    expect(colors.semantic.errorText).toBe('#991B1B')
  })

  test('semantic success pairing meets AA for small text on the success background', () => {
    // F07's "مؤكد" status badge is 11.5px on --ih-success-bg. The mint
    // colors.semantic.success on its own tint is ~1.9:1 — successText is the
    // pairing, same as warningText/errorText.
    expect(colors.semantic.successBg).toBe('#E5F7F4')
    expect(colors.semantic.successText).toBe('#01705A')
  })

  test('every semantic tint has an AA text pairing (none rely on the base hue)', () => {
    for (const tone of ['success', 'warning', 'error'] as const) {
      expect(colors.semantic[`${tone}Bg`]).toBeTruthy()
      expect(colors.semantic[`${tone}Text`]).toBeTruthy()
    }
  })
})
