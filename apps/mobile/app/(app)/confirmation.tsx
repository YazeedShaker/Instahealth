import {
  computePreparationNotes,
  formatArabicDate,
  formatEgpDigitsAr,
  formatPaymentMethodStatusAr,
  formatTimeShortAr,
  toArabicDigits,
  toSelectedServices,
} from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { LinearGradient } from 'expo-linear-gradient'
import { Redirect, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ConfirmationSuccessMoment } from '../../components/booking/ConfirmationSuccessMoment'
import { PreparationStrip } from '../../components/branch/PreparationStrip'
import { FlowCtaBar } from '../../components/booking/FlowCtaBar'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { addBookingToCalendar, type AddToCalendarResult } from '../../features/booking/calendar'
import { useConfirmationStore } from '../../features/booking/confirmationStore'
import { useBookingStore } from '../../features/booking/store'

const CALENDAR_MESSAGE_AR: Record<AddToCalendarResult, string> = {
  added: '✓ تمت الإضافة إلى التقويم',
  permissionDenied: 'نحتاج إذن الوصول للتقويم — فعّله من إعدادات هاتفك',
  noCalendar: 'لا يوجد تقويم متاح على هذا الهاتف',
  error: 'تعذّرت الإضافة إلى التقويم — حاول مرة أخرى',
}

// Booking confirmation — built to the approved `Booking Confirmation` design.
//
// It lives OUTSIDE `app/(app)/booking/` on purpose: the design has no step
// header and no hold timer (the booking is done), and the flow layout renders
// both. Being outside also means the segments watcher in (app)/_layout runs on
// arrival — which is safe precisely because payment.tsx resets the booking
// store BEFORE navigating here, so there is no flow state left to "clean up".
//
// Everything rendered comes from the server-built confirmation DTO. The
// patient's RLS SELECT policy on `slots` hides a slot once it is fully booked,
// so re-querying the just-booked slot from the client would return nothing.
export default function ConfirmationScreen() {
  const router = useRouter()
  const confirmation = useConfirmationStore((state) => state.confirmation)
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false)
  const [calendarResult, setCalendarResult] = useState<AddToCalendarResult | null>(null)

  // The hand-off is over the moment this screen exists — lowering the flag here
  // rather than in payment.tsx keeps it up for exactly the commit that needs it,
  // so the flow guards resume normal duty for the NEXT booking.
  useEffect(() => {
    useBookingStore.getState().clearConfirmedHandoff()
  }, [])

  // Direct entry / a reloaded bundle with no confirmation in memory: F07's
  // bookings list is the real home for a past booking, so send them there.
  if (confirmation === null) {
    return <Redirect href="/(app)/bookings" />
  }

  // Same core function the branch profile and review screens use — the patient
  // must see the SAME preparation notes here, where they matter most
  // (DECISION-provider-data-model §3).
  const prep = computePreparationNotes(toSelectedServices(confirmation.services))
  const hasPrep = prep.summaryAr !== null

  const handleAddToCalendar = async () => {
    if (isAddingToCalendar) return
    setIsAddingToCalendar(true)
    try {
      setCalendarResult(await addBookingToCalendar(confirmation))
    } finally {
      setIsAddingToCalendar(false)
    }
  }

  const goToBookings = () => {
    // The store no longer has a selection, so the flow layout's own guard
    // redirects any back-navigation into /booking straight to Home. That guard
    // is the whole protection — `popToTopOnBlur` used to back it up but was
    // removed: it fired POP_TO_TOP at a stack that no longer existed.
    useConfirmationStore.getState().clearConfirmation()
    router.replace('/(app)/bookings')
  }

  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-50" edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 16 }}
      >
        <View className="items-center gap-3.5 px-2 pb-1 pt-4.5">
          <ConfirmationSuccessMoment />
          <View className="gap-1.5">
            <Text
              testID="confirmation-title"
              accessibilityRole="header"
              className="text-center font-arabic-bold text-[21px] text-ih-neutral-800"
            >
              تم تأكيد حجزك بنجاح
            </Text>
            <Text className="text-center font-arabic text-sm leading-6 text-ih-neutral-600">
              {hasPrep
                ? 'ستصلك رسالة تأكيد على رقمك خلال دقائق — كل التفاصيل محفوظة في حجوزاتي.'
                : 'ستصلك رسالة تأكيد على رقمك خلال دقائق — لا تحتاج أي تجهيزات قبل هذا الموعد.'}
            </Text>
          </View>
        </View>

        {/* Booking reference — the DB trigger's value, never generated here. */}
        <View
          className="flex-row items-center justify-between gap-3 rounded-ih-md px-4 py-3.5"
          style={{
            backgroundColor: colors.primary[50],
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.primary[200],
          }}
        >
          <Text className="font-arabic-semibold text-xs text-ih-primary-700">رقم الحجز</Text>
          <Text
            testID="confirmation-booking-ref"
            className="font-english-bold text-[19px] tracking-[1px] text-ih-primary-800"
          >
            {confirmation.bookingRef ?? '—'}
          </Text>
        </View>

        {/* Recap */}
        <View className="overflow-hidden rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0">
          <LinearGradient
            colors={[colors.primary[700], colors.primary[500]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View className="flex-row items-center justify-between gap-2.5 p-4">
              <View className="flex-1 gap-0.5">
                <Text className="font-arabic-bold text-base text-white">
                  {confirmation.branchNameAr}
                </Text>
                {confirmation.branchAddressAr !== null ? (
                  <Text className="font-arabic text-xs text-white/85">
                    {confirmation.branchAddressAr}
                  </Text>
                ) : null}
              </View>
              <Text className="rounded-ih-full bg-white/20 px-3 py-0.5 font-arabic-semibold text-xs text-white">
                {confirmation.isHospital ? 'مستشفى' : 'معمل تحاليل'}
              </Text>
            </View>
          </LinearGradient>

          <View className="gap-3 px-4 py-3.5">
            <Text testID="confirmation-slot" className="font-arabic text-sm text-ih-neutral-700">
              📅 {formatArabicDate(new Date(`${confirmation.slotDate}T12:00:00Z`))} ·{' '}
              <Text className="font-arabic-bold">{formatTimeShortAr(confirmation.slotTime)}</Text>
            </Text>

            <View className="gap-2.5 border-t border-ih-neutral-100 pt-3">
              {confirmation.services.map((service) => (
                <View key={service.id} className="flex-row items-center justify-between gap-2.5">
                  <Text className="flex-1 font-arabic text-sm text-ih-neutral-700">
                    {service.nameAr}
                  </Text>
                  <Text className="font-arabic-bold text-sm text-ih-neutral-800">
                    {toArabicDigits(String(service.priceEgp))}{' '}
                    <Text className="font-english text-[11px] text-ih-neutral-500">EGP</Text>
                  </Text>
                </View>
              ))}
            </View>

            <View className="flex-row items-center justify-between gap-2.5 border-t border-ih-neutral-100 pt-3">
              <View className="gap-px">
                <Text className="font-arabic-bold text-sm text-ih-neutral-800">
                  الإجمالي المدفوع
                </Text>
                <Text
                  testID="confirmation-payment-method"
                  className="font-arabic text-xs text-ih-neutral-500"
                >
                  {formatPaymentMethodStatusAr(confirmation.method)}
                </Text>
              </View>
              <Text
                testID="confirmation-total"
                className="font-arabic-bold text-lg text-ih-primary-700"
              >
                {formatEgpDigitsAr(confirmation.totalEgp)}{' '}
                <Text className="font-english text-[12px] text-ih-neutral-500">EGP</Text>
              </Text>
            </View>
          </View>
        </View>

        {/* Empty means absent: a selection with no real preparation renders
            NOTHING here — no empty callout (SPEC-F06 consistency section). */}
        {hasPrep ? <PreparationStrip prep={prep} /> : null}
      </ScrollView>

      <FlowCtaBar>
        <PrimaryButton
          testID="confirmation-my-bookings"
          label="عرض حجوزاتي"
          onPress={goToBookings}
        />
        <Pressable
          testID="confirmation-add-to-calendar"
          accessibilityRole="button"
          accessibilityLabel="أضف إلى التقويم"
          disabled={isAddingToCalendar}
          onPress={() => void handleAddToCalendar()}
          className="h-12 w-full items-center justify-center rounded-ih-sm border-[1.5px] border-ih-primary-400 bg-ih-neutral-0"
          style={isAddingToCalendar ? { opacity: 0.45 } : undefined}
        >
          {isAddingToCalendar ? (
            <ActivityIndicator color={colors.primary[600]} />
          ) : (
            <Text className="font-arabic-semibold text-base text-ih-primary-700">
              أضف إلى التقويم
            </Text>
          )}
        </Pressable>
        {calendarResult !== null ? (
          <Text
            testID="confirmation-calendar-result"
            accessibilityLiveRegion="polite"
            className="text-center font-arabic text-xs"
            style={{
              color: calendarResult === 'added' ? colors.primary[700] : colors.semantic.warningText,
            }}
          >
            {CALENDAR_MESSAGE_AR[calendarResult]}
          </Text>
        ) : null}
      </FlowCtaBar>
    </SafeAreaView>
  )
}
