import { describe, expect, it } from 'vitest'

import {
  REVIEW_COMMENT_MAX_LENGTH_SERVER,
  REVIEW_ERROR_AR,
  describeReviewError,
  hasPublishedRating,
  type ReviewErrorCode,
} from './reviews'
import { REVIEW_COMMENT_MAX_LENGTH } from '../schemas/review.schema'

describe('describeReviewError', () => {
  it('has Arabic copy for every code the server can return', () => {
    // The list is the contract with the three SECURITY DEFINER functions in
    // migration 20260811183000. Adding a code there without copy here produces
    // a generic alert on a real refusal.
    const codes: ReviewErrorCode[] = [
      'not_authenticated',
      'invalid_rating',
      'comment_too_long',
      'booking_not_found',
      'booking_not_completed',
      'already_reviewed',
      'not_authorized',
      'invalid_state',
      'review_not_found',
    ]
    for (const code of codes) {
      expect(REVIEW_ERROR_AR[code], code).toBeTruthy()
      expect(describeReviewError(code)).toBe(REVIEW_ERROR_AR[code])
    }
  })

  it('falls back rather than rendering a blank alert', () => {
    for (const value of [null, undefined, '', 'something_new_the_server_added']) {
      expect(describeReviewError(value)).toBe('تعذّر إتمام العملية. حاول مرة أخرى.')
    }
  })

  // ⚠ The refusal must not distinguish "no such booking" from "not yours", or
  // the copy leaks what the server deliberately withholds.
  it('does not tell the caller whose booking it was', () => {
    expect(REVIEW_ERROR_AR.booking_not_found).not.toContain('ليس لك')
  })
})

describe('the comment cap', () => {
  it('matches the Zod schema, so client and server refuse the same string', () => {
    expect(REVIEW_COMMENT_MAX_LENGTH_SERVER).toBe(REVIEW_COMMENT_MAX_LENGTH)
  })
})

describe('hasPublishedRating — «لا نجمة كاذبة ولا صفر مخيف»', () => {
  it.each([
    ['a branch with reviews', 4.6, 142, true],
    ['a brand-new branch — count 0, rating at its 0.00 default', 0, 0, false],
    ['a branch whose last review was hidden — rating goes NULL', null, 0, false],
    ['a count with no rating, which should never happen but must not show a star', null, 3, false],
    ['undefined from a partial select', undefined, undefined, false],
    ['a genuine 1.00 average', 1, 2, true],
  ])('%s', (_label, rating, count, expected) => {
    expect(hasPublishedRating(rating as number | null, count as number | null)).toBe(expected)
  })

  it('a rating of 0 with a real count is still a rating, not a zero state', () => {
    // Not reachable today (the CHECK is 1–5), but the guard must key on the
    // COUNT rather than on truthiness of the rating — `rating > 0` would hide a
    // legitimate low score if the scale ever changed.
    expect(hasPublishedRating(0, 5)).toBe(true)
  })
})
