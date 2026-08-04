// Branch profile field rules — the CLIENT mirror of `update_branch_profile`
// (migration 20260804121655). The server is the boundary; this mirror exists so
// the desk is told while typing rather than after saving (same contract as
// service-pricing.ts). Change both sides in the same PR.

import { convertArabicDigits, normalizeEgyptianPhone } from './phone'

export const BRANCH_ADDRESS_MAX_LENGTH = 500

// The server rule: an Egyptian landline/mobile (leading 0, 9–11 digits) OR a
// short-code hotline (leading 1, 4–5 digits). Wide on purpose — "02-25787202"
// (Cairo landline), "048-9101827" (Menoufia landline), "01012345678" (mobile)
// and "15276" (Town Hospital's hotline) are all real shapes in the branches
// table. A contact number is not an SMS target, so the mobile-only rules do
// not apply.
const BRANCH_PHONE_DIGITS = /^0[0-9]{8,10}$/
const BRANCH_HOTLINE_DIGITS = /^1[0-9]{3,4}$/

/**
 * Validates a branch contact number — Egyptian landline, mobile, or short-code
 * hotline. Returns the cleaned display form (trimmed, Arabic-Indic digits
 * folded, separators kept — the desk's formatting is not ours to rewrite), or
 * null when the input is not a plausible Egyptian number.
 */
export function normalizeBranchPhone(input: string): string | null {
  const cleaned = convertArabicDigits(input.trim())
  if (cleaned.length === 0) return null
  const digits = cleaned.replace(/[\s-]/g, '')
  return BRANCH_PHONE_DIGITS.test(digits) || BRANCH_HOTLINE_DIGITS.test(digits) ? cleaned : null
}

/**
 * Validates a branch WhatsApp number — Egyptian MOBILE only (a landline cannot
 * receive WhatsApp), folded to the local `01XXXXXXXXX` form the server stores.
 * Returns null for invalid input; emptiness is the CALLER's question because
 * the field itself is optional.
 */
export function normalizeBranchWhatsapp(input: string): string | null {
  const normalized = normalizeEgyptianPhone(input)
  if (normalized === null) return null
  // E.164 `+201012345678` → local `01012345678`.
  return `0${normalized.slice(3)}`
}

// ── National (+20) display mapping ─────────────────────────────────────────
// The Branch Details design renders phone fields as a 🇪🇬 +20 prefix box plus
// the NATIONAL part ("2 2735 4416"), while the database stores the 0-leading
// local form ("02-27354416") and hotlines verbatim ("15276"). These two map
// between the forms at the UI edge; the stored/server contract is unchanged.

/** True when the digits are a short-code hotline (4–5 digits, 1-leading) —
 * hotlines have no meaningful +20 national form and pass through verbatim. */
function isHotlineDigits(digits: string): boolean {
  return /^1[0-9]{3,4}$/.test(digits)
}

/** Stored form → what the input beside the +20 box shows.
 * "02-27354416" → "2-27354416" · "01012345678" → "1012345678" ·
 * "15276" → "15276" (hotline, verbatim). */
export function branchPhoneToNational(stored: string): string {
  const cleaned = stored.trim()
  const digits = cleaned.replace(/[\s-]/g, '')
  if (isHotlineDigits(digits)) return cleaned
  return cleaned.startsWith('0') ? cleaned.slice(1) : cleaned
}

/** What the desk typed beside +20 → the stored/server 0-leading form.
 * Folds Arabic-Indic digits; keeps the desk's separators. A 1-leading run of
 * 4–5 digits is a hotline and passes verbatim; anything else not already
 * 0-leading gets the 0 back. Validation stays with normalizeBranchPhone —
 * this only recomposes the canonical shape. */
export function nationalToBranchPhone(input: string): string {
  const cleaned = convertArabicDigits(input.trim())
  if (cleaned.length === 0) return cleaned
  const digits = cleaned.replace(/[\s-]/g, '')
  if (isHotlineDigits(digits) || digits.startsWith('0')) return cleaned
  return `0${cleaned}`
}

/** Server refusal → Arabic copy for the profile form (getPriceErrorAr's shape). */
export function getProfileErrorAr(reason: string): string {
  switch (reason) {
    case 'invalid_phone':
      return 'رقم الهاتف غير صالح — أدخل رقماً مصرياً أرضياً أو موبايل أو خطاً ساخناً.'
    case 'invalid_whatsapp':
      return 'رقم الواتساب غير صالح — أدخل رقم موبايل مصري.'
    case 'invalid_address':
      return 'العنوان غير صالح — العنوان بالعربية مطلوب وبحد أقصى ٥٠٠ حرف.'
    case 'branch_not_found':
      return 'تعذّر التعرف على الفرع — سجّل الدخول مرة أخرى.'
    default:
      return 'تعذّر حفظ البيانات — حاول مرة أخرى.'
  }
}
