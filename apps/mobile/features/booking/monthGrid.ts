import { toArabicDigits, type SlotDaySection } from '@instahealth/core'

// The month-view grid from the approved design — pure presentation math over
// core's day sections. A cell is selectable only when its date has an actual
// section with availability; everything else (past, beyond the data-driven
// window, fully booked, other-month lead cells) renders disabled.

export interface MonthCell {
  /** YYYY-MM-DD; null for the empty lead cells before day 1. */
  date: string | null
  labelAr: string
  isToday: boolean
  isSelectable: boolean
  /** Day exists in the slot data but has no available slots ("ممتلئ"). */
  isFull: boolean
}

export interface MonthGrid {
  /** "يوليو ٢٠٢٦" */
  titleAr: string
  /** Sunday-first weekday headers, matching the design's grid. */
  weekdayHeadsAr: string[]
  cells: MonthCell[]
}

const MONTHS_AR = [
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
]

const WEEKDAY_HEADS_AR = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

const CAIRO_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' })

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** Builds the current Cairo month's grid from the picker's day sections. */
export function buildMonthGrid(sections: SlotDaySection[], now: Date): MonthGrid {
  const today = CAIRO_DATE.format(now)
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7)) // 1-based

  const sectionByDate = new Map(sections.map((section) => [section.date, section]))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const leadCells = new Date(Date.UTC(year, month - 1, 1)).getUTCDay() // 0 = Sunday

  const cells: MonthCell[] = []
  for (let lead = 0; lead < leadCells; lead++) {
    cells.push({ date: null, labelAr: '', isToday: false, isSelectable: false, isFull: false })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${year}-${pad2(month)}-${pad2(day)}`
    const section = sectionByDate.get(date)
    cells.push({
      date,
      labelAr: toArabicDigits(String(day)),
      isToday: date === today,
      isSelectable: section !== undefined && section.hasAvailability,
      isFull: section !== undefined && !section.hasAvailability,
    })
  }

  return {
    titleAr: `${MONTHS_AR[month - 1]} ${toArabicDigits(String(year))}`,
    weekdayHeadsAr: WEEKDAY_HEADS_AR,
    cells,
  }
}
