import {
  formatArabicDate,
  formatEgpDigitsAr,
  formatTimeShortAr,
  toArabicDigits,
  type BranchServiceItem,
} from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { LinearGradient } from 'expo-linear-gradient'
import { Text, View } from 'react-native'

interface OrderSummaryCardProps {
  branchNameAr: string
  isHospital: boolean
  services: BranchServiceItem[]
  slotDate: string
  slotTime: string
  totalEgp: number
}

function slotDateAtNoonUtc(slotDate: string): Date {
  return new Date(`${slotDate}T12:00:00Z`)
}

// The order summary card from the approved step-4 design: gradient branch
// header, service rows, slot line, total. Shared by review + payment stub so
// the numbers can never drift between screens.
export function OrderSummaryCard({
  branchNameAr,
  isHospital,
  services,
  slotDate,
  slotTime,
  totalEgp,
}: OrderSummaryCardProps) {
  return (
    <View
      testID="order-summary"
      className="overflow-hidden rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0"
    >
      <LinearGradient
        colors={[colors.primary[700], colors.primary[500]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View className="flex-row items-center justify-between gap-2.5 px-4 py-3.5">
          <Text className="font-arabic-bold text-[15px] text-white">{branchNameAr}</Text>
          <Text className="rounded-ih-full bg-white/20 px-3 py-0.5 font-arabic-semibold text-xs text-white">
            {isHospital ? 'مستشفى' : 'معمل تحاليل'}
          </Text>
        </View>
      </LinearGradient>
      <View className="gap-2.5 px-4 py-3.5">
        {services.map((service) => (
          <View key={service.id} className="flex-row items-center justify-between gap-2.5">
            <Text className="flex-1 font-arabic text-sm text-ih-neutral-600">{service.nameAr}</Text>
            <Text className="font-arabic-bold text-sm text-ih-neutral-800">
              {toArabicDigits(String(service.priceEgp))}{' '}
              <Text className="font-english text-[11px] text-ih-neutral-500">EGP</Text>
            </Text>
          </View>
        ))}
        <View className="border-t border-ih-neutral-100 pt-2.5">
          <Text testID="order-summary-slot" className="font-arabic text-sm text-ih-neutral-600">
            📅 {formatArabicDate(slotDateAtNoonUtc(slotDate))} · {formatTimeShortAr(slotTime)}
          </Text>
        </View>
        <View className="flex-row items-center justify-between border-t border-ih-neutral-100 pt-2.5">
          <Text className="font-arabic-bold text-sm text-ih-neutral-800">الإجمالي</Text>
          <Text
            testID="order-summary-total"
            className="font-arabic-bold text-lg text-ih-primary-700"
          >
            {formatEgpDigitsAr(totalEgp)}{' '}
            <Text className="font-english text-[12px] text-ih-neutral-500">EGP</Text>
          </Text>
        </View>
      </View>
    </View>
  )
}
