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
