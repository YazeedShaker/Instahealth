import {
  computeDistanceKm,
  computePreparationNotes,
  formatArabicDate,
  formatDistanceAr,
  formatEgpDigitsAr,
  formatTimeShortAr,
  getBookingPaymentLabelAr,
  isCancellable,
  isolateLtr,
  toArabicDigits,
  toSelectedServices,
} from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { LinearGradient } from 'expo-linear-gradient'
import { useQueryClient } from '@tanstack/react-query'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BookingStatusBadge } from '../../../components/bookings/BookingStatusBadge'
import { CancelBookingSheet } from '../../../components/bookings/CancelBookingSheet'
import { FlowCtaBar } from '../../../components/booking/FlowCtaBar'
import { PreparationStrip } from '../../../components/branch/PreparationStrip'
import { PrimaryButton } from '../../../components/ui/PrimaryButton'
import { addBookingToCalendar, type AddToCalendarResult } from '../../../features/booking/calendar'
import { useMyReview } from '../../../features/reviews/queries'
import { cancelBooking } from '../../../features/bookings/api'
import { MY_BOOKINGS_QUERY_KEY, useMyBookings } from '../../../features/bookings/queries'
import { useUserLocation } from '../../../features/home/useUserLocation'

// F07 — تفاصيل الحجز, built to the approved design. It reads the booking out of
// the SAME `get_patient_bookings` cache the list uses rather than re-querying:
// the row already carries everything the screen renders, and a `bookings →
// slots` join would return nothing for a fully-booked slot anyway (RLS).

const CANCEL_ERROR_AR = 'تعذّر إلغاء الحجز — تحقق من الاتصال وحاول مرة أخرى.'
const CANCEL_STALE_AR = 'هذا الحجز لم يعد قابلاً للإلغاء — حدّثنا حالته.'
const CANCEL_STARTED_AR = 'بدأ موعدك بالفعل — تواصل مع المركز مباشرة.'

const CALENDAR_MESSAGE_AR: Record<AddToCalendarResult, string> = {
  added: '✓ تمت الإضافة إلى التقويم',
  permissionDenied: 'نحتاج إذن الوصول للتقويم — فعّله من إعدادات هاتفك',
  noCalendar: 'لا يوجد تقويم متاح على هذا الهاتف',
  error: 'تعذّرت الإضافة إلى التقويم — حاول مرة أخرى',
}

/** Same maps handling as F04's branch header — native scheme first, universal
 * URL as the fallback when no maps app claims it. */
function openDirections(lat: number, lng: number, label: string): void {
  const encoded = encodeURIComponent(label)
  const url = Platform.select({
    ios: `maps:0,0?q=${encoded}@${lat},${lng}`,
    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  })
  Linking.openURL(url).catch(() => {
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`)
  })
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const bookingsQuery = useMyBookings()
  const { location } = useUserLocation()

  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false)
  const [calendarResult, setCalendarResult] = useState<AddToCalendarResult | null>(null)

  // No stale status anywhere in the tab: a booking cancelled or completed
  // elsewhere must not still read "مؤكد" when this screen regains focus.
  const { refetch } = bookingsQuery
  useFocusEffect(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )

  const booking = (bookingsQuery.data ?? []).find((entry) => entry.id === id) ?? null

  // Asked only for a completed booking — the label on the CTA is the server's
  // answer about whether a review already exists, not a local guess.
  const myReview = useMyReview(id, booking?.status === 'completed').data ?? null

  if (bookingsQuery.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-ih-neutral-50" edges={['top']}>
        <View className="gap-3 p-5">
          <View className="h-[120px] rounded-ih-md bg-ih-neutral-200" />
          <View className="h-[160px] rounded-ih-md bg-ih-neutral-200 opacity-60" />
        </View>
      </SafeAreaView>
    )
  }

  // Unknown id, someone else's booking, or a stale deep link. Say so plainly
  // and offer the way out rather than bouncing the patient somewhere with no
  // explanation (PRODUCT.md §8: errors offer the next action, never a dead end).
  if (booking === null) {
    return (
      <SafeAreaView className="flex-1 bg-ih-neutral-50" edges={['top']}>
        <View
          testID="booking-detail-not-found"
          className="flex-1 items-center justify-center gap-3 px-8"
        >
          <Text className="text-4xl">🔍</Text>
          <Text className="text-center font-arabic-bold text-lg text-ih-neutral-800">
            لم نجد هذا الحجز
          </Text>
          <Text className="text-center font-arabic text-sm leading-6 text-ih-neutral-600">
            ربما تم حذفه أو أن الرابط لم يعد صالحاً.
          </Text>
          <View className="w-full max-w-[260px] pt-2">
            <PrimaryButton
              testID="booking-detail-not-found-cta"
              label="عرض حجوزاتي"
              onPress={() => router.replace('/(app)/bookings')}
            />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  const prep = computePreparationNotes(toSelectedServices(booking.services))
  const canCancel = isCancellable(booking, new Date())
  const distanceKm =
    location.coords && booking.branchLat !== null && booking.branchLng !== null
      ? computeDistanceKm(location.coords, { lat: booking.branchLat, lng: booking.branchLng })
      : null

  const handleConfirmCancel = async () => {
    if (isCancelling) return
    setIsCancelling(true)
    setCancelError(null)
    try {
      const outcome = await cancelBooking(booking.id)
      if (outcome.kind === 'cancelled') {
        // Refetch rather than patching the cache: cancelling also frees the
        // slot, and the row now carries cancelled_at/cancelled_by from the DB.
        await queryClient.invalidateQueries({ queryKey: MY_BOOKINGS_QUERY_KEY })
        setIsSheetOpen(false)
        return
      }
      if (outcome.kind === 'notCancellable') {
        await queryClient.invalidateQueries({ queryKey: MY_BOOKINGS_QUERY_KEY })
        setCancelError(CANCEL_STALE_AR)
        return
      }
      if (outcome.kind === 'slotStarted') {
        // The server's boundary and ours are the same predicate, so this only
        // fires if the slot ticked over while the sheet was open.
        await queryClient.invalidateQueries({ queryKey: MY_BOOKINGS_QUERY_KEY })
        setCancelError(CANCEL_STARTED_AR)
        return
      }
      setCancelError(CANCEL_ERROR_AR)
    } finally {
      setIsCancelling(false)
    }
  }

  const handleAddToCalendar = async () => {
    if (isAddingToCalendar) return
    setIsAddingToCalendar(true)
    try {
      // The calendar helper takes the F06 confirmation DTO shape; a booking row
      // carries the same fields under the same names.
      setCalendarResult(
        await addBookingToCalendar({
          bookingId: booking.id,
          bookingRef: booking.bookingRef,
          branchNameAr: booking.branchNameAr,
          branchAddressAr: booking.branchAddressAr,
          isHospital: booking.isHospital,
          slotDate: booking.slotDate,
          slotTime: booking.slotTime,
          services: booking.services,
          totalEgp: booking.totalEgp,
          method: booking.method ?? 'cash',
          confirmedAt: booking.createdAt,
        }),
      )
    } finally {
      setIsAddingToCalendar(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-50" edges={['top']}>
      <View className="flex-row items-center gap-3 border-b border-ih-neutral-200 bg-ih-neutral-0 px-5 pb-3.5 pt-2">
        <Pressable
          testID="booking-detail-back"
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/bookings'))}
          className="h-11 w-11 items-center justify-center rounded-ih-full border border-ih-neutral-200 bg-ih-neutral-50"
        >
          <Text className="text-lg text-ih-neutral-700">→</Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          className="flex-1 font-arabic-bold text-lg text-ih-neutral-800"
        >
          تفاصيل الحجز
        </Text>
        <BookingStatusBadge booking={booking} testID="booking-detail-status" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        {/* Provider card */}
        <View className="overflow-hidden rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0">
          <LinearGradient
            colors={[colors.primary[700], colors.primary[500]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View className="flex-row items-center justify-between gap-2.5 p-4">
              <View className="flex-1 gap-0.5">
                <Text className="font-arabic-bold text-base text-white">
                  {booking.branchNameAr}
                </Text>
                {booking.branchAddressAr !== null ? (
                  <Text className="font-arabic text-xs text-white/85" numberOfLines={2}>
                    📍 {booking.branchAddressAr}
                    {distanceKm !== null ? ` · ${formatDistanceAr(distanceKm)}` : ''}
                  </Text>
                ) : null}
              </View>
              <Text className="rounded-ih-full bg-white/20 px-3 py-0.5 font-arabic-semibold text-xs text-white">
                {booking.isHospital ? 'مستشفى' : 'معمل تحاليل'}
              </Text>
            </View>
          </LinearGradient>

          <View className="gap-3 px-4 py-3.5">
            <Text testID="booking-detail-slot" className="font-arabic text-sm text-ih-neutral-700">
              📅 {formatArabicDate(new Date(`${booking.slotDate}T12:00:00Z`))} ·{' '}
              <Text className="font-arabic-bold">
                {isolateLtr(formatTimeShortAr(booking.slotTime))}
              </Text>
            </Text>
            {booking.bookingRef !== null ? (
              <View className="flex-row items-center justify-between gap-2 border-t border-ih-neutral-100 pt-3">
                <Text className="font-arabic-semibold text-xs text-ih-neutral-500">رقم الحجز</Text>
                <Text
                  testID="booking-detail-ref"
                  className="font-english-bold text-[13px] tracking-[0.5px] text-ih-neutral-700"
                >
                  {booking.bookingRef}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Services + total */}
        {booking.services.length > 0 ? (
          <View className="overflow-hidden rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0">
            <Text className="border-b border-ih-neutral-100 px-4 py-3 font-arabic-bold text-[13px] text-ih-neutral-500">
              {booking.isHospital ? 'الخدمات' : 'التحاليل'}
            </Text>
            {booking.services.map((service) => (
              <View
                key={service.id}
                className="flex-row items-center justify-between gap-2.5 border-b border-ih-neutral-100 px-4 py-3"
              >
                <Text className="flex-1 font-arabic-semibold text-sm text-ih-neutral-800">
                  {service.nameAr}
                </Text>
                <Text className="font-arabic-bold text-sm text-ih-neutral-800">
                  {toArabicDigits(String(service.priceEgp))}{' '}
                  <Text className="font-english text-[11px] text-ih-neutral-500">EGP</Text>
                </Text>
              </View>
            ))}
            <View className="flex-row items-center justify-between gap-2.5 bg-ih-neutral-50 px-4 py-3">
              <Text className="font-arabic-bold text-sm text-ih-neutral-800">الإجمالي</Text>
              <Text
                testID="booking-detail-total"
                className="font-arabic-bold text-[17px] text-ih-primary-700"
              >
                {formatEgpDigitsAr(booking.totalEgp)}{' '}
                <Text className="font-english text-[12px] text-ih-neutral-500">EGP</Text>
              </Text>
            </View>
          </View>
        ) : null}

        {/* Empty means absent — no preparation, no callout (F06 consistency). */}
        {prep.summaryAr !== null ? <PreparationStrip prep={prep} /> : null}

        {/* Payment */}
        <View className="flex-row items-center gap-3 rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0 px-4 py-3.5">
          <Text className="text-xl">{booking.paymentStatus === 'paid' ? '💳' : '💵'}</Text>
          <View className="flex-1 gap-px">
            {/* One source for the cash-vs-paid wording, shared with the list
                card so the two can never disagree. */}
            <Text
              testID="booking-detail-payment"
              className="font-arabic-bold text-sm text-ih-neutral-800"
            >
              {getBookingPaymentLabelAr(booking)}
            </Text>
            <Text className="font-arabic text-xs text-ih-neutral-500">
              {booking.paymentStatus === 'paid'
                ? 'تم الدفع بنجاح — احتفظ برقم الحجز'
                : 'ادفع في المركز مباشرة عند وصولك'}
            </Text>
          </View>
        </View>

        {/* Actions reused from F04's branch header — the patient on their way
            to an appointment wants the phone and the map, not a rebuild. */}
        <View className="flex-row gap-2.5">
          <Pressable
            testID="booking-detail-calendar"
            accessibilityRole="button"
            accessibilityLabel="أضف إلى التقويم"
            disabled={isAddingToCalendar}
            onPress={() => void handleAddToCalendar()}
            className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-ih-sm border border-ih-primary-400 bg-ih-neutral-0"
            style={isAddingToCalendar ? { opacity: 0.45 } : undefined}
          >
            {isAddingToCalendar ? (
              <ActivityIndicator color={colors.primary[600]} />
            ) : (
              <Text className="font-arabic-semibold text-[13px] text-ih-primary-700">
                📅 التقويم
              </Text>
            )}
          </Pressable>
          {booking.branchPhone !== null ? (
            <Pressable
              testID="booking-detail-call"
              accessibilityRole="button"
              accessibilityLabel={`اتصال بـ ${booking.branchNameAr}`}
              onPress={() => void Linking.openURL(`tel:${booking.branchPhone ?? ''}`)}
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-ih-sm border border-ih-neutral-200 bg-ih-neutral-0"
            >
              <Text className="font-arabic-semibold text-[13px] text-ih-primary-600">📞 اتصال</Text>
            </Pressable>
          ) : null}
          {booking.branchLat !== null && booking.branchLng !== null ? (
            <Pressable
              testID="booking-detail-directions"
              accessibilityRole="button"
              accessibilityLabel={`الاتجاهات إلى ${booking.branchNameAr}`}
              onPress={() =>
                openDirections(
                  booking.branchLat as number,
                  booking.branchLng as number,
                  booking.branchNameAr,
                )
              }
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-ih-sm border border-ih-neutral-200 bg-ih-neutral-0"
            >
              <Text className="font-arabic-semibold text-[13px] text-ih-primary-600">
                🗺️ الاتجاهات
              </Text>
            </Pressable>
          ) : null}
        </View>

        {calendarResult !== null ? (
          <Text
            testID="booking-detail-calendar-result"
            accessibilityLiveRegion="polite"
            className="text-center font-arabic text-xs"
            style={{
              color: calendarResult === 'added' ? colors.primary[700] : colors.semantic.warningText,
            }}
          >
            {CALENDAR_MESSAGE_AR[calendarResult]}
          </Text>
        ) : null}

        {booking.patientNotes !== null && booking.patientNotes.length > 0 ? (
          <View className="gap-1.5 rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0 px-4 py-3.5">
            <Text className="font-arabic-bold text-[13px] text-ih-neutral-500">ملاحظاتك</Text>
            <Text className="font-arabic text-sm leading-6 text-ih-neutral-700">
              {booking.patientNotes}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* F08 — the review entry point. Only a COMPLETED booking gets it, which
          is the same predicate `submit_review` enforces: completed is
          human-marked by definition (a system close goes to no_show), so it
          means someone at the desk witnessed the visit.
          ⚠ The label follows `get_my_review`, not local state — a patient who
          already rated sees «تقييمك» and lands on the given-rating state, and a
          patient whose review was HIDDEN also sees «تقييمك» rather than being
          offered a prompt the UNIQUE constraint would refuse. */}
      {booking.status === 'completed' ? (
        <FlowCtaBar>
          <Pressable
            testID="booking-detail-rate"
            accessibilityRole="button"
            accessibilityLabel={myReview?.found === true ? 'تقييمك لهذه الزيارة' : 'قيّم زيارتك'}
            onPress={() => router.push(`/(app)/rate/${booking.id}`)}
            className="h-[52px] w-full items-center justify-center rounded-ih-sm"
            style={{ backgroundColor: colors.primary[400] }}
          >
            <Text className="font-arabic-semibold text-base text-white">
              {myReview?.found === true ? 'تقييمك لهذه الزيارة' : 'قيّم زيارتك'}
            </Text>
          </Pressable>
        </FlowCtaBar>
      ) : null}

      {/* The cancel affordance disappears once the appointment is past or the
          booking is already closed — `isBookingCancellable` is the same
          predicate the server enforces, only stricter. */}
      {canCancel ? (
        <FlowCtaBar>
          <Pressable
            testID="booking-detail-cancel"
            accessibilityRole="button"
            accessibilityLabel="إلغاء الحجز"
            onPress={() => {
              setCancelError(null)
              setIsSheetOpen(true)
            }}
            className="h-[52px] w-full items-center justify-center rounded-ih-sm border-[1.5px] bg-ih-neutral-0"
            style={{ borderColor: colors.semantic.error }}
          >
            <Text
              className="font-arabic-semibold text-base"
              style={{ color: colors.semantic.error }}
            >
              إلغاء الحجز
            </Text>
          </Pressable>
          {/* Ratified policy, superseding the design bundle's 4-hour line. */}
          <Text className="text-center font-arabic text-xs text-ih-neutral-500">
            يمكنك إلغاء الحجز مجاناً في أي وقت قبل الموعد
          </Text>
        </FlowCtaBar>
      ) : null}

      <CancelBookingSheet
        booking={booking}
        visible={isSheetOpen}
        isCancelling={isCancelling}
        errorMessage={cancelError}
        onKeep={() => setIsSheetOpen(false)}
        onConfirm={() => void handleConfirmCancel()}
      />
    </SafeAreaView>
  )
}
