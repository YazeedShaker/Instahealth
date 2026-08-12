import {
  REVIEW_COMMENT_MAX_LENGTH,
  describeReviewError,
  formatArabicDate,
  formatTimeShortAr,
  starGlyphs,
} from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native'

import { StarPicker } from '../../../components/reviews/StarPicker'
import { useMyBookings } from '../../../features/bookings/queries'
import { useMyReview, useSubmitReview } from '../../../features/reviews/queries'

// F08 — «كيف كانت زيارتك؟», frame B, plus the thanks state the addendum never
// drew (founder ruling 2026-08-12: compose it from the component contract, and
// flag the bundle for a revision note in EXPORT.md).
//
// ⚠ THE PROMPT IS DECIDED BY `get_my_review`, NOT BY READING THE TABLE. A
// review an admin hid is invisible to its own author through the public policy,
// so a table read would say "no review", offer the prompt again, and dead-end on
// UNIQUE(booking_id) with a refusal the patient cannot act on. §1.4: the screen
// decides on the same fact the database enforces.
//
// ⚠ AND ELIGIBILITY IS NOT A UI RULE. The server refuses anything that is not a
// completed booking of the caller's; this screen mirrors that so the patient
// sees the reason rather than a failure, but the mirror is the courtesy and the
// server is the rule.

export default function RateVisitScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const router = useRouter()

  const [rating, setRating] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [errorAr, setErrorAr] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const bookingsQuery = useMyBookings()
  const booking = (bookingsQuery.data ?? []).find((row) => row.id === bookingId) ?? null

  const myReviewQuery = useMyReview(bookingId)
  const mine = myReviewQuery.data ?? null

  const submitReview = useSubmitReview(bookingId, booking?.branchId)

  const onSubmit = () => {
    if (rating === null || submitReview.isPending) return
    setErrorAr(null)
    submitReview.mutate(
      { rating, comment: comment.trim().length === 0 ? null : comment.trim() },
      {
        onSuccess: (result) => {
          // ⚠ A refusal is an ANSWER, not a fault — `submit_review` returns
          // {ok:false, error} and the copy for every code lives in core.
          if (!result.ok) setErrorAr(describeReviewError(result.error))
          else setSubmitted(true)
        },
        onError: () => setErrorAr(describeReviewError(null)),
      },
    )
  }

  if (bookingsQuery.isPending || myReviewQuery.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-ih-neutral-50">
        <ActivityIndicator />
      </View>
    )
  }

  const alreadyReviewed = mine?.found === true

  return (
    <ScrollView className="flex-1 bg-ih-neutral-50" contentContainerClassName="p-4">
      <View className="overflow-hidden rounded-2xl border border-ih-neutral-200 bg-white">
        <View className="gap-1 p-4" style={{ backgroundColor: colors.primary[700] }}>
          <Text className="font-arabic-bold text-[16px] text-white">
            {submitted || alreadyReviewed ? 'شكراً لتقييمك' : 'كيف كانت زيارتك؟'}
          </Text>
          <Text
            className="font-arabic text-[12.5px] leading-[1.6]"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            {booking === null
              ? '—'
              : `${booking.branchNameAr} · ${formatArabicDate(new Date(booking.slotDate))} ${formatTimeShortAr(booking.slotTime)}`}
          </Text>
        </View>

        {submitted || alreadyReviewed ? (
          // ── The thanks / already-rated state ────────────────────────────
          // ⚠ ONE COMPONENT, NOT TWO. Rendering a different element TYPE after
          // the submit is exactly what destroyed A01's recovery codes: React
          // unmounts the old instance at that position. The state is a PROP of
          // the same tree, so the type never changes (§9).
          <View testID="review-thanks" className="items-center gap-3 p-6">
            <Text
              className="text-[28px]"
              accessibilityElementsHidden
              importantForAccessibility="no"
            >
              ✅
            </Text>
            <Text className="text-center font-arabic text-[13px] leading-[1.75] text-ih-neutral-600">
              {submitted
                ? 'وصلنا تقييمك ويظهر الآن في صفحة الفرع. التقييم يُرسَل مرة واحدة لكل زيارة ولا يمكن تعديله.'
                : 'قيّمت هذه الزيارة من قبل. التقييم يُرسَل مرة واحدة لكل زيارة ولا يمكن تعديله.'}
            </Text>
            <Text
              testID="review-given-rating"
              className="text-[18px]"
              style={{ color: colors.semantic.warning, letterSpacing: 1 }}
              accessibilityLabel={`قيّمت بـ ${rating ?? mine?.rating ?? 0} من ٥`}
            >
              {starGlyphs(rating ?? mine?.rating ?? 0)}
            </Text>
            <Pressable
              testID="review-done"
              accessibilityRole="button"
              onPress={() => router.back()}
              className="mt-1 items-center justify-center rounded-lg px-6 py-3"
              style={{ backgroundColor: colors.primary[400] }}
            >
              <Text className="font-arabic-bold text-[14px] text-white">تمام</Text>
            </Pressable>
          </View>
        ) : (
          // ── The prompt ──────────────────────────────────────────────────
          <View className="gap-4 px-4 py-5">
            <StarPicker value={rating} onChange={setRating} />

            <View className="gap-1.5">
              <Text className="font-arabic text-[12.5px] font-semibold text-ih-neutral-700">
                تعليق <Text className="font-arabic text-ih-neutral-500">(اختياري)</Text>
              </Text>
              <TextInput
                testID="review-comment"
                value={comment}
                onChangeText={setComment}
                // The server enforces the same 500 too — this is the courtesy,
                // not the rule (CLAUDE.md §8).
                maxLength={REVIEW_COMMENT_MAX_LENGTH}
                multiline
                textAlignVertical="top"
                placeholder="ما الذي أعجبك أو ما الذي يمكن أن يكون أفضل؟"
                placeholderTextColor={colors.neutral[400]}
                className="min-h-[88px] rounded-lg border-[1.5px] border-ih-neutral-200 bg-white p-3 font-arabic text-[13.5px] leading-[1.7] text-ih-neutral-800"
              />
            </View>

            {/* The name-preview line: the promise the stored `display_name`
                keeps. It says exactly how the byline will read, and the writer
                composes that string once at insert so a later profile edit
                cannot rewrite a published review. */}
            <View className="flex-row items-start gap-2 rounded-lg border border-ih-neutral-200 bg-ih-neutral-50 px-3 py-2.5">
              <Text
                className="text-[13px]"
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                ℹ
              </Text>
              <Text className="flex-1 font-arabic text-[11.5px] leading-[1.65] text-ih-neutral-600">
                يظهر تقييمك باسمك الأول وأول حرف من اسم العائلة، مع الخدمة والتاريخ. رقم هاتفك لا
                يظهر أبداً.
              </Text>
            </View>

            {errorAr !== null ? (
              <Text
                testID="review-error"
                accessibilityRole="alert"
                className="rounded-lg px-3 py-2.5 font-arabic text-[12.5px]"
                style={{
                  backgroundColor: colors.semantic.warningBg,
                  color: colors.semantic.warningText,
                }}
              >
                {errorAr}
              </Text>
            ) : null}

            <Pressable
              testID="review-submit"
              accessibilityRole="button"
              accessibilityState={{ disabled: rating === null || submitReview.isPending }}
              disabled={rating === null || submitReview.isPending}
              onPress={onSubmit}
              className="h-[52px] items-center justify-center rounded-lg"
              style={{
                backgroundColor: colors.primary[400],
                opacity: rating === null || submitReview.isPending ? 0.45 : 1,
              }}
            >
              <Text className="font-arabic-bold text-[16px] text-white">
                {submitReview.isPending ? 'يُرسل…' : 'إرسال التقييم'}
              </Text>
            </Pressable>

            <Pressable
              testID="review-later"
              accessibilityRole="button"
              onPress={() => router.back()}
            >
              <Text className="text-center font-arabic text-[12.5px] font-semibold text-ih-neutral-500">
                ليس الآن
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text className="mt-3 text-center font-arabic text-[11.5px] leading-[1.7] text-ih-neutral-500">
        يُطلب التقييم مرة واحدة لكل زيارة مكتملة، ولا يُكرَّر إن تجاهله المريض.
      </Text>
    </ScrollView>
  )
}
