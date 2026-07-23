const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/** Renders Western digits as Arabic-Indic for display (timers, counters). */
export function toArabicDigits(value: string): string {
  return value.replace(/[0-9]/g, (digit) => ARABIC_INDIC_DIGITS[Number(digit)] as string)
}
