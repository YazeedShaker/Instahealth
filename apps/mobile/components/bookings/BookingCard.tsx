import {
  formatArabicDate,
  formatTimeShortAr,
  getBookingPaymentLabelAr,
  isolateLtr,
  summarizeBookingServicesAr,
  type PatientBooking,
} from '@instahealth/core'
import { Pressable, Text, View } from 'react-native'

import { BookingStatusBadge } from './BookingStatusBadge'

// One row of حجوزاتي, per the approved design: icon + provider + services,
// status badge, then a date/time line and the booking ref.

export function BookingCard({
  booking,
  onPress,
}: {
  booking: PatientBooking
  onPress: () => void
}) {
  const servicesLine = summarizeBookingServicesAr(booking.services)
  const dateLabel = formatArabicDate(new Date(`${booking.slotDate}T12:00:00Z`))

  return (
    <Pressable
      testID={`booking-card-${booking.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${booking.branchNameAr} — ${dateLabel}`}
      onPress={onPress}
      className="gap-2.5 rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0 p-4"
    >
      <View className="flex-row items-start justify-between gap-2.5">
        <View className="flex-1 flex-row items-center gap-2.5">
          <View className="h-[42px] w-[42px] items-center justify-center rounded-ih-md bg-ih-primary-50">
            <Text className="text-xl">{booking.isHospital ? '🏥' : '🔬'}</Text>
          </View>
          <View className="flex-1 gap-px">
            <Text className="font-arabic-bold text-[15.5px] text-ih-neutral-800" numberOfLines={1}>
              {booking.branchNameAr}
            </Text>
            {servicesLine.length > 0 ? (
              <Text className="font-arabic text-[13px] text-ih-neutral-600" numberOfLines={1}>
                {servicesLine}
              </Text>
            ) : null}
          </View>
        </View>
        <BookingStatusBadge booking={booking} testID={`booking-status-${booking.id}`} />
      </View>

      <View className="flex-row items-center justify-between gap-2.5 border-t border-ih-neutral-100 pt-2.5">
        <Text className="flex-1 font-arabic text-[13px] text-ih-neutral-600" numberOfLines={1}>
          {/* The time is an LTR run inside Arabic — isolate it or the digit
              groups render reversed (ENGINEERING-WORKFLOW §6). */}
          📅 {dateLabel}، {isolateLtr(formatTimeShortAr(booking.slotTime))}
        </Text>
        <Text className="font-arabic text-[13px] text-ih-neutral-400">›</Text>
      </View>

      {/* The F06 payment distinction has to be visible wherever a booking
          renders — a cash patient still owes money at the branch and must not
          mistake "مؤكد" for "paid". */}
      <View className="flex-row items-center justify-between gap-2.5">
        <Text
          testID={`booking-payment-${booking.id}`}
          className="font-arabic-semibold text-[12px] text-ih-neutral-500"
        >
          {booking.paymentStatus === 'paid' ? '💳' : '💵'} {getBookingPaymentLabelAr(booking)}
        </Text>
        {/* `items-start` is logical — under RTL the start IS the right edge, and
            CLAUDE.md §7 bans physical left/right. */}
        {booking.bookingRef !== null ? (
          <Text className="font-english-bold text-[11px] tracking-[0.4px] text-ih-neutral-400">
            {booking.bookingRef}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}
