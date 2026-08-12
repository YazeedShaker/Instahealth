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
