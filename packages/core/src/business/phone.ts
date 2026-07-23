// Egyptian mobile phone normalization + validation.
// Mirrors the rules in the `send-sms` Edge Function so client validation and
// server SMS agree (the Edge Function returns bare digits `201…`; core returns
// E.164 `+201…` — same digits, one canonical presentation for app code).

const ARABIC_INDIC_ZERO = 0x0660 // ٠
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0 // ۰

const EGYPTIAN_MOBILE_E164 = /^20(10|11|12|15)[0-9]{8}$/

/** Converts Arabic-Indic (٠١٢) and extended Arabic-Indic (۰۱۲) digits to Western. */
export function convertArabicDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (char) => {
    const code = char.charCodeAt(0)
    const digit =
      code >= EXTENDED_ARABIC_INDIC_ZERO
        ? code - EXTENDED_ARABIC_INDIC_ZERO
        : code - ARABIC_INDIC_ZERO
    return String(digit)
  })
}

/**
 * Normalizes messy real-world Egyptian mobile input to E.164 (`+201012345678`).
 * Accepts `01012345678`, `+201012345678`, `00201012345678`, `201012345678`,
 * Arabic-Indic digits, and stray spaces/dashes/parentheses. Returns null when
 * the input is not a valid Egyptian mobile number — never throws.
 */
export function normalizeEgyptianPhone(input: string): string | null {
  if (typeof input !== 'string' || input.length === 0) return null

  const digitsOnly = convertArabicDigits(input).replace(/[\s\-().]/g, '')
  if (!/^\+?\d+$/.test(digitsOnly)) return null

  let digits = digitsOnly.replace(/^\+/, '')
  if (digits.startsWith('0020')) {
    digits = digits.slice(4)
  } else if (digits.startsWith('20')) {
    digits = digits.slice(2)
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1)
  }
  // `digits` should now be the 10-digit local number starting with 1
  const candidate = `20${digits}`

  if (!EGYPTIAN_MOBILE_E164.test(candidate)) return null
  return `+${candidate}`
}

/** True when the input normalizes to a valid Egyptian mobile (010/011/012/015). */
export function isValidEgyptianPhone(input: string): boolean {
  return normalizeEgyptianPhone(input) !== null
}
