// Formatting helpers — always through these, never raw locale formatting in apps.
// All date/time formatting is pinned to Africa/Cairo: slots are Egypt wall-clock
// times and must not shift with the viewer's device timezone.

export type SupportedLocale = 'ar' | 'en'

const EGYPT_TIME_ZONE = 'Africa/Cairo'

const CURRENCY_FORMATTERS: Record<SupportedLocale, Intl.NumberFormat> = {
  ar: new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }),
  en: new Intl.NumberFormat('en-EG', { style: 'currency', currency: 'EGP' }),
}

const ARABIC_DATE_FORMATTER = new Intl.DateTimeFormat('ar-EG', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: EGYPT_TIME_ZONE,
})

const TIME_FORMATTERS: Record<SupportedLocale, Intl.DateTimeFormat> = {
  ar: new Intl.DateTimeFormat('ar-EG', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: EGYPT_TIME_ZONE,
  }),
  en: new Intl.DateTimeFormat('en-EG', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: EGYPT_TIME_ZONE,
  }),
}

// Structured parts, never a formatted string. `formatToParts` is the ONLY safe
// way to read a zoned wall clock across engines — see cairoWallClockToInstant.
const CAIRO_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: EGYPT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

const MS_PER_SECOND = 1000

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  return Number(parts.find((part) => part.type === type)?.value)
}

/** Cairo's offset from UTC at a given instant, in ms. Derived, not assumed —
 * Egypt has re-introduced DST before and may again. */
function cairoOffsetMsAt(instant: Date): number {
  const parts = CAIRO_PARTS_FORMATTER.formatToParts(instant)
  const cairoWallClockAsUtc = Date.UTC(
    readPart(parts, 'year'),
    readPart(parts, 'month') - 1,
    readPart(parts, 'day'),
    readPart(parts, 'hour'),
    readPart(parts, 'minute'),
    readPart(parts, 'second'),
  )
  // The parts carry no milliseconds, so compare against a whole-second instant
  // or every offset picks up a spurious sub-second remainder.
  const instantAtSecond = Math.floor(instant.getTime() / MS_PER_SECOND) * MS_PER_SECOND
  return cairoWallClockAsUtc - instantAtSecond
}

const SLOT_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const SLOT_TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/

/**
 * Turns an Egypt WALL-CLOCK `slot_date` + `slot_time` (the DB stores no zone)
 * into the real instant, whatever timezone the device is in. A patient whose
 * phone is on GMT must still get a reminder at the Cairo hour they booked.
 *
 * ⚠ Do NOT reimplement this as
 * `new Date(d.toLocaleString('en-US', { timeZone })).getTime() - …`. That
 * round-trip only works on V8: it formats to `"7/28/2026, 3:00:00 PM"` and
 * relies on `Date`'s parser accepting it. **Hermes parses only ISO 8601**, so on
 * a real device it returns Invalid Date, the offset becomes `NaN`, and the
 * resulting Date blows up as `RangeError: Date value out of bounds` at the far
 * end (found on an iPhone — add-to-calendar failed for every booking).
 * `formatToParts` reads the same information structurally and never parses.
 *
 * @throws if either value is malformed — callers pass DB columns, so a bad
 * shape is a bug, not a user input to tolerate.
 */
export function cairoWallClockToInstant(slotDate: string, slotTime: string): Date {
  const dateMatch = SLOT_DATE_RE.exec(slotDate)
  const timeMatch = SLOT_TIME_RE.exec(slotTime)
  if (dateMatch === null) throw new Error(`cairoWallClockToInstant: bad slotDate "${slotDate}"`)
  if (timeMatch === null) throw new Error(`cairoWallClockToInstant: bad slotTime "${slotTime}"`)

  const naiveUtc = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    Number(timeMatch[3] ?? 0),
  )
  // Cairo sits within a day of UTC, so the offset read at the naive instant is
  // the offset that applies at the true one.
  return new Date(naiveUtc - cairoOffsetMsAt(new Date(naiveUtc)))
}

/**
 * The Cairo calendar date at a given instant, as `YYYY-MM-DD`.
 *
 * This is the date the DASHBOARD means by "today", and it must be Cairo's, not
 * the viewer's: a receptionist on a laptop whose clock says UTC would otherwise
 * see the wrong day's list for two hours every night. It is also the value
 * compared against `slots.slot_date`, which is a bare Egypt wall-clock date
 * with no zone of its own.
 *
 * Built from `formatToParts` rather than `toISOString().slice(0, 10)` — the
 * latter is the UTC date, which is a different day for part of every evening.
 */
export function formatCairoIsoDate(now: Date): string {
  const parts = CAIRO_PARTS_FORMATTER.formatToParts(now)
  const year = String(readPart(parts, 'year')).padStart(4, '0')
  const month = String(readPart(parts, 'month')).padStart(2, '0')
  const day = String(readPart(parts, 'day')).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** Renders Western digits as Arabic-Indic for display (timers, distances, counters). */
export function toArabicDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) => ARABIC_INDIC_DIGITS[Number(digit)] as string)
}

/** "22:00" → "١٠م", "09:30" → "٩:٣٠ص" — the compact Arabic time label from the designs. */
export function formatTimeShortAr(time: string): string {
  const [hourStr = '0', minuteStr = '00'] = time.split(':')
  const hour = Number(hourStr) % 24
  const minute = Number(minuteStr)
  const suffix = hour < 12 ? 'ص' : 'م'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  const base = minute === 0 ? String(hour12) : `${hour12}:${String(minute).padStart(2, '0')}`
  return `${toArabicDigits(base)}${suffix}`
}

/** EGP currency string. The UI applies fonts (Latin refs render in Atkinson) — core just returns the string. */
export function formatEGP(amount: number, locale: SupportedLocale): string {
  return CURRENCY_FORMATTERS[locale].format(amount)
}

/** Arabic weekday + day + month — the booking-card date format. */
export function formatArabicDate(date: Date): string {
  return ARABIC_DATE_FORMATTER.format(date)
}

/** The Arabic thousands separator (U+066C) and decimal mark (U+066B). The
 *  commission statement groups thousands — «٤٬١٥٠», not «٤١٥٠» — because a
 *  partner reads these figures off paper and an ungrouped five-digit number is
 *  where a dispute starts. */
const ARABIC_THOUSANDS_SEPARATOR = '٬'
const ARABIC_DECIMAL_MARK = '٫'

/**
 * Money for the commission statement, from INTEGER PIASTERS — the unit the
 * whole money path uses (CLAUDE.md §7). Whole pounds render without decimals
 * («٤٬١٥٠»), fractional ones with exactly two («٥٢١٫٤٠»), matching the approved
 * frames. The caller appends its own «ج.م», per the design.
 *
 * ⚠ Takes PIASTERS, not pounds. Formatting from a float total is how rounding
 * drift reaches a partner's invoice; the statement never holds a float.
 */
export function formatPiastersEgpAr(piasters: number): string {
  if (!Number.isFinite(piasters)) {
    throw new Error(`formatPiastersEgpAr expects a finite piaster amount, got ${String(piasters)}`)
  }
  const rounded = Math.round(piasters)
  const sign = rounded < 0 ? '-' : ''
  const absolute = Math.abs(rounded)
  const pounds = Math.floor(absolute / 100)
  const remainder = absolute % 100

  const grouped = String(pounds).replace(/\B(?=(\d{3})+(?!\d))/g, ARABIC_THOUSANDS_SEPARATOR)
  const body =
    remainder === 0
      ? grouped
      : `${grouped}${ARABIC_DECIMAL_MARK}${String(remainder).padStart(2, '0')}`

  return `${sign}${toArabicDigits(body)}`
}

/** The time-strip label from the approved designs (e.g. ٩:٣٠ ص / 9:30 AM). */
export function formatSlotTime(startsAt: Date, locale: SupportedLocale): string {
  return TIME_FORMATTERS[locale].format(startsAt)
}
