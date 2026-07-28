import { describe, expect, test } from 'vitest'

import { convertArabicDigits } from './phone'
import { cairoWallClockToInstant, formatArabicDate, formatEGP, formatSlotTime } from './format'

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

describe('cairoWallClockToInstant', () => {
  test('09:30 Cairo in January is 07:30 UTC (UTC+2)', () => {
    expect(cairoWallClockToInstant('2026-01-15', '09:30:00').toISOString()).toBe(
      '2026-01-15T07:30:00.000Z',
    )
  })

  test('accepts slot_time with and without seconds', () => {
    expect(cairoWallClockToInstant('2026-01-15', '09:30').getTime()).toBe(
      cairoWallClockToInstant('2026-01-15', '09:30:00').getTime(),
    )
  })

  test('midnight does not roll into the previous day', () => {
    expect(cairoWallClockToInstant('2026-01-15', '00:00:00').toISOString()).toBe(
      '2026-01-14T22:00:00.000Z',
    )
  })

  // THE REGRESSION. The previous implementation round-tripped through
  // `toLocaleString` and `new Date(string)`, which only parses on V8 — Hermes
  // returned Invalid Date, so every add-to-calendar threw
  // `RangeError: Date value out of bounds` on a real phone while every test and
  // every Node script passed. A valid instant is the thing to assert.
  test('always returns a VALID date — never NaN from a failed string parse', () => {
    for (const time of ['00:00:00', '09:00:00', '13:45:00', '23:59:00']) {
      const instant = cairoWallClockToInstant('2026-07-28', time)
      expect(Number.isNaN(instant.getTime())).toBe(false)
      // `toISOString` is what expo-calendar calls, and what threw on device.
      expect(() => instant.toISOString()).not.toThrow()
    }
  })

  test('round-trips back to the same Cairo wall clock', () => {
    const instant = cairoWallClockToInstant('2026-07-28', '15:00:00')
    const rendered = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(instant)
    expect(rendered).toBe('15:00')
  })

  test('malformed values throw rather than yielding an Invalid Date', () => {
    expect(() => cairoWallClockToInstant('28-07-2026', '15:00:00')).toThrow(/slotDate/)
    expect(() => cairoWallClockToInstant('2026-07-28', 'quarter past three')).toThrow(/slotTime/)
  })
})
