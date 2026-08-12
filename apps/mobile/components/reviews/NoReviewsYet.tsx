import { formatRatingAr } from '@instahealth/core'
import { Text, View } from 'react-native'

import type { ProviderReviewSummary } from '../../features/reviews/types'
import { ReviewCard } from './ReviewCard'

// Frame C — «فرع جديد — لا نجمة كاذبة ولا صفر مخيف».
//
// ⚠ THE WHOLE POINT IS WHAT IS *NOT* HERE. No stars, no «٠٫٠», no empty
// five-bar chart. A branch that opened last week has no rating, and drawing one
// as a zero is a lie about its quality rather than an absence of information.
// `branches.rating` defaults to `0.00` and becomes NULL once the last published
// review is hidden, so "no reviews" arrives as 0, as NULL and as 0.00 depending
// on the route in — which is exactly why the caller keys on the COUNT.
//
// ⚠ AND THE SIBLING REVIEWS ARE LABELLED, NEVER MIXED. The provider figure is
// computed excluding this branch, and each card carries its own branch name, so
// the disclaimer «ولا تُخلط في نجمة الفرع» is true at both levels — the number
// and the cards.

interface NoReviewsYetProps {
  providerNameAr: string
  provider: ProviderReviewSummary | null
  now: Date
}

export function NoReviewsYet({ providerNameAr, provider, now }: NoReviewsYetProps) {
  const providerAverage = formatRatingAr(provider?.average ?? null)
  const hasSiblings = provider !== null && provider.count > 0 && provider.reviews.length > 0

  return (
    <View testID="reviews-zero-state">
      <View className="items-center gap-2.5 border-b border-ih-neutral-200 bg-white px-5 py-6">
        <Text className="text-[24px]" accessibilityElementsHidden importantForAccessibility="no">
          🆕
        </Text>
        <Text className="text-center font-arabic-bold text-[15.5px] text-ih-neutral-800">
          فرع جديد — لا تقييمات بعد
        </Text>
        <Text className="text-center font-arabic text-[13px] leading-[1.75] text-ih-neutral-600">
          {/* The second sentence only appears when the provider genuinely has
              reviews elsewhere. Claiming a provider-level score that does not
              exist would be the same dishonesty one level up. */}
          {hasSiblings && providerAverage !== null
            ? `افتُتح هذا الفرع حديثاً، فلم يقيّمه أحد حتى الآن. هذا لا يعني شيئاً عن جودته — ${providerNameAr} تحمل ${providerAverage} من ٥ في فروعها الأخرى.`
            : 'افتُتح هذا الفرع حديثاً، فلم يقيّمه أحد حتى الآن. هذا لا يعني شيئاً عن جودته — كن أول من يشاركنا رأيه بعد زيارتك.'}
        </Text>
      </View>

      {hasSiblings ? (
        <View className="gap-2.5 px-5 py-4">
          <Text className="font-arabic-bold text-[13px] text-ih-neutral-700">
            تقييمات فروع {providerNameAr} الأخرى
          </Text>
          {provider.reviews.map((review) => (
            <ReviewCard
              key={review.reviewId}
              displayName={review.displayName}
              rating={review.rating}
              comment={review.comment}
              // ⚠ The BRANCH name, not a service — this is the label.
              contextLabel={review.branchNameAr}
              createdAt={review.createdAt}
              now={now}
            />
          ))}
          <Text className="font-arabic text-[11.5px] leading-[1.7] text-ih-neutral-500">
            تُعرض تقييمات المزود عند غياب تقييمات الفرع، بوسمها الواضح — ولا تُخلط في نجمة الفرع.
          </Text>
        </View>
      ) : null}
    </View>
  )
}
