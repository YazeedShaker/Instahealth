import { describe, expect, test } from 'vitest'

import {
  DAY_LABELS_AR,
  formatDayHoursAr,
  getCairoDayKey,
  getOpenStatus,
  isBranchOpenNow,
  parseBranchHours,
  WEEK_DAY_ORDER,
  type BranchHours,
} from './hours'

// January dates keep Cairo at a stable UTC+2 (no DST ambiguity in assertions).
// 2026-01-16 is a Friday; 2026-01-17 a Saturday.
function cairo(dateTime: string): Date {
  return new Date(`${dateTime}+02:00`)
}

const SARIDAR_HOURS: BranchHours = {
  sat: { open: '08:00', close: '22:00', closed: false },
  sun: { open: '08:00', close: '22:00', closed: false },
  mon: { open: '08:00', close: '22:00', closed: false },
  tue: { open: '08:00', close: '22:00', closed: false },
  wed: { open: '08:00', close: '22:00', closed: false },
  thu: { open: '08:00', close: '22:00', closed: false },
  fri: { open: '09:00', close: '17:00', closed: false },
}

const ALWAYS_OPEN: BranchHours = {
  sat: { open: '00:00', close: '24:00', closed: false },
  sun: { open: '00:00', close: '24:00', closed: false },
  mon: { open: '00:00', close: '24:00', closed: false },
  tue: { open: '00:00', close: '24:00', closed: false },
  wed: { open: '00:00', close: '24:00', closed: false },
  thu: { open: '00:00', close: '24:00', closed: false },
  fri: { open: '00:00', close: '24:00', closed: false },
}

describe('isBranchOpenNow', () => {
  test('Friday-different pattern: open at 16:59, closed at 17:01', () => {
    expect(isBranchOpenNow(SARIDAR_HOURS, cairo('2026-01-16T16:59:00'))).toBe(true)
    expect(isBranchOpenNow(SARIDAR_HOURS, cairo('2026-01-16T17:01:00'))).toBe(false)
  })

  test('opening boundary: closed at 07:59, open at 08:00 (Saturday)', () => {
    expect(isBranchOpenNow(SARIDAR_HOURS, cairo('2026-01-17T07:59:00'))).toBe(false)
    expect(isBranchOpenNow(SARIDAR_HOURS, cairo('2026-01-17T08:00:00'))).toBe(true)
  })

  test('24/7 branch is always open — including 3am', () => {
    expect(isBranchOpenNow(ALWAYS_OPEN, cairo('2026-01-16T03:00:00'))).toBe(true)
    expect(isBranchOpenNow(ALWAYS_OPEN, cairo('2026-01-17T23:59:00'))).toBe(true)
  })

  test('midnight-crossing range (20:00–02:00): open at 01:00, closed at 03:00', () => {
    const nightHours: BranchHours = {
      ...SARIDAR_HOURS,
      mon: { open: '20:00', close: '02:00', closed: false },
    }
    // Monday 2026-01-19
    expect(isBranchOpenNow(nightHours, cairo('2026-01-19T21:00:00'))).toBe(true)
    expect(isBranchOpenNow(nightHours, cairo('2026-01-19T01:00:00'))).toBe(true)
    expect(isBranchOpenNow(nightHours, cairo('2026-01-19T03:00:00'))).toBe(false)
  })

  test('closed day → false', () => {
    const withClosedFriday: BranchHours = {
      ...SARIDAR_HOURS,
      fri: { open: null, close: null, closed: true },
    }
    expect(isBranchOpenNow(withClosedFriday, cairo('2026-01-16T12:00:00'))).toBe(false)
  })
})

describe('getOpenStatus', () => {
  test('open branch reports the Arabic close label', () => {
    expect(getOpenStatus(SARIDAR_HOURS, cairo('2026-01-17T12:00:00'))).toEqual({
      isOpen: true,
      closeLabelAr: '١٠م',
    })
  })

  test('24/7 branch reports open with a null close label', () => {
    expect(getOpenStatus(ALWAYS_OPEN, cairo('2026-01-17T12:00:00'))).toEqual({
      isOpen: true,
      closeLabelAr: null,
    })
  })

  test('closed branch reports closed', () => {
    expect(getOpenStatus(SARIDAR_HOURS, cairo('2026-01-17T23:30:00')).isOpen).toBe(false)
  })
})

describe('parseBranchHours', () => {
  test('parses the DB JSONB shape', () => {
    const parsed = parseBranchHours({
      sat: { open: '08:00', close: '22:00', closed: false },
      sun: { open: '08:00', close: '22:00', closed: false },
      mon: { open: '08:00', close: '22:00', closed: false },
      tue: { open: '08:00', close: '22:00', closed: false },
      wed: { open: '08:00', close: '22:00', closed: false },
      thu: { open: '08:00', close: '22:00', closed: false },
      fri: { open: null, close: null, closed: true },
    })
    expect(parsed?.sat.open).toBe('08:00')
    expect(parsed?.fri.closed).toBe(true)
  })

  test('missing days become closed instead of crashing', () => {
    const parsed = parseBranchHours({ sat: { open: '08:00', close: '22:00', closed: false } })
    expect(parsed?.mon).toEqual({ open: null, close: null, closed: true })
  })

  test('non-object input → null', () => {
    expect(parseBranchHours(null)).toBeNull()
    expect(parseBranchHours('24/7')).toBeNull()
  })
})

describe('getCairoDayKey', () => {
  test('maps Egypt wall-clock weekdays (Friday and Saturday)', () => {
    expect(getCairoDayKey(cairo('2026-01-16T12:00:00'))).toBe('fri')
    expect(getCairoDayKey(cairo('2026-01-17T12:00:00'))).toBe('sat')
  })

  test('uses the Cairo date, not the viewer timezone (23:30 UTC Friday is Saturday in Cairo)', () => {
    expect(getCairoDayKey(new Date('2026-01-16T23:30:00Z'))).toBe('sat')
  })
})

describe('formatDayHoursAr', () => {
  test('closed day → مغلق', () => {
    expect(formatDayHoursAr({ open: null, close: null, closed: true })).toBe('مغلق')
  })

  test('24/7 day → مفتوح ٢٤ ساعة', () => {
    expect(formatDayHoursAr({ open: '00:00', close: '24:00', closed: false })).toBe('مفتوح ٢٤ ساعة')
  })

  test('normal range renders compact Arabic times', () => {
    expect(formatDayHoursAr({ open: '08:00', close: '22:00', closed: false })).toBe('٨ص – ١٠م')
    expect(formatDayHoursAr({ open: '09:30', close: '17:00', closed: false })).toBe('٩:٣٠ص – ٥م')
  })
})

describe('week schedule constants', () => {
  test('week order starts Saturday and covers all seven days', () => {
    expect(WEEK_DAY_ORDER).toEqual(['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'])
    expect(WEEK_DAY_ORDER.map((day) => DAY_LABELS_AR[day])).toEqual([
      'السبت',
      'الأحد',
      'الاثنين',
      'الثلاثاء',
      'الأربعاء',
      'الخميس',
      'الجمعة',
    ])
  })
})
