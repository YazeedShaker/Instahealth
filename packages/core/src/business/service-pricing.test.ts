import { describe, expect, test } from 'vitest'

import {
  MAX_SERVICE_PRICE_EGP,
  formatLastUpdatedAr,
  getPriceChangePercent,
  getPriceErrorAr,
  isBigPriceChange,
  validateServicePrice,
} from './service-pricing'

// January keeps Cairo at a stable UTC+2 (core convention).
const NOW = new Date('2026-01-20T12:00:00Z')
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60000).toISOString()

describe('validateServicePrice — the SAME rules the RPC enforces', () => {
  test('accepts a plain integer price', () => {
    expect(validateServicePrice('175', 150)).toBeNull()
  })

  test('an empty box is not an error the desk should be shouted at for', () => {
    expect(validateServicePrice('', 150)).toBe('empty')
    expect(validateServicePrice('   ', 150)).toBe('empty')
  })

  test('rejects anything that is not a whole number', () => {
    // "150.5" on a shared desk is far more likely a slip than intent.
    expect(validateServicePrice('150.5', 150)).toBe('not_a_number')
    expect(validateServicePrice('abc', 150)).toBe('not_a_number')
    expect(validateServicePrice('-50', 150)).toBe('not_a_number')
    expect(validateServicePrice('١٥٠', 150)).toBe('not_a_number')
  })

  test('zero is out of bounds — free is modelled by unavailable, not by 0', () => {
    expect(validateServicePrice('0', 150)).toBe('out_of_bounds')
  })

  test('rejects a price above the ceiling', () => {
    expect(validateServicePrice(String(MAX_SERVICE_PRICE_EGP + 1), 150)).toBe('out_of_bounds')
    expect(validateServicePrice(String(MAX_SERVICE_PRICE_EGP), 20000)).toBeNull()
  })

  test('rejects a >10x jump in either direction — the fat-finger guard', () => {
    expect(validateServicePrice('1501', 150)).toBe('change_too_large') // extra digit
    expect(validateServicePrice('14', 150)).toBe('change_too_large') // lost a digit
    expect(validateServicePrice('1500', 150)).toBeNull() // exactly 10x is allowed
  })

  test('a first price on a zero-priced row is not measured against a ratio', () => {
    expect(validateServicePrice('300', 0)).toBeNull()
  })
})

describe('getPriceChangePercent', () => {
  test('a rise is positive and a cut is negative', () => {
    expect(getPriceChangePercent(100, 150)).toBe(50)
    expect(getPriceChangePercent(200, 150)).toBe(-25)
  })

  test('no change is zero, and a zero base never divides', () => {
    expect(getPriceChangePercent(150, 150)).toBe(0)
    expect(getPriceChangePercent(0, 150)).toBe(0)
  })
})

// The approved design's rule, kept verbatim.
describe('isBigPriceChange — when to demand type-to-confirm', () => {
  test('more than half again is big', () => {
    expect(isBigPriceChange(100, 151)).toBe(true)
    expect(isBigPriceChange(100, 150)).toBe(false) // exactly 50% is not
  })

  test('more than 200 EGP absolute is big even at a small percentage', () => {
    // 10% of a 2500 EGP scan is real money; a percentage alone would wave it through.
    expect(isBigPriceChange(2500, 2750)).toBe(true)
  })

  test('a small change on a cheap test is not big', () => {
    expect(isBigPriceChange(45, 50)).toBe(false)
  })

  test('a big DROP counts too', () => {
    expect(isBigPriceChange(400, 100)).toBe(true)
  })

  test('a zero base is never "big" — there is nothing to compare against', () => {
    expect(isBigPriceChange(0, 500)).toBe(false)
  })
})

describe('formatLastUpdatedAr — empty means absent', () => {
  test('never edited renders NOTHING, so the caller can say «لم يُحدَّث بعد»', () => {
    // A placeholder price no partner has confirmed must not look maintained.
    expect(formatLastUpdatedAr(null, NOW)).toBeNull()
  })

  test('an unparseable timestamp is absent rather than "Invalid Date"', () => {
    expect(formatLastUpdatedAr('not-a-date', NOW)).toBeNull()
  })

  test('reads down the scale in Arabic', () => {
    expect(formatLastUpdatedAr(ago(0), NOW)).toBe('الآن')
    expect(formatLastUpdatedAr(ago(30), NOW)).toBe('خلال الساعة')
    expect(formatLastUpdatedAr(ago(60 * 5), NOW)).toBe('اليوم')
    expect(formatLastUpdatedAr(ago(60 * 30), NOW)).toBe('أمس')
    expect(formatLastUpdatedAr(ago(60 * 24 * 3), NOW)).toBe('قبل ٣ أيام')
    expect(formatLastUpdatedAr(ago(60 * 24 * 8), NOW)).toBe('قبل أسبوع')
    expect(formatLastUpdatedAr(ago(60 * 24 * 20), NOW)).toBe('قبل ٢ أسابيع')
    expect(formatLastUpdatedAr(ago(60 * 24 * 40), NOW)).toBe('قبل شهر')
    expect(formatLastUpdatedAr(ago(60 * 24 * 90), NOW)).toBe('قبل ٣ أشهر')
  })
})

describe('getPriceErrorAr — the desk never sees a raw server string', () => {
  test('maps every error the RPC can return', () => {
    for (const key of [
      'empty',
      'not_a_number',
      'out_of_bounds',
      'price_out_of_bounds',
      'change_too_large',
      'price_change_too_large',
      'service_not_found',
    ]) {
      const message = getPriceErrorAr(key)
      expect(message.length).toBeGreaterThan(0)
      expect(message).not.toContain('_') // no snake_case leaking through
    }
  })

  test('an unknown error still gets a calm Arabic fallback', () => {
    const message = getPriceErrorAr('something_unexpected')
    expect(message).toContain('تعذّر')
  })
})
