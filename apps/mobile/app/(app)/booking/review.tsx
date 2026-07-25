import { calculateBookingTotal, formatEgyptianPhoneDisplay } from '@instahealth/core'
import { Redirect, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'

import { colors } from '@instahealth/design-tokens'

import { PreparationStrip } from '../../../components/branch/PreparationStrip'
import { FlowCtaBar } from '../../../components/booking/FlowCtaBar'
import { OrderSummaryCard } from '../../../components/booking/OrderSummaryCard'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { useAuthStore } from '../../../features/auth/store'
import { cancelPendingBooking, createPendingBooking } from '../../../features/booking/api'
import { useBookingStore } from '../../../features/booking/store'
import { getPreparationStrip } from '../../../features/branch/prep'

// Step 3 — review (F05): the assembled booking + بياناتك per the design.
// متابعة للدفع creates the pending_payment booking row that confirm_booking()
// (F06) expects. Numbers all come from the same store selection F04 built —
// no drift between screens by construction.
export default function ReviewScreen() {
  const router = useRouter()
  const profile = useAuthStore((state) => state.profile)
  const userId = useAuthStore((state) => state.session?.user.id ?? null)

  const branchId = useBookingStore((state) => state.branchId)
  const branchNameAr = useBookingStore((state) => state.branchNameAr)
  const selectedServices = useBookingStore((state) => state.selectedServices)
  const hold = useBookingStore((state) => state.hold)
  const notes = useBookingStore((state) => state.notes)
  const setNotes = useBookingStore((state) => state.setNotes)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // No live hold → nothing to review (expiry modal or deep entry): back to picking.
  if (hold === null) {
    return <Redirect href="/(app)/booking/slot" />
  }

  const totalEgp = calculateBookingTotal(selectedServices)
  const prep = getPreparationStrip(selectedServices)
  const isHospital = selectedServices.some((service) => service.categorySlug === 'scans')

  const handleContinue = async () => {
    if (userId === null || branchId === null || isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const store = useBookingStore.getState()
      const existing = store.pendingBooking
      if (existing !== null && existing.slotId === hold.slotId) {
        router.push('/(app)/booking/payment') // same slot — reuse the row
        return
      }
      if (existing !== null) {
        // Slot was re-picked; patients cannot UPDATE bookings → cancel + recreate.
        store.clearPendingBooking()
        await cancelPendingBooking(existing.id, 'slot_changed')
      }
      const booking = await createPendingBooking({
        userId,
        branchId,
        slotId: hold.slotId,
        services: selectedServices,
        notes,
      })
      store.setPendingBooking(booking)
      router.push('/(app)/booking/payment')
    } catch {
      setSubmitError('تعذر تجهيز الحجز — تحقق من الاتصال وحاول مرة أخرى.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <View className="flex-1 bg-ih-neutral-50">
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="font-arabic-bold text-xl text-ih-neutral-800">مراجعة الحجز</Text>

        <OrderSummaryCard
          branchNameAr={branchNameAr ?? ''}
          isHospital={isHospital}
          services={selectedServices}
          slotDate={hold.slotDate}
          slotTime={hold.slotTime}
          totalEgp={totalEgp}
        />

        {prep !== null ? <PreparationStrip prep={prep} /> : null}

        <View className="gap-1">
          <Text className="font-arabic-bold text-base text-ih-neutral-800">بياناتك</Text>
          <Text className="font-arabic text-[13px] text-ih-neutral-500">
            بياناتك من حسابك — رقمك مؤكد بالفعل
          </Text>
        </View>

        <View className="gap-2">
          <Text className="font-arabic-semibold text-[13px] text-ih-neutral-600">
            الاسم بالكامل
          </Text>
          <View className="min-h-[52px] flex-row items-center rounded-ih-sm border-[1.5px] border-ih-neutral-200 bg-ih-neutral-50 px-4">
            <Text
              testID="review-name"
              className="font-arabic-semibold text-base text-ih-neutral-700"
            >
              {profile?.name_ar ?? '—'}
            </Text>
          </View>
        </View>

        <View className="gap-2">
          <Text className="font-arabic-semibold text-[13px] text-ih-neutral-600">رقم الهاتف</Text>
          <View className="min-h-[52px] flex-row items-center gap-2.5 rounded-ih-sm border-[1.5px] border-ih-neutral-200 bg-ih-neutral-50 px-4">
            <Text className="flex-1 font-english text-base font-semibold text-ih-neutral-700">
              {profile?.phone != null ? formatEgyptianPhoneDisplay(profile.phone) : '—'}
            </Text>
            <Text className="rounded-ih-full bg-ih-primary-50 px-2.5 py-0.5 font-arabic-bold text-[11px] text-ih-primary-600">
              ✓ مؤكد
            </Text>
          </View>
        </View>

        <View className="gap-2">
          <Text className="font-arabic-semibold text-[13px] text-ih-neutral-600">
            ملاحظات (اختياري)
          </Text>
          <TextInput
            testID="review-notes"
            accessibilityLabel="ملاحظات"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            placeholder="مثال: أفضّل سحب العينة في المنزل، لدي حساسية من…"
            placeholderTextColor={colors.neutral[400]}
            className="min-h-[84px] rounded-ih-sm border-[1.5px] border-ih-neutral-200 bg-ih-neutral-0 px-4 py-3 text-right font-arabic text-[15px] leading-6 text-ih-neutral-800"
            style={{ textAlignVertical: 'top' }}
          />
        </View>

        {submitError !== null ? (
          <View
            testID="review-error"
            className="rounded-ih-sm border border-ih-error/30 bg-ih-error/10 px-4 py-3"
          >
            <Text className="font-arabic-semibold text-[13px] text-ih-error">{submitError}</Text>
          </View>
        ) : null}
      </ScrollView>
      <FlowCtaBar>
        <PrimaryButton
          testID="review-continue"
          label="متابعة للدفع"
          loading={isSubmitting}
          onPress={() => void handleContinue()}
        />
      </FlowCtaBar>
    </View>
  )
}
