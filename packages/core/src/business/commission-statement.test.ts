import { describe, expect, test } from 'vitest'

import {
  buildCommissionStatementCsv,
  formatStatementDayAr,
  formatStatementMonthAr,
  type CommissionStatementExport,
  type CommissionStatementLine,
} from './commission-statement'

const countedCash: CommissionStatementLine = {
  bookingRef: 'IH-2026-04877',
  bookingDate: '2026-07-05',
  method: 'cash',
  eventDate: '2026-07-06',
  eventKind: 'completion',
  amountPiasters: 32_000,
  ratePercent: 12,
  commissionPiasters: 3_840,
  excluded: false,
  excludedReason: null,
}

const countedPrepaid: CommissionStatementLine = {
  bookingRef: 'IH-2026-04812',
  bookingDate: '2026-07-03',
  method: 'prepaid',
  eventDate: '2026-07-03',
  eventKind: 'payment',
  amountPiasters: 48_000,
  ratePercent: 12,
  commissionPiasters: 5_760,
  excluded: false,
  excludedReason: null,
}

const excluded: CommissionStatementLine = {
  bookingRef: 'IH-2026-04991',
  bookingDate: '2026-07-11',
  method: 'cash',
  eventDate: null,
  eventKind: 'excluded',
  amountPiasters: 40_000,
  ratePercent: null,
  commissionPiasters: 0,
  excluded: true,
  excludedReason: 'system_closed',
}

const base: CommissionStatementExport = {
  providerNameAr: 'مستشفى تاون',
  month: '2026-07-01',
  version: 1,
  status: 'sent',
  issuedAt: '2026-08-02T10:40:00Z',
  lines: [countedPrepaid, countedCash, excluded],
  totals: {
    gmvPiasters: 80_000,
    commissionableCount: 2,
    commissionTotalPiasters: 9_600,
    excludedCount: 1,
    excludedAmountPiasters: 40_000,
  },
}

describe('formatStatementMonthAr', () => {
  test('renders the Arabic month and year', () => {
    expect(formatStatementMonthAr('2026-07-01')).toBe('يوليو ٢٠٢٦')
    expect(formatStatementMonthAr('2026-01-01')).toBe('يناير ٢٠٢٦')
    expect(formatStatementMonthAr('2026-12-01')).toBe('ديسمبر ٢٠٢٦')
  })

  test('a malformed month throws rather than printing "undefined ٢٠٢٦" on an invoice', () => {
    expect(() => formatStatementMonthAr('2026-13-01')).toThrow(/ISO month/)
    expect(() => formatStatementMonthAr('nonsense')).toThrow(/ISO month/)
  })
})

describe('buildCommissionStatementCsv — paper agrees with screen', () => {
  const csv = buildCommissionStatementCsv(base)
  const lines = csv.split('\r\n')

  test('the identification block comes BEFORE the table header', () => {
    expect(lines[0]).toContain('كشف العمولة')
    expect(csv).toContain('مستشفى تاون')
    expect(csv).toContain('يوليو ٢٠٢٦')
    expect(csv).toContain('الإصدار ١')
    expect(csv).toContain('أُرسلت')
    const headerIndex = lines.findIndex((l) => l.startsWith('المرجع,'))
    const partnerIndex = lines.findIndex((l) => l.includes('مستشفى تاون'))
    expect(partnerIndex).toBeGreaterThanOrEqual(0)
    expect(headerIndex).toBeGreaterThan(partnerIndex)
  })

  test('EXCLUDED rows are present, with a reason and a zero commission', () => {
    const row = lines.find((l) => l.startsWith('IH-2026-04991'))
    expect(row).toBeDefined()
    expect(row).toContain('system_closed')
    expect(row).toContain('أُغلقت تلقائياً — غير محتسبة')
    // Its commission column is a dash, and its machine column is a hard zero —
    // never a blank that a spreadsheet could read as "missing" rather than "nil".
    expect(row?.endsWith(',40000,0')).toBe(true)
  })

  test('the excluded FOOTNOTE is printed even though the row is already listed', () => {
    // The design makes this explicit: the footnote prints in full at the bottom
    // of every export, whether or not the rows are shown on screen.
    expect(csv).toContain('حجوزات أُغلقت تلقائياً — غير محتسبة')
    expect(csv).toContain('مهلة الـ٢٤ ساعة')
  })

  test('each counted row carries both the Arabic display figure and raw piasters', () => {
    const row = lines.find((l) => l.startsWith('IH-2026-04812'))
    expect(row).toContain('٤٨٠') // what the partner reads
    expect(row).toContain('48000') // what a spreadsheet can sum
    expect(row).toContain('٥٧٫٦٠')
    expect(row).toContain('5760')
  })

  test('the method and event-kind columns say WHICH rule earned the commission', () => {
    expect(lines.find((l) => l.startsWith('IH-2026-04812'))).toContain('تاريخ الدفع')
    expect(lines.find((l) => l.startsWith('IH-2026-04877'))).toContain('تاريخ الإتمام')
  })

  test('the totals line reproduces the summary cards', () => {
    const total = lines.find((l) => l.startsWith('الإجمالي المحتسب'))
    expect(total).toContain('٨٠٠')
    expect(total).toContain('٩٦')
    expect(total).toContain('9600')
  })

  test('a DRAFT export says so rather than claiming a version', () => {
    const draft = buildCommissionStatementCsv({
      ...base,
      version: null,
      status: 'draft',
      issuedAt: null,
    })
    expect(draft).toContain('مسودة (بدون إصدار)')
    expect(draft).toContain('مسودة — لم تُصدر بعد')
    expect(draft).toContain('أُصدرت في,—')
  })

  test('a SUPERSEDED export is marked, so a stale printout identifies itself', () => {
    const old = buildCommissionStatementCsv({ ...base, status: 'superseded' })
    expect(old).toContain('نسخة ملغاة')
    expect(old).toContain('استُبدلت بإصدار أحدث')
  })

  test('free text with a comma is quoted, so no column ever shifts', () => {
    const risky = buildCommissionStatementCsv({
      ...base,
      lines: [{ ...excluded, excludedReason: 'closed, by the nightly job' }],
    })
    expect(risky).toContain('"closed, by the nightly job"')
  })

  test('an embedded quote is doubled per RFC 4180', () => {
    const risky = buildCommissionStatementCsv({
      ...base,
      providerNameAr: 'مستشفى "تاون"',
    })
    expect(risky).toContain('"مستشفى ""تاون"""')
  })
})

describe('formatStatementDayAr — the table date cell', () => {
  test('renders a day and a month NAME, not an ISO string', () => {
    // The frames show «٣ يوليو». A column of `٢٠٢٦-٠٧-٢٨` is unreadable at a
    // glance when every row shares the same year and month.
    expect(formatStatementDayAr('2026-07-03')).toBe('٣ يوليو')
    expect(formatStatementDayAr('2026-07-28')).toBe('٢٨ يوليو')
  })

  test('a leading zero in the day is dropped', () => {
    expect(formatStatementDayAr('2026-01-09')).toBe('٩ يناير')
  })

  test('a malformed date throws rather than printing "undefined" on an invoice', () => {
    expect(() => formatStatementDayAr('2026-13-03')).toThrow(/ISO date/)
    expect(() => formatStatementDayAr('03/07/2026')).toThrow(/ISO date/)
  })
})
