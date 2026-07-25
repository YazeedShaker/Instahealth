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

/** The time-strip label from the approved designs (e.g. ٩:٣٠ ص / 9:30 AM). */
export function formatSlotTime(startsAt: Date, locale: SupportedLocale): string {
  return TIME_FORMATTERS[locale].format(startsAt)
}
