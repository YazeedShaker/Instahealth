import { describe, expect, test } from 'vitest'

import {
  convertArabicDigits,
  formatEgyptianPhoneDisplay,
  isolateLtr,
  isValidEgyptianPhone,
  normalizeEgyptianPhone,
} from './phone'

const CANONICAL = '+201012345678'

describe('normalizeEgyptianPhone', () => {
  test.each([
    ['local 0-prefixed', '01012345678'],
    ['E.164 with plus', '+201012345678'],
    ['international 00 prefix', '00201012345678'],
    ['bare country code', '201012345678'],
    ['spaces and dashes', '010 1234-5678'],
    ['parentheses and dots', '(010) 1234.5678'],
    ['arabic-indic digits', '٠١٠١٢٣٤٥٦٧٨'],
    ['extended arabic-indic digits', '۰۱۰۱۲۳۴۵۶۷۸'],
    ['arabic digits with plus and country code', '+٢٠١٠١٢٣٤٥٦٧٨'],
  ])('normalizes %s to the same E.164', (_label, input) => {
    expect(normalizeEgyptianPhone(input)).toBe(CANONICAL)
  })

  test.each([
    ['011 prefix', '01112345678', '+201112345678'],
    ['012 prefix', '01212345678', '+201212345678'],
    ['015 prefix', '01512345678', '+201512345678'],
  ])('accepts valid prefix %s', (_label, input, expected) => {
    expect(normalizeEgyptianPhone(input)).toBe(expected)
  })

  test.each([
    ['013 prefix (not allocated)', '01312345678'],
    ['014 prefix (not allocated)', '01412345678'],
    ['cairo landline', '0223456789'],
    ['too short', '0101234567'],
    ['too long', '010123456789'],
    ['empty string', ''],
    ['letters mixed in', '01O12E45678'],
    ['pure garbage', 'not a phone'],
    ['plus in the middle', '010+12345678'],
  ])('returns null for %s — never throws', (_label, input) => {
    expect(normalizeEgyptianPhone(input)).toBeNull()
  })
})

describe('isValidEgyptianPhone', () => {
  test('true for all valid mobile prefixes', () => {
    expect(isValidEgyptianPhone('01012345678')).toBe(true)
    expect(isValidEgyptianPhone('01112345678')).toBe(true)
    expect(isValidEgyptianPhone('01212345678')).toBe(true)
    expect(isValidEgyptianPhone('01512345678')).toBe(true)
  })

  test('false for landlines, bad prefixes, and garbage', () => {
    expect(isValidEgyptianPhone('01312345678')).toBe(false)
    expect(isValidEgyptianPhone('0223456789')).toBe(false)
    expect(isValidEgyptianPhone('hello')).toBe(false)
  })
})

describe('convertArabicDigits', () => {
  test('converts arabic-indic and extended arabic-indic digits', () => {
    expect(convertArabicDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789')
    expect(convertArabicDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789')
  })

  test('leaves western digits and other text untouched', () => {
    expect(convertArabicDigits('abc 123')).toBe('abc 123')
  })
})

describe('isolateLtr', () => {
  test('wraps text in LRI…PDI isolates', () => {
    expect(isolateLtr('+20 10 1234 5678')).toBe('\u2066+20 10 1234 5678\u2069')
  })
})

describe('formatEgyptianPhoneDisplay', () => {
  test('groups E.164 into the design display form, bidi-isolated', () => {
    expect(formatEgyptianPhoneDisplay('+201012345678')).toBe('\u2066+20 10 1234 5678\u2069')
  })

  test('accepts other normalizable forms', () => {
    expect(formatEgyptianPhoneDisplay('01012345678')).toBe('\u2066+20 10 1234 5678\u2069')
  })

  test('unparseable input falls back to the isolated raw string', () => {
    expect(formatEgyptianPhoneDisplay('+4915112345678')).toBe('\u2066+4915112345678\u2069')
  })
})
