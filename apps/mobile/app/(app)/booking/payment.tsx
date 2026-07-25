import { calculateBookingTotal } from '@instahealth/core'
import { Redirect } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'

import { OrderSummaryCard } from '../../../components/booking/OrderSummaryCard'
import { useBookingStore } from '../../../features/booking/store'

// Step 4 — payment STUB (F05). F06 replaces this with the real Paymob flow
// (card / Fawry / cash) per the approved step-4 design. The pending booking
// already exists; the hold timer in the flow header keeps running here.
export default function PaymentStubScreen() {
  const branchNameAr = useBookingStore((state) => state.branchNameAr)
  const selectedServices = useBookingStore((state) => state.selectedServices)
  const hold = useBookingStore((state) => state.hold)
  const pendingBooking = useBookingStore((state) => state.pendingBooking)

  if (hold === null || pendingBooking === null) {
    return <Redirect href="/(app)/booking/slot" />
  }

  const totalEgp = calculateBookingTotal(selectedServices)
  const isHospital = selectedServices.some((service) => service.categorySlug === 'scans')

  return (
    <View className="flex-1 bg-ih-neutral-50">
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
        <Text className="font-arabic-bold text-xl text-ih-neutral-800">مراجعة الطلب والدفع</Text>

        <View className="items-center gap-2 rounded-ih-md bg-ih-accent-200 p-6">
          <Text className="text-4xl">💳</Text>
          <Text className="font-arabic-bold text-lg text-ih-primary-800">الدفع — قريباً</Text>
          <Text className="text-center font-arabic text-sm leading-6 text-ih-primary-800">
            الدفع الإلكتروني قيد الإنشاء — حجزك مجهز وموعدك محجوز لك حتى انتهاء المهلة.
          </Text>
        </View>

        <OrderSummaryCard
          branchNameAr={branchNameAr ?? ''}
          isHospital={isHospital}
          services={selectedServices}
          slotDate={hold.slotDate}
          slotTime={hold.slotTime}
          totalEgp={totalEgp}
        />

        {pendingBooking.bookingRef !== null ? (
          <Text
            testID="payment-booking-ref"
            className="text-center font-arabic text-[13px] text-ih-neutral-500"
          >
            رقم الحجز المبدئي: <Text className="font-english">{pendingBooking.bookingRef}</Text>
          </Text>
        ) : null}
        <Text className="text-center font-arabic text-xs text-ih-neutral-500">
          دفع آمن عبر Paymob · يمكنك الإلغاء مجاناً قبل الموعد بـ ٤ ساعات
        </Text>
      </ScrollView>
    </View>
  )
}
