import {
  formatDistanceAr,
  getFirstAvailableSlotLabel,
  getOpenStatus,
  toArabicDigits,
} from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'

import type { HomeBranchWithDistance } from '../../features/home/types'

interface ProviderCardProps {
  branch: HomeBranchWithDistance
  firstSlot: { slotDate: string; slotTime: string } | null
  now: Date
}

// The nearby-provider card from the approved Home mockup: name, type badge,
// distance, open/closed chip, first-available-slot line. Card and احجز both
// open the F04 branch profile. Type derives from the branch's ACTIVE categories.
export function ProviderCard({ branch, firstSlot, now }: ProviderCardProps) {
  const router = useRouter()
  const isHospital = branch.categorySlugs.includes('scans')
  const typeBadge = isHospital ? 'مستشفى' : 'معمل تحاليل'
  const icon = isHospital ? '🏥' : '🔬'

  const openStatus = branch.hours ? getOpenStatus(branch.hours, now) : null
  const distanceLabel = branch.distanceKm !== null ? formatDistanceAr(branch.distanceKm) : null
  const slotLabel = firstSlot ? getFirstAvailableSlotLabel(firstSlot, now) : null

  const openProfile = () => router.push(`/(app)/branch/${branch.id}`)

  return (
    <Pressable
      testID={`provider-card-${branch.id}`}
      accessibilityRole="button"
      accessibilityLabel={branch.nameAr}
      onPress={openProfile}
      className="gap-2.5 rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-0 p-4"
    >
      <View className="flex-row items-start justify-between gap-2.5">
        <View className="flex-1 flex-row items-center gap-2.5">
          <View className="h-11 w-11 items-center justify-center rounded-ih-md bg-ih-primary-50">
            <Text className="text-xl">{icon}</Text>
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-arabic-bold text-base text-ih-neutral-800" numberOfLines={1}>
              {branch.nameAr}
            </Text>
            <View className="flex-row">
              <Text className="rounded-ih-full bg-ih-primary-50 px-2.5 py-0.5 font-arabic-semibold text-[11px] text-ih-primary-600">
                {typeBadge}
              </Text>
            </View>
          </View>
        </View>
        {branch.reviewCount > 0 ? (
          <View className="flex-row items-center gap-1">
            <Text style={{ color: colors.semantic.warning, fontSize: 14 }}>★</Text>
            <Text className="font-arabic-bold text-sm text-ih-neutral-800">
              {toArabicDigits(branch.rating.toFixed(1))}
            </Text>
            <Text className="font-arabic text-xs text-ih-neutral-500">
              ({toArabicDigits(String(branch.reviewCount))} تقييم)
            </Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row flex-wrap items-center gap-3.5">
        {distanceLabel !== null ? (
          <Text className="font-arabic text-[13px] text-ih-neutral-600">📍 {distanceLabel}</Text>
        ) : null}
        {openStatus ? (
          <View className="flex-row items-center gap-1.5">
            <View
              className="h-2 w-2 rounded-ih-full"
              style={{
                backgroundColor: openStatus.isOpen
                  ? colors.semantic.success
                  : colors.semantic.error,
              }}
            />
            <Text className="font-arabic text-[13px] text-ih-neutral-600">
              {openStatus.isOpen
                ? openStatus.closeLabelAr
                  ? `مفتوح حتى ${openStatus.closeLabelAr}`
                  : 'مفتوح ٢٤ ساعة'
                : 'مغلق الآن'}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row items-center justify-between gap-2.5 border-t border-ih-neutral-100 pt-2.5">
        {slotLabel !== null ? (
          <Text className="flex-1 font-arabic text-[13px] text-ih-neutral-600" numberOfLines={1}>
            أقرب موعد: <Text className="font-arabic-bold text-ih-primary-700">{slotLabel}</Text>
          </Text>
        ) : (
          <Text className="flex-1 font-arabic text-[13px] text-ih-neutral-500">
            لا توجد مواعيد متاحة
          </Text>
        )}
        <Pressable
          testID={`provider-book-${branch.id}`}
          accessibilityRole="button"
          accessibilityLabel={`احجز في ${branch.nameAr}`}
          disabled={slotLabel === null}
          onPress={openProfile}
          className="h-9 min-w-[72px] items-center justify-center rounded-ih-sm bg-ih-primary-400 px-4"
          style={slotLabel === null ? { opacity: 0.45 } : undefined}
        >
          <Text className="font-arabic-semibold text-sm text-white">احجز</Text>
        </Pressable>
      </View>
    </Pressable>
  )
}
