import { describe, expect, test } from 'vitest'

import { computeDistanceKm, formatDistanceAr } from './geo'
import { toArabicDigits, formatTimeShortAr } from './format'

describe('computeDistanceKm', () => {
  test('identical points → 0', () => {
    expect(computeDistanceKm({ lat: 30.0444, lng: 31.2357 }, { lat: 30.0444, lng: 31.2357 })).toBe(
      0,
    )
  })

  test('one degree of latitude ≈ 111.2 km', () => {
    expect(computeDistanceKm({ lat: 30, lng: 31 }, { lat: 31, lng: 31 })).toBeCloseTo(111.2, 0)
  })

  test('one degree of longitude at 30°N ≈ 96 km', () => {
    expect(computeDistanceKm({ lat: 30, lng: 31 }, { lat: 30, lng: 32 })).toBeCloseTo(96.3, 0)
  })

  test('Saridar Dokki → Town Hospital (real seed coords) is a plausible cross-Cairo distance', () => {
    const dokki = { lat: 30.038426, lng: 31.210027 }
    const town = { lat: 30.014288, lng: 31.4379333 }
    const km = computeDistanceKm(dokki, town)
    expect(km).toBeGreaterThan(20)
    expect(km).toBeLessThan(25)
  })
})

describe('formatDistanceAr', () => {
  test('under 10km → one Arabic decimal with ٫', () => {
    expect(formatDistanceAr(1.23)).toBe('١٫٢ كم')
    expect(formatDistanceAr(0.05)).toBe('٠٫١ كم')
  })

  test('10km and above → whole Arabic number', () => {
    expect(formatDistanceAr(12.4)).toBe('١٢ كم')
    expect(formatDistanceAr(180)).toBe('١٨٠ كم')
  })

  test('never negative, never NaN-looking', () => {
    expect(formatDistanceAr(-3)).toBe('٠٫٠ كم')
  })
})

describe('format additions', () => {
  test('toArabicDigits converts every western digit', () => {
    expect(toArabicDigits('0123456789')).toBe('٠١٢٣٤٥٦٧٨٩')
    expect(toArabicDigits('1:05')).toBe('١:٠٥')
  })

  test('formatTimeShortAr renders the design label format', () => {
    expect(formatTimeShortAr('22:00')).toBe('١٠م')
    expect(formatTimeShortAr('09:30')).toBe('٩:٣٠ص')
    expect(formatTimeShortAr('12:00')).toBe('١٢م')
    expect(formatTimeShortAr('00:15')).toBe('١٢:١٥ص')
  })
})
