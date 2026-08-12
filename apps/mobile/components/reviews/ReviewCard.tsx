import { formatLastUpdatedAr, starGlyphs } from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { Text, View } from 'react-native'

// One review, per the Reviews Display Addendum's card (frames A and C).
//
// ⚠ THE STAR COLOUR COMES FROM THE TOKEN, NOT THE FRAME'S LITERAL. The addendum
// writes `#D97706` inline in five places; `colors.semantic.warning` resolves to
// the same value and is what the branch header's star badge already uses.
// Copying the hex would be the hand-copied-value drift §3a exists to prevent —
// and it would silently diverge the moment the palette moves.
//
// ⚠ AND THE SUBTITLE DIFFERS BY FRAME, WHICH IS THE WHOLE POINT OF FRAME C.
// On the branch's own reviews it reads «الخدمة · متى»; on a sibling branch's it
// reads «الفرع · متى» — that branch name IS the label that stops a patient
// reading another branch's praise as this one's. The disclaimer above the list
// says so; this line is what makes it true per card.

interface ReviewCardProps {
  displayName: string
  rating: number
  comment: string | null
  /** Frame A: the booking's service. Frame C: the sibling branch's name. */
  contextLabel: string | null
  createdAt: string
  now: Date
}

export function ReviewCard({
  displayName,
  rating,
  comment,
  contextLabel,
  createdAt,
  now,
}: ReviewCardProps) {
  const when = formatLastUpdatedAr(createdAt, now)
  const meta = [contextLabel, when].filter((part) => part !== null && part !== '').join(' · ')

  return (
    <View
      testID="review-card"
      className="gap-2 rounded-xl border border-ih-neutral-200 bg-white p-3.5"
      style={{ shadowColor: colors.primary[700], shadowOpacity: 0.06, shadowRadius: 3 }}
    >
      <View className="flex-row items-center gap-2.5">
        <View
          className="h-[34px] w-[34px] items-center justify-center rounded-full"
          style={{ backgroundColor: colors.primary[50] }}
        >
          <Text
            className="font-arabic-bold text-[14px]"
            style={{ color: colors.primary[700] }}
            // The avatar is decorative — the name is right beside it.
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {displayName.trim().charAt(0)}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-arabic-bold text-[13.5px] text-ih-neutral-800">{displayName}</Text>
          {meta.length > 0 ? (
            <Text className="font-arabic text-[11px] text-ih-neutral-500">{meta}</Text>
          ) : null}
        </View>
      </View>

      <Text
        className="text-[12px]"
        style={{ color: colors.semantic.warning, letterSpacing: 0.5 }}
        accessibilityLabel={`${rating} من ٥`}
      >
        {starGlyphs(rating)}
      </Text>

      {comment !== null && comment.length > 0 ? (
        <Text className="font-arabic text-[13px] leading-[1.75] text-ih-neutral-700">
          {comment}
        </Text>
      ) : (
        // ⚠ A stars-only review is a FIRST-CLASS case, not a missing comment.
        // The frame gives it its own line rather than an empty card.
        <Text testID="review-silent" className="font-arabic text-[12px] text-ih-neutral-500">
          قيّم بالنجوم بلا تعليق.
        </Text>
      )}
    </View>
  )
}
