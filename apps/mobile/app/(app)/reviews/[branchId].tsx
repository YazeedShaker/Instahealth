import { toArabicDigits } from '@instahealth/core'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'

import { ReviewCard } from '../../../components/reviews/ReviewCard'
import { useBranchReviewSummary, useBranchReviews } from '../../../features/reviews/queries'
import type { BranchReview } from '../../../features/reviews/types'

// F08 — «كل التقييمات (N)», the full list behind the branch profile's button.
//
// ⚠ IT PAGES THROUGH THE SAME FUNCTION THE PREVIEW USES. Three cards on the
// profile and this screen are `get_branch_reviews` with different limits, so
// they cannot disagree about which reviews are published or what order they
// come in — the alternative is two orderings that drift the first time someone
// tweaks one.

const PAGE_SIZE = 20

export default function BranchReviewsScreen() {
  const { branchId } = useLocalSearchParams<{ branchId: string }>()
  const router = useRouter()
  const now = useMemo(() => new Date(), [])
  const [pages, setPages] = useState(1)

  const summaryQuery = useBranchReviewSummary(branchId)
  // One widening query rather than accumulated pages: at this scale a re-fetch
  // of N rows is cheaper than the bookkeeping, and it cannot show a duplicate
  // or drop a row when a review is hidden mid-scroll.
  const reviewsQuery = useBranchReviews(branchId, PAGE_SIZE * pages, 0)

  const reviews: BranchReview[] = reviewsQuery.data ?? []
  const total = summaryQuery.data?.count ?? 0
  const hasMore = reviews.length < total

  return (
    <View className="flex-1 bg-ih-neutral-50">
      <View className="flex-row items-center gap-3 border-b border-ih-neutral-200 bg-white px-5 py-3.5">
        <Pressable
          testID="reviews-back"
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          onPress={() => router.back()}
        >
          <Text className="font-arabic text-[13px] text-ih-primary-600">◂ رجوع</Text>
        </Pressable>
        <Text className="flex-1 font-arabic-bold text-[17px] text-ih-neutral-800">التقييمات</Text>
        {summaryQuery.isSuccess ? (
          <Text testID="reviews-total" className="font-arabic text-[12px] text-ih-neutral-500">
            {toArabicDigits(String(total))} تقييماً
          </Text>
        ) : null}
      </View>

      {reviewsQuery.isPending ? (
        <View className="items-center py-10">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          testID="reviews-list"
          data={reviews}
          keyExtractor={(review) => review.reviewId}
          contentContainerClassName="gap-2.5 px-5 py-4"
          renderItem={({ item }) => (
            <ReviewCard
              displayName={item.displayName}
              rating={item.rating}
              comment={item.comment}
              contextLabel={item.serviceNameAr}
              createdAt={item.createdAt}
              now={now}
            />
          )}
          ListEmptyComponent={
            // ⚠ Reachable only if every review was hidden between the profile
            // and this screen. It states the absence rather than showing a
            // spinner forever.
            <Text
              testID="reviews-list-empty"
              className="py-10 text-center font-arabic text-[13px] text-ih-neutral-500"
            >
              لا تقييمات لعرضها.
            </Text>
          }
          ListFooterComponent={
            hasMore ? (
              <Pressable
                testID="reviews-load-more"
                accessibilityRole="button"
                onPress={() => setPages((current) => current + 1)}
                className="mt-2 items-center justify-center rounded-lg border-[1.5px] border-ih-neutral-300 py-3"
              >
                <Text className="font-arabic-bold text-[13px] text-ih-neutral-800">
                  {reviewsQuery.isFetching ? 'يُحمّل…' : 'عرض المزيد'}
                </Text>
              </Pressable>
            ) : null
          }
        />
      )}
    </View>
  )
}
