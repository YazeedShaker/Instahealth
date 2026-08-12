// F08 — the shapes the review RPCs return, mirrored on the client.
//
// ⚠ These mirror the JSONB built in migrations 20260811183000 and
// 20260812150000. The generated `database.ts` types a JSONB return as `Json`,
// which is true and useless, so the shape is declared once here rather than
// cast at every call site.

/** One published review, as the branch profile and the full list render it. */
export interface BranchReview {
  reviewId: string
  rating: number
  /** NULL for a stars-only review — the frame renders «قيّم بالنجوم بلا تعليق.» */
  comment: string | null
  /** «هالة ف.» — composed server-side at insert, never re-derived. */
  displayName: string
  /** The booking's FIRST service. A booking can carry several; the frame draws one. */
  serviceNameAr: string | null
  createdAt: string
}

/** A sibling branch's review, shown only in the zero state. The branch name IS
 *  the label that keeps it from being mistaken for this branch's own. */
export interface ProviderReview extends Omit<BranchReview, 'serviceNameAr'> {
  branchNameAr: string
}

export interface RatingBucket {
  stars: number
  count: number
  percent: number
}

export interface BranchReviewSummary {
  branchId: string
  /** ⚠ NULL when nothing is published — never 0. A branch with no reviews and a
   *  branch rated zero must not be the same value on screen. */
  average: number | null
  count: number
  /** Always five buckets, 5★ first. A missing value is a zero-length bar. */
  distribution: RatingBucket[]
}

export interface ProviderReviewSummary {
  providerId: string
  /** The weighted mean of review ROWS across the provider's OTHER branches. */
  average: number | null
  count: number
  branchCount: number
  reviews: ProviderReview[]
}

/** What `get_my_review` says about the caller's own review of one booking. */
export interface MyReview {
  found: boolean
  reviewId?: string
  rating?: number
  comment?: string | null
  displayName?: string
  /** ⚠ False when an admin hid it. The author is NOT told — the client needs
   *  this only so the prompt does not reappear on a booking that already has a
   *  review the UNIQUE constraint would refuse. */
  isPublished?: boolean
  createdAt?: string
}
