import { summarizeSelection, toArabicDigits } from '@instahealth/core'
import { useRouter } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useBookingStore } from '../../../features/booking/store'

// Styled booking stub (F04 handoff point) — F05 replaces this with the real
// 4-step flow. Shows the selection recap so the Maestro flow can assert the
// store handed over correctly. Tab bar is hidden here (booking flow rule).
export default function BookingStub() {
  const router = useRouter()
  const branchNameAr = useBookingStore((state) => state.branchNameAr)
  const selectedServices = useBookingStore((state) => state.selectedServices)
  const summary = summarizeSelection(selectedServices)

  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-50" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-3 border-b border-ih-neutral-200 bg-ih-neutral-0 px-5 py-3.5">
        <Pressable
          testID="booking-back"
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/home'))}
          className="h-11 w-11 items-center justify-center rounded-ih-full border border-ih-neutral-200 bg-ih-neutral-50"
        >
          <Text className="text-lg text-ih-neutral-700">→</Text>
        </Pressable>
        <Text className="font-arabic-bold text-lg text-ih-neutral-800">إتمام الحجز</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View className="items-center gap-2 rounded-ih-md bg-ih-accent-200 p-6">
          <Text className="text-4xl">🗓️</Text>
          <Text className="font-arabic-bold text-lg text-ih-primary-800">قريباً</Text>
          <Text className="text-center font-arabic text-sm leading-6 text-ih-primary-800">
            حجز المواعيد قيد الإنشاء — اختيارك محفوظ وستتمكن من إتمام الحجز هنا.
          </Text>
        </View>

        {selectedServices.length > 0 ? (
          <View
            testID="booking-recap"
            className="gap-3 rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0 p-4"
          >
            {branchNameAr !== null ? (
              <Text className="font-arabic-bold text-base text-ih-neutral-800">{branchNameAr}</Text>
            ) : null}
            {selectedServices.map((service) => (
              <View
                key={service.id}
                className="flex-row items-center justify-between gap-3 border-b border-ih-neutral-100 pb-2.5"
              >
                <Text className="flex-1 font-arabic text-sm text-ih-neutral-700">
                  {service.nameAr}
                </Text>
                <Text className="font-arabic-semibold text-sm text-ih-neutral-800">
                  {toArabicDigits(String(service.priceEgp))}{' '}
                  <Text className="font-english text-[11px] text-ih-neutral-500">EGP</Text>
                </Text>
              </View>
            ))}
            <View className="flex-row items-center justify-between">
              <Text className="font-arabic-semibold text-sm text-ih-neutral-600">الإجمالي</Text>
              <Text
                testID="booking-recap-total"
                className="font-arabic-bold text-base text-ih-primary-700"
              >
                {summary.label}
              </Text>
            </View>
          </View>
        ) : (
          <Text className="text-center font-arabic text-sm text-ih-neutral-500">
            لم تختر أي خدمات بعد — عد لملف المركز واختر خدماتك أولاً.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
