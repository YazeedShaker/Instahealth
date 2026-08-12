import { formatRatingAr, starGlyphs, toArabicDigits } from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { Text, View } from 'react-native'

import type { BranchReviewSummary } from '../../features/reviews/types'

// The summary block from frame A: the big average, the five distribution bars,
// and the verified line.
//
// ⚠ IT IS NEVER RENDERED FOR A BRANCH WITH NO REVIEWS. The caller decides that
// (`hasPublishedRating`), because the honest zero state is a different frame
// entirely — «لا نجمة كاذبة ولا صفر مخيف». If this component ever has to guard
// against `average === null` itself, something upstream has gone wrong.

export function ReviewSummary({ summary }: { summary: BranchReviewSummary }) {
  const average = formatRatingAr(summary.average)

  return (
    <View testID="review-summary" className="gap-3.5 bg-white px-5 py-4">
      <View className="items-center gap-1">
        <Text
          className="font-arabic-bold text-[38px] leading-[42px] text-ih-neutral-800"
          // Tabular figures so the number does not jitter between branches.
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {average}
        </Text>
        <Text
          className="text-[14px]"
          style={{ color: colors.semantic.warning, letterSpacing: 0.8 }}
          accessibilityLabel={`متوسط التقييم ${average} من ٥`}
        >
          {starGlyphs(summary.average ?? 0)}
        </Text>
        <Text testID="review-count" className="font-arabic text-[11.5px] text-ih-neutral-500">
          {toArabicDigits(String(summary.count))} تقييماً
        </Text>
      </View>

      <View className="gap-[5px]">
        {summary.distribution.map((bucket) => (
          <View key={bucket.stars} className="flex-row items-center gap-2">
            <Text
              className="w-[30px] font-arabic text-[11.5px] text-ih-neutral-600"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {toArabicDigits(String(bucket.stars))} ★
            </Text>
            {/* The track is always full width; the fill is the percentage. A
                star nobody gave is a zero-length bar, not an absent row. */}
            <View className="h-[7px] flex-1 overflow-hidden rounded-full bg-ih-neutral-100">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${bucket.percent}%`,
                  backgroundColor: colors.semantic.warning,
                }}
              />
            </View>
            <Text
              className="w-[26px] text-start font-arabic text-[11px] text-ih-neutral-500"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {toArabicDigits(String(bucket.count))}
            </Text>
          </View>
        ))}
      </View>

      {/* ⚠ THIS LINE IS A PROMISE THE SCHEMA KEEPS, not marketing. `submit_review`
          only accepts a review from the owner of a COMPLETED booking at this
          branch, and `is_verified` is set by the writer rather than accepted
          from the client — so there is no path that puts an unverified review
          behind this sentence. */}
      <View className="flex-row items-center gap-2 rounded-lg border border-ih-neutral-200 bg-ih-neutral-50 px-3 py-2.5">
        <Text className="text-[13px]" accessibilityElementsHidden importantForAccessibility="no">
          ✓
        </Text>
        <Text className="flex-1 font-arabic text-[11.5px] leading-[1.6] text-ih-neutral-600">
          كل تقييم من مريض أكمل زيارته فعلاً في هذا الفرع.
        </Text>
      </View>
    </View>
  )
}
