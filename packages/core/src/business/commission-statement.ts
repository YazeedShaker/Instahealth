// A02 · the commission statement's shared shape and its CSV export.
//
// This lives in core because the export is a MONEY DOCUMENT and its rules are
// not presentation: the design's own annotation makes them acceptance criteria
// — «لا يستطيع شريك أن يحمل في يده ورقة لا نعرف أي إصدار هي».
//
//   · every export carries the same header the screen shows: partner, month,
//     version, status, and the «أُصدرت في» stamp;
//   · the excluded bookings are PRINTED, with their reason and a zero
//     commission, even when hidden from the on-screen table — no silent
//     deletion;
//   · a superseded version exports marked as such.

import { AR_BOOKING, AR_BOOKING_AUTOCLOSED, formatCountedAr, formatPiastersEgpAr } from './format'

export type StatementMethod = 'cash' | 'prepaid'
export type StatementEventKind = 'payment' | 'completion' | 'excluded'
export type StatementStatusValue = 'issued' | 'sent' | 'settled' | 'superseded'

export interface CommissionStatementLine {
  bookingRef: string
  bookingDate: string
  method: StatementMethod
  eventDate: string | null
  eventKind: StatementEventKind
  amountPiasters: number
  ratePercent: number | null
  commissionPiasters: number
  excluded: boolean
  excludedReason: string | null
}

export interface CommissionStatementTotals {
  gmvPiasters: number
  commissionableCount: number
  commissionTotalPiasters: number
  excludedCount: number
  excludedAmountPiasters: number
}

export interface CommissionStatementExport {
  providerNameAr: string
  /** First of the month, ISO — Africa/Cairo semantics. */
  month: string
  /** null while the month has never been issued (a live draft). */
  version: number | null
  status: StatementStatusValue | 'draft'
  issuedAt: string | null
  lines: readonly CommissionStatementLine[]
  totals: CommissionStatementTotals
}

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const

/** "2026-07-01" → "يوليو ٢٠٢٦". Month labels are display, so they live here
 *  beside the export that prints them rather than in a page. */
export function formatStatementMonthAr(month: string): string {
  const [yearRaw, monthRaw] = month.split('-')
  const monthIndex = Number(monthRaw) - 1
  const name = ARABIC_MONTHS[monthIndex]
  if (name === undefined || yearRaw === undefined) {
    throw new Error(`formatStatementMonthAr expects an ISO month like 2026-07-01, got ${month}`)
  }
  return `${name} ${toArabicYear(yearRaw)}`
}

function toArabicYear(year: string): string {
  return year.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)] as string)
}

/**
 * "2026-07-03" → "٣ يوليو" — the statement table's date cell.
 *
 * ⚠ The frames show a day and a month NAME, never an ISO string. Two reasons
 * beyond fidelity: a column of `٢٠٢٦-٠٧-٢٨` is unreadable at a glance when
 * every row shares the same year and month, and the year is already stated once
 * in the scope bar. The whole table is one calendar month by construction.
 */
export function formatStatementDayAr(iso: string): string {
  const [, monthRaw, dayRaw] = iso.split('-')
  const name = ARABIC_MONTHS[Number(monthRaw) - 1]
  if (name === undefined || dayRaw === undefined) {
    throw new Error(`formatStatementDayAr expects an ISO date like 2026-07-03, got ${iso}`)
  }
  return `${toArabicYear(String(Number(dayRaw)))} ${name}`
}

const STATUS_LABEL_AR: Record<StatementStatusValue | 'draft', string> = {
  draft: 'مسودة — لم تُصدر بعد',
  issued: 'صدرت',
  sent: 'أُرسلت',
  settled: 'تمت التسوية',
  superseded: 'نسخة ملغاة',
}

/** RFC 4180: quote anything containing a comma, quote or newline, and double
 *  embedded quotes. A partner's booking ref is safe, but an excluded reason is
 *  free text and one comma would shift every later column. */
function csvCell(value: string | number | null): string {
  const raw = value === null ? '' : String(value)
  return /[",\r\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw
}

function csvRow(cells: readonly (string | number | null)[]): string {
  return cells.map(csvCell).join(',')
}

/**
 * The CSV a partner receives. Identification lines first, then the table.
 *
 * ⚠ Amounts are written BOTH as the Arabic display string (what the partner
 * sees on screen and on paper) and as raw piasters, because a spreadsheet
 * cannot sum Arabic-Indic digits and an accountant will try. Screen and paper
 * agree; the machine column is there so the paper can be checked.
 */
export function buildCommissionStatementCsv(input: CommissionStatementExport): string {
  const versionLabel =
    input.version === null ? 'مسودة (بدون إصدار)' : `الإصدار ${toArabicYear(String(input.version))}`

  const rows: string[] = [
    csvRow(['كشف العمولة — إنستاهيلث']),
    csvRow(['الشريك', input.providerNameAr]),
    csvRow(['الشهر', formatStatementMonthAr(input.month)]),
    csvRow(['الإصدار', versionLabel]),
    csvRow(['الحالة', STATUS_LABEL_AR[input.status]]),
    csvRow(['أُصدرت في', input.issuedAt ?? '—']),
    csvRow([]),
    csvRow([
      'المرجع',
      'تاريخ الحجز',
      'الطريقة',
      'تاريخ الاستحقاق',
      'نوع الاستحقاق',
      'المبلغ',
      'النسبة',
      'العمولة',
      'محتسبة',
      'excluded_reason',
      'amount_piasters',
      'commission_piasters',
    ]),
  ]

  for (const line of input.lines) {
    rows.push(
      csvRow([
        line.bookingRef,
        line.bookingDate,
        line.method === 'cash' ? 'نقداً بالفرع' : 'مدفوع مقدماً',
        line.eventDate ?? '—',
        line.excluded
          ? 'أُغلقت تلقائياً — غير محتسبة'
          : line.eventKind === 'payment'
            ? 'تاريخ الدفع'
            : 'تاريخ الإتمام',
        formatPiastersEgpAr(line.amountPiasters),
        line.ratePercent === null ? '—' : `${toArabicYear(String(line.ratePercent))}٪`,
        line.excluded ? '—' : formatPiastersEgpAr(line.commissionPiasters),
        line.excluded ? 'لا' : 'نعم',
        line.excludedReason ?? '',
        line.amountPiasters,
        line.commissionPiasters,
      ]),
    )
  }

  rows.push(csvRow([]))
  rows.push(
    csvRow([
      'الإجمالي المحتسب',
      '',
      '',
      '',
      '',
      formatPiastersEgpAr(input.totals.gmvPiasters),
      '',
      formatPiastersEgpAr(input.totals.commissionTotalPiasters),
      formatCountedAr(input.totals.commissionableCount, AR_BOOKING),
      '',
      input.totals.gmvPiasters,
      input.totals.commissionTotalPiasters,
    ]),
  )

  // THE FOOTNOTE, always printed — even when the excluded rows are hidden on
  // screen. The founder ruled it must be visible in the open, not tucked into
  // a tooltip, and paper has no tooltips.
  rows.push(csvRow([]))
  rows.push(
    csvRow([
      // Same counted-phrase fix as the on-screen banner: these two cells said
      // «حجوزات … أُغلقت» and «حجز» from fixed strings, so one of them was
      // always wrong for some count.
      'الحجوزات المُغلقة تلقائياً — غير محتسبة',
      formatCountedAr(input.totals.excludedCount, AR_BOOKING_AUTOCLOSED),
      formatPiastersEgpAr(input.totals.excludedAmountPiasters),
      'أغلقها النظام بعد مهلة الـ٢٤ ساعة دون تأكيد وصول — لا عمولة عليها، وليست جزءاً من أي رقم أعلاه',
    ]),
  )
  if (input.status === 'superseded') {
    rows.push(csvRow(['⚠ نسخة ملغاة', 'هذه النسخة استُبدلت بإصدار أحدث — محفوظة للسجل فقط']))
  }

  return rows.join('\r\n')
}
