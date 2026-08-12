import { toArabicDigits } from './format'

// F08 — the shared half of reviews: what the server can refuse, and what the
// patient reads when it does.
//
// ⚠ THIS LIVES IN CORE, NOT IN AN APP, AND THAT IS A DEPARTURE WORTH STATING.
// Every other writer's error copy sits beside its server action in
// `apps/web/app/admin/*-actions.ts`, because every other writer is called from
// exactly one app. `submit_review` is called from MOBILE and
// `admin_set_review_hidden` from WEB, and they share an error vocabulary — so
// two copies would be two chances to word the same refusal differently
// (CLAUDE.md §4: if both apps need it, it goes in core).

/** Every `error` code `submit_review` / `admin_set_review_hidden` /
 *  `get_my_review` can return. Kept exhaustive on purpose: a code the UI has no
 *  copy for is a blank alert, and `describeReviewError` falls back rather than
 *  rendering one — but the fallback is a bug, not a design. */
export type ReviewErrorCode =
  | 'not_authenticated'
  | 'invalid_rating'
  | 'comment_too_long'
  | 'booking_not_found'
  | 'booking_not_completed'
  | 'already_reviewed'
  | 'not_authorized'
  | 'invalid_state'
  | 'review_not_found'

export const REVIEW_ERROR_AR: Record<ReviewErrorCode, string> = {
  not_authenticated: 'سجّل الدخول أولاً لتقييم زيارتك.',
  invalid_rating: 'التقييم من ١ إلى ٥ نجوم.',
  comment_too_long: 'التعليق طويل جداً (الحد الأقصى ٥٠٠ حرف).',
  // ⚠ Deliberately NOT «هذا الحجز ليس لك». The server returns the same code for
  // "no such booking" and "not yours" so a stranger's booking id cannot be
  // confirmed to exist by the wording of a refusal — and the copy must not
  // undo that.
  booking_not_found: 'لم يُعثر على هذا الحجز.',
  booking_not_completed: 'يمكنك التقييم بعد أن تكتمل زيارتك فعلاً.',
  already_reviewed: 'قيّمت هذه الزيارة من قبل — التقييم يُرسَل مرة واحدة.',
  not_authorized: 'لا تملك صلاحية هذا الإجراء.',
  invalid_state: 'حالة غير صالحة.',
  review_not_found: 'لم يُعثر على هذا التقييم.',
}

const FALLBACK_AR = 'تعذّر إتمام العملية. حاول مرة أخرى.'

/** Arabic for a code the server returned, without trusting it to be known. */
export function describeReviewError(code: string | null | undefined): string {
  if (code === null || code === undefined) return FALLBACK_AR
  return REVIEW_ERROR_AR[code as ReviewErrorCode] ?? FALLBACK_AR
}

/** The comment cap the SERVER enforces. `reviewSchema` carries the same number
 *  for the client-side check; `submit_review` re-checks it because a modified
 *  client simply does not run Zod (CLAUDE.md §8). If one moves, both move. */
export const REVIEW_COMMENT_MAX_LENGTH_SERVER = 500

/**
 * Is this branch's star rating safe to show at all?
 *
 * ⚠ THE ZERO STATE KEYS ON THE COUNT, NEVER ON THE RATING. `branches.rating`
 * defaults to `0.00` and becomes NULL once the last published review is hidden,
 * so "no reviews yet" reaches the UI as 0, as NULL, and as 0.00 depending on how
 * the branch got there. All three must render the frame's «فرع جديد — لا
 * تقييمات بعد», and none of them may render as a zero-star score — the design's
 * whole point is «لا نجمة كاذبة ولا صفر مخيف».
 */
export function hasPublishedRating(
  rating: number | null | undefined,
  reviewCount: number | null | undefined,
): boolean {
  return (reviewCount ?? 0) > 0 && rating !== null && rating !== undefined
}

// ── Display vocabulary ──────────────────────────────────────────────────────

/** The live label under the star picker — the frame shows «أربع نجوم — جيدة»
 *  for four, which is the only rung it draws.
 *
 * ⚠ THE OTHER FOUR RUNGS ARE COMPOSED, NOT TRANSCRIBED. The addendum gives one
 * data point and the picker needs five, so the ladder is built to match its
 * register (a plain count, an em-dash, one adjective) and flagged for the
 * founder in EXPORT.md alongside the thanks state. If the bundle is revised
 * with real copy, this is the one place it changes. */
const STAR_LADDER_AR: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'نجمة واحدة — سيئة',
  2: 'نجمتان — دون المتوقع',
  3: 'ثلاث نجوم — مقبولة',
  4: 'أربع نجوم — جيدة',
  5: 'خمس نجوم — ممتازة',
}

/** `null` until the patient has picked — the label is absent, not "zero stars". */
export function starLabelAr(rating: number | null | undefined): string | null {
  if (rating === null || rating === undefined) return null
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null
  return STAR_LADDER_AR[rating as 1 | 2 | 3 | 4 | 5]
}

/** «★★★★☆» — filled then hollow, which is how the frame draws a partial score.
 *  Never a half star: the design has no glyph for one. */
export function starGlyphs(rating: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(rating)))
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}

/** The average, formatted as the frame draws it — one decimal, Arabic-Indic.
 *  Returns null when there is nothing to average, so the caller renders the
 *  zero state rather than a number.
 *
 * ⚠ THE DECIMAL MARK IS U+066B «٫», NOT AN ASCII PERIOD. `toArabicDigits` maps
 * digits only, so `(4.6).toFixed(1)` comes through as «٤.٦» — Arabic-Indic
 * numerals around a Latin separator. That is the exact defect the A07 fill
 * percentage shipped with and PR #58 fixed; `formatPiastersEgpAr` has used the
 * Arabic mark since A02 for the same reason. The test above is what caught it
 * here before anyone saw a screen. */
export function formatRatingAr(average: number | null | undefined): string | null {
  if (average === null || average === undefined) return null
  return toArabicDigits(average.toFixed(1)).replace('.', '٫')
}
