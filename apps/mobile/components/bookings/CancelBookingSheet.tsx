import {
  formatArabicDate,
  formatTimeShortAr,
  isolateLtr,
  type PatientBooking,
} from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PrimaryButton } from '../ui/PrimaryButton'

// The destructive-action confirmation from the design (PRODUCT.md §6: modals
// for destructive actions, always with a clear way to back out). The bottom
// sheet names the exact booking so nobody cancels the wrong one, and the
// SAFE action is the primary button — "نعم، إلغاء الحجز" is the quiet one.

export function CancelBookingSheet({
  booking,
  visible,
  isCancelling,
  errorMessage,
  onKeep,
  onConfirm,
}: {
  booking: PatientBooking
  visible: boolean
  isCancelling: boolean
  errorMessage: string | null
  onKeep: () => void
  onConfirm: () => void
}) {
  const insets = useSafeAreaInsets()
  const dateLabel = formatArabicDate(new Date(`${booking.slotDate}T12:00:00Z`))
  const timeLabel = isolateLtr(formatTimeShortAr(booking.slotTime))

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={isCancelling ? undefined : onKeep}
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(2,20,27,0.45)' }}>
        {/* Tapping the scrim backs out — but never mid-request, or the patient
            would be left unsure whether the cancel went through. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="إغلاق"
          disabled={isCancelling}
          onPress={onKeep}
          className="flex-1"
        />
        <View
          testID="cancel-booking-sheet"
          accessibilityViewIsModal
          accessibilityRole="alert"
          className="gap-4.5 rounded-t-[24px] bg-ih-neutral-0 px-6 pt-6"
          style={{ paddingBottom: insets.bottom + 24 }}
        >
          <View className="h-1 w-10 self-center rounded-ih-full bg-ih-neutral-200" />

          <View className="gap-2">
            <Text
              accessibilityRole="header"
              className="text-center font-arabic-bold text-lg text-ih-neutral-800"
            >
              هل أنت متأكد من إلغاء الحجز؟
            </Text>
            {/* RATIFIED policy (SPEC-F07, superseding the design bundle's
                "قبل الموعد بـ ٤ ساعات"): free any time before the slot starts,
                for every payment method. No fee logic exists anywhere.
                Prepaid cancels will mean a FULL refund once PayTabs is live —
                payments are simulated today, so no refund language ships. */}
            <Text className="text-center font-arabic text-sm leading-6 text-ih-neutral-600">
              حجزك في {booking.branchNameAr} — {dateLabel}، {timeLabel}. يمكنك إلغاء الحجز مجاناً في
              أي وقت قبل الموعد.
            </Text>
          </View>

          {errorMessage !== null ? (
            <View
              testID="cancel-booking-error"
              accessibilityRole="alert"
              className="rounded-ih-sm px-4 py-3"
              style={{ backgroundColor: colors.semantic.errorBg }}
            >
              <Text
                className="text-center font-arabic text-[13px] leading-6"
                style={{ color: colors.semantic.errorText }}
              >
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <View className="gap-2.5">
            <PrimaryButton
              testID="cancel-booking-keep"
              label="تراجع — الاحتفاظ بالحجز"
              disabled={isCancelling}
              onPress={onKeep}
            />
            <Pressable
              testID="cancel-booking-confirm"
              accessibilityRole="button"
              accessibilityLabel="نعم، إلغاء الحجز"
              disabled={isCancelling}
              onPress={onConfirm}
              className="h-12 w-full items-center justify-center rounded-ih-sm"
              style={isCancelling ? { opacity: 0.45 } : undefined}
            >
              {isCancelling ? (
                <ActivityIndicator color={colors.semantic.error} />
              ) : (
                <Text
                  className="font-arabic-semibold text-base"
                  style={{ color: colors.semantic.error }}
                >
                  نعم، إلغاء الحجز
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}
