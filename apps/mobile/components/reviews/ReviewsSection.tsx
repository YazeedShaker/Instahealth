import { hasPublishedRating, toArabicDigits } from '@instahealth/core'
import { useRouter } from 'expo-router'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'

import {
  useBranchReviewSummary,
  useBranchReviews,
  useProviderReviewSummary,
} from '../../features/reviews/queries'
import { NoReviewsYet } from './NoReviewsYet'
import { ReviewCard } from './ReviewCard'
import { ReviewSummary } from './ReviewSummary'

// The branch profile's «التقييمات» section — frame A when there is something to
// show, frame C when there is not.
//
// ⚠ WHICH FRAME RENDERS IS DECIDED BY THE COUNT, AND ONLY THE COUNT
// (`hasPublishedRating`). Keying on the average instead would show a zero-star
// score for a new branch, because the column defaults to `0.00` — the exact
// «صفر مخيف» the design refuses. Keying on truthiness of the average would ALSO
// hide a legitimate low score if the scale ever changed.
//
// ⚠ THE SIBLING QUERY IS GATED. A branch WITH reviews must never pay for the
// provider round trip; `enabled` carries that, not an early return, so the hook
// order stays stable across renders.

interface ReviewsSectionProps {
  branchId: string
  providerId: string
  providerNameAr: string
  now: Date
}

const PREVIEW_COUNT = 3

export function ReviewsSection({ branchId, providerId, providerNameAr, now }: ReviewsSectionProps) {
  const router = useRouter()
  const summaryQuery = useBranchReviewSummary(branchId)
  const summary = summaryQuery.data ?? null
  const hasReviews = hasPublishedRating(summary?.average, summary?.count)

  const reviewsQuery = useBranchReviews(branchId, PREVIEW_COUNT, 0, hasReviews)
  const providerQuery = useProviderReviewSummary(
    providerId,
    branchId,
    summaryQuery.isSuccess && !hasReviews,
  )

  if (summaryQuery.isPending) {
    return (
      <View testID="reviews-loading" className="items-center bg-white px-5 py-8">
        <ActivityIndicator />
      </View>
    )
  }

  // ⚠ A FAILED READ IS NOT AN EMPTY BRANCH. Rendering the zero state here would
  // tell a patient a well-reviewed branch has no reviews — a wrong answer looks
  // exactly like a true one. Say nothing instead.
  if (summaryQuery.isError || summary === null) {
    return (
      <View testID="reviews-error" className="bg-white px-5 py-6">
        <Text className="text-center font-arabic text-[12.5px] text-ih-neutral-500">
          تعذّر تحميل التقييمات الآن.
        </Text>
      </View>
    )
  }

  if (!hasReviews) {
    return (
      <NoReviewsYet
        providerNameAr={providerNameAr}
        provider={providerQuery.data ?? null}
        now={now}
      />
    )
  }

  const reviews = reviewsQuery.data ?? []

  return (
    <View testID="reviews-section">
      <View className="border-b border-ih-neutral-200 bg-white px-5 pt-4">
        <Text className="font-arabic-bold text-[17px] text-ih-neutral-800">التقييمات</Text>
      </View>

      <ReviewSummary summary={summary} />

      <View className="gap-2.5 px-5 pb-5 pt-1">
        {reviews.map((review) => (
          <ReviewCard
            key={review.reviewId}
            displayName={review.displayName}
            rating={review.rating}
            comment={review.comment}
            contextLabel={review.serviceNameAr}
            createdAt={review.createdAt}
            now={now}
          />
        ))}

        {/* The count in the label is the SUMMARY's, not the preview's — it is a
            promise about the list behind the button. */}
        {summary.count > reviews.length ? (
          <Pressable
            testID="reviews-see-all"
            accessibilityRole="button"
            onPress={() => router.push(`/reviews/${branchId}`)}
            className="mt-1 items-center justify-center rounded-lg border-[1.5px] border-ih-neutral-300 py-3"
          >
            <Text className="font-arabic-bold text-[13.5px] text-ih-neutral-800">
              كل التقييمات ({toArabicDigits(String(summary.count))})
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
