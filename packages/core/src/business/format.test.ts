import { describe, expect, it, test } from 'vitest'

import { convertArabicDigits } from './phone'
import {
  AR_BOOKING,
  AR_BRANCH,
  AR_PROVIDER,
  AR_SLOT,
  cairoWallClockToInstant,
  formatArabicDate,
  formatCairoIsoDate,
  AR_BOOKING_AUTOCLOSED,
  formatCountedAr,
  formatEGP,
  formatPiastersEgpAr,
  formatSlotTime,
} from './format'

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

describe('formatCairoIsoDate — the dashboard\'s "today"', () => {
  test('reads the Cairo calendar date, not the UTC one', () => {
    // 22:30 UTC on the 20th is already 00:30 on the 21st in Cairo. This is the
    // whole reason the helper exists: `toISOString().slice(0, 10)` would answer
    // "2026-01-20" and the desk would be shown yesterday's list every evening.
    expect(formatCairoIsoDate(new Date(Date.UTC(2026, 0, 20, 22, 30)))).toBe('2026-01-21')
  })

  test('a mid-morning instant is the same day either way', () => {
    expect(formatCairoIsoDate(new Date(Date.UTC(2026, 0, 20, 7, 30)))).toBe('2026-01-20')
  })

  test('it crosses the year boundary with Cairo, not with UTC', () => {
    expect(formatCairoIsoDate(new Date(Date.UTC(2026, 11, 31, 22, 30)))).toBe('2027-01-01')
  })

  test('single-digit months and days are zero-padded, so string compare is safe', () => {
    // The future-day rule compares this against slots.slot_date as plain
    // strings — unpadded output would make "2026-1-9" > "2026-01-20".
    const formatted = formatCairoIsoDate(new Date(Date.UTC(2026, 0, 9, 10, 0)))
    expect(formatted).toBe('2026-01-09')
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('formatPiastersEgpAr — the commission statement money renderer', () => {
  test('a whole-pound amount renders without decimals, grouped', () => {
    // The approved frame's «إجمالي المبيعات المحتسبة ٤٬١٥٠».
    expect(formatPiastersEgpAr(415_000)).toBe('٤٬١٥٠')
  })

  test('a fractional amount renders with exactly two decimals', () => {
    // «العمولة المستحقة ٥٢١٫٤٠» — trailing zero kept, because money always
    // shows both places once it has any.
    expect(formatPiastersEgpAr(52_140)).toBe('٥٢١٫٤٠')
  })

  test('it groups every three digits, not just the first thousand', () => {
    expect(formatPiastersEgpAr(123_456_700)).toBe('١٬٢٣٤٬٥٦٧')
  })

  test('sub-pound amounts keep a leading zero pound', () => {
    expect(formatPiastersEgpAr(7)).toBe('٠٫٠٧')
  })

  test('zero is zero, not an empty string', () => {
    expect(formatPiastersEgpAr(0)).toBe('٠')
  })

  test('a negative delta renders signed — the credit-forward note can be either way', () => {
    expect(formatPiastersEgpAr(-1_200)).toBe('-١٢')
  })

  test('it takes PIASTERS, so 100 is one pound and never one hundred', () => {
    // The whole reason the signature is piasters: formatting from a float
    // total is how rounding drift reaches a partner's invoice.
    expect(formatPiastersEgpAr(100)).toBe('١')
  })

  test('a non-finite amount THROWS rather than rendering NaN on an invoice', () => {
    expect(() => formatPiastersEgpAr(Number.NaN)).toThrow(/finite piaster/)
    expect(() => formatPiastersEgpAr(Number.POSITIVE_INFINITY)).toThrow(/finite piaster/)
  })
})

describe('formatCountedAr — تمييز العدد', () => {
  // The band boundaries are the whole point: the A04 dialog was written from a
  // frame whose sample was ٦ (plural, correct) and shipped «٢٤ فروع» on live
  // data, where the accusative is required.
  it.each([
    [0, '٠ فروع'],
    [1, '١ فرع'],
    [2, '٢ فرعان'],
    [3, '٣ فروع'],
    [6, '٦ فروع'],
    [10, '١٠ فروع'],
    [11, '١١ فرعاً'],
    [24, '٢٤ فرعاً'],
    [99, '٩٩ فرعاً'],
    [100, '١٠٠ فرع'],
    [101, '١٠١ فرع'],
    [102, '١٠٢ فرعان'],
    [111, '١١١ فرعاً'],
    [200, '٢٠٠ فرع'],
  ])('%i branches reads «%s»', (count, expected) => {
    expect(formatCountedAr(count, AR_BRANCH)).toBe(expected)
  })

  it('agrees for every noun the admin portal counts', () => {
    expect(formatCountedAr(14, AR_BOOKING)).toBe('١٤ حجزاً')
    expect(formatCountedAr(3, AR_BOOKING)).toBe('٣ حجوزات')
    expect(formatCountedAr(155, AR_SLOT)).toBe('١٥٥ موعداً')
    expect(formatCountedAr(4, AR_PROVIDER)).toBe('٤ مزودين')
    expect(formatCountedAr(1, AR_PROVIDER)).toBe('١ مزود')
  })

  // ⚠ THE VERB AGREES TOO. The statement's excluded banner printed
  // «١ حجوزات أُغلقت تلقائياً» — plural noun AND plural verb against a count of
  // one — on the very first sheet that ever rendered it. Fixing only the noun
  // would have left «١ حجز أُغلقت تلقائياً», which is wrong in a quieter way,
  // so the whole PHRASE is what gets counted.
  it('inflects the whole phrase, verb included, for auto-closed bookings', () => {
    expect(formatCountedAr(1, AR_BOOKING_AUTOCLOSED)).toBe('١ حجز أُغلق تلقائياً')
    expect(formatCountedAr(2, AR_BOOKING_AUTOCLOSED)).toBe('٢ حجزان أُغلقا تلقائياً')
    expect(formatCountedAr(5, AR_BOOKING_AUTOCLOSED)).toBe('٥ حجوزات أُغلقت تلقائياً')
    expect(formatCountedAr(11, AR_BOOKING_AUTOCLOSED)).toBe('١١ حجزاً أُغلق تلقائياً')
    // The regression itself, stated as the thing that must never come back.
    expect(formatCountedAr(1, AR_BOOKING_AUTOCLOSED)).not.toContain('حجوزات')
  })

  // ⚠ `% 100`, not `% 10` — ١١١ is an accusative like ١١, and ١٠٠ is not.
  it('reads the tail modulo 100, so 111 and 11 agree while 100 does not', () => {
    expect(formatCountedAr(111, AR_BRANCH)).toBe('١١١ فرعاً')
    expect(formatCountedAr(11, AR_BRANCH)).toBe('١١ فرعاً')
    expect(formatCountedAr(100, AR_BRANCH)).toBe('١٠٠ فرع')
  })

  it.each([-1, 1.5, Number.NaN])('refuses %s rather than inventing a form', (count) => {
    expect(() => formatCountedAr(count, AR_BRANCH)).toThrow(/non-negative integer/)
  })
})
