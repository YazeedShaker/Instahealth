// P03 — the rules behind the prices editor. Shared so the dashboard's guard
// rails and any future admin surface agree, and so the numbers are testable
// without a browser.

import { toArabicDigits } from './format'

/** Server bounds, mirrored from `update_branch_service`. A price of 0 is not
 * "free" — it is a typo; a genuinely free service is made unavailable instead.
 * DISPLAY PREDICATE = ENFORCEMENT PREDICATE: the form refuses exactly what the
 * RPC refuses, so the desk never gets a server error it could have been told
 * about while typing. */
export const MIN_SERVICE_PRICE_EGP = 1
export const MAX_SERVICE_PRICE_EGP = 100000

/** The server's absurd-jump ratio, also mirrored. Deliberately far wider than
 * the confirm threshold below: this is the fat-finger boundary (an extra
 * digit), not a judgement about pricing. */
export const MAX_PRICE_CHANGE_RATIO = 10

export type PriceValidationError = 'empty' | 'not_a_number' | 'out_of_bounds' | 'change_too_large'

/**
 * Validates a typed price against the SAME rules the RPC enforces.
 * Returns null when the value is acceptable.
 */
export function validateServicePrice(
  raw: string,
  currentPrice: number,
): PriceValidationError | null {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return 'empty'
  // Integers only: EGP piaster precision is not something a price list needs,
  // and "150.5" typed on a shared desk is far more likely a slip than intent.
  if (!/^\d+$/.test(trimmed)) return 'not_a_number'

  const value = Number(trimmed)
  if (!Number.isFinite(value)) return 'not_a_number'
  if (value < MIN_SERVICE_PRICE_EGP || value > MAX_SERVICE_PRICE_EGP) return 'out_of_bounds'

  if (currentPrice > 0) {
    if (value > currentPrice * MAX_PRICE_CHANGE_RATIO) return 'change_too_large'
    if (value < currentPrice / MAX_PRICE_CHANGE_RATIO) return 'change_too_large'
  }
  return null
}

/** Percentage change, rounded. Positive is a rise. */
export function getPriceChangePercent(currentPrice: number, nextPrice: number): number {
  if (currentPrice <= 0) return 0
  return Math.round(((nextPrice - currentPrice) / currentPrice) * 100)
}

/**
 * Whether a change is big enough to demand the type-to-confirm step.
 *
 * The approved design's rule, kept verbatim: more than half again, OR more
 * than 200 EGP in absolute terms. The absolute arm matters because 50% of a
 * cheap test is pocket change while 50% of a scan is real money — a percentage
 * alone would nag on the former and wave through the latter.
 *
 * This is UX insurance on a shared desk computer. The REAL guard is the
 * server's 10x ratio; these two are deliberately different numbers.
 */
export function isBigPriceChange(currentPrice: number, nextPrice: number): boolean {
  if (currentPrice <= 0) return false
  const difference = Math.abs(nextPrice - currentPrice)
  return difference / currentPrice > 0.5 || difference > 200
}

/**
 * "آخر تحديث" — how long ago the price last changed.
 *
 * Returns null when it has NEVER been edited, and the caller renders the
 * design's «لم يُحدَّث بعد» rather than a fabricated date. Empty means absent:
 * a placeholder price that no partner has confirmed must not look maintained.
 */
export function formatLastUpdatedAr(changedAt: string | null, now: Date): string | null {
  if (changedAt === null) return null
  const then = new Date(changedAt)
  if (Number.isNaN(then.getTime())) return null

  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000)
  if (minutes < 1) return 'الآن'
  if (minutes < 60) return 'خلال الساعة'

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return 'اليوم'
  const days = Math.floor(hours / 24)
  if (days === 1) return 'أمس'
  if (days < 7) return `قبل ${toArabicDigits(String(days))} أيام`
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return weeks === 1 ? 'قبل أسبوع' : `قبل ${toArabicDigits(String(weeks))} أسابيع`
  }
  const months = Math.floor(days / 30)
  return months === 1 ? 'قبل شهر' : `قبل ${toArabicDigits(String(months))} أشهر`
}

/** Arabic messages for what the RPC can refuse, so an error the desk sees is
 * never a raw server string. */
export function getPriceErrorAr(error: PriceValidationError | string): string {
  switch (error) {
    case 'empty':
      return 'اكتب السعر أولاً.'
    case 'not_a_number':
      return 'السعر يجب أن يكون رقماً صحيحاً بدون كسور.'
    case 'out_of_bounds':
    case 'price_out_of_bounds':
      return `السعر يجب أن يكون بين ${toArabicDigits(String(MIN_SERVICE_PRICE_EGP))} و ${toArabicDigits(String(MAX_SERVICE_PRICE_EGP))} جنيه.`
    case 'change_too_large':
    case 'price_change_too_large':
      return 'التغيير كبير جداً — راجع الرقم، أو عدّل السعر على خطوات.'
    case 'service_not_found':
      return 'لا تملك صلاحية تعديل هذه الخدمة.'
    default:
      return 'تعذّر حفظ السعر — تحقق من الاتصال وحاول مرة أخرى.'
  }
}
