import { describe, expect, test } from 'vitest'

import { convertArabicDigits } from './phone'
import { formatArabicDate, formatEGP, formatSlotTime } from './format'

// A January date keeps Cairo firmly at UTC+2 (no DST ambiguity in assertions).
const WINTER_MORNING = new Date(Date.UTC(2026, 0, 15, 7, 30)) // Thursday 09:30 Cairo time

describe('formatEGP', () => {
  test('arabic locale renders Arabic-Indic digits with the EGP symbol', () => {
    const formatted = formatEGP(150, 'ar')
    expect(convertArabicDigits(formatted)).toContain('150')
    expect(formatted).toContain('ج.م')
  })

  test('english locale renders western digits', () => {
    expect(formatEGP(150, 'en')).toContain('150')
  })

  test('decimals are preserved', () => {
    expect(convertArabicDigits(formatEGP(99.5, 'ar'))).toContain('99')
  })
})

describe('formatArabicDate', () => {
  test('renders Arabic weekday and month', () => {
    const formatted = formatArabicDate(WINTER_MORNING)
    expect(formatted).toContain('الخميس')
    expect(formatted).toContain('يناير')
  })
})

describe('formatSlotTime', () => {
  test('renders Egypt wall-clock time regardless of host timezone', () => {
    expect(formatSlotTime(WINTER_MORNING, 'en')).toMatch(/9:30/)
    expect(convertArabicDigits(formatSlotTime(WINTER_MORNING, 'ar'))).toMatch(/9:30/)
  })
})
