import {
  computeDistanceKm,
  formatDistanceAr,
  getFirstAvailableSlotLabel,
  toArabicDigits,
  type LatLng,
} from '@instahealth/core'
import { Pressable, Text, View } from 'react-native'

import { useFirstAvailableSlots } from '../../features/home/queries'
import type { SearchServiceResult } from '../../features/search/types'

interface ServiceResultRowProps {
  service: SearchServiceResult
  expanded: boolean
  onToggle: () => void
  onPickBranch: (branchId: string, branchServiceId: string) => void
  userCoords: LatLng | null
  now: Date
}

// One service in the «خدمات» section, per the approved Search design: icon
// tile, name, «متوفر في N فرع», prep chip, «تبدأ من» price, and an INLINE
// accordion of that service's active branches (distance · next slot · price).
// Tapping a branch row hands off to the branch profile with THIS service
// preselected — search to selection in two taps.
export function ServiceResultRow({
  service,
  expanded,
  onToggle,
  onPickBranch,
  userCoords,
  now,
}: ServiceResultRowProps) {
  // Batched next-slot lookup, the exact Home hook — only fires when expanded.
  const branchIds = expanded ? service.branches.map((branch) => branch.branchId) : []
  const firstSlots = useFirstAvailableSlots(branchIds)

  return (
    <View className="border-b border-ih-neutral-100">
      <Pressable
        testID={`search-service-${service.serviceId}`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={service.nameAr}
        onPress={onToggle}
        className={`min-h-[44px] flex-row items-center gap-3 px-3.5 py-3 ${
          expanded ? 'bg-ih-primary-50' : 'bg-ih-neutral-0'
        }`}
      >
        <View className="h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-ih-primary-50">
          <Text className="text-lg">{service.categoryIcon}</Text>
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text
            className="font-arabic-semibold text-[14.5px] text-ih-neutral-800"
            numberOfLines={1}
          >
            {service.nameAr}
          </Text>
          <View className="flex-row items-center gap-2">
            <Text className="font-arabic text-[12.5px] text-ih-neutral-600">
              متوفر في {toArabicDigits(String(service.branchCount))} فرع
            </Text>
            {service.requiresPreparation ? (
              <Text className="rounded-ih-full border border-ih-accent-400 bg-ih-accent-200 px-2 py-0.5 font-arabic-bold text-xs text-ih-primary-800">
                ⚠ صيام
              </Text>
            ) : null}
          </View>
        </View>
        <View className="items-end gap-0.5">
          <Text className="font-arabic-bold text-[13px] text-ih-neutral-800">
            {toArabicDigits(String(service.minPriceEgp))}{' '}
            <Text className="font-english text-[11px] text-ih-neutral-500">EGP</Text>
          </Text>
          <Text className="font-arabic text-xs text-ih-neutral-600">تبدأ من</Text>
        </View>
        <Text
          className="text-xs text-ih-neutral-600"
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        >
          ▼
        </Text>
      </Pressable>

      {expanded ? (
        <View className="border-t border-ih-neutral-200 bg-ih-neutral-50 px-3.5 pb-2 pt-1">
          {service.branches.map((branch) => {
            const distanceKm =
              userCoords !== null && branch.lat !== null && branch.lng !== null
                ? computeDistanceKm(userCoords, { lat: branch.lat, lng: branch.lng })
                : null
            const firstSlot = firstSlots.data?.get(branch.branchId) ?? null
            const slotLabel = firstSlot !== null ? getFirstAvailableSlotLabel(firstSlot, now) : null

            return (
              <Pressable
                key={branch.branchServiceId}
                testID={`search-branch-${branch.branchId}`}
                accessibilityRole="button"
                accessibilityLabel={branch.branchNameAr}
                onPress={() => onPickBranch(branch.branchId, branch.branchServiceId)}
                className="min-h-[44px] flex-row items-center gap-2.5 py-1.5"
              >
                <View className="h-1.5 w-1.5 rounded-ih-full bg-ih-primary-400" />
                <View className="min-w-0 flex-1 gap-px">
                  <Text
                    className="font-arabic-semibold text-[13.5px] text-ih-neutral-800"
                    numberOfLines={1}
                  >
                    {branch.branchNameAr}
                  </Text>
                  <Text className="font-arabic text-xs text-ih-neutral-600" numberOfLines={1}>
                    {distanceKm !== null ? `📍 ${formatDistanceAr(distanceKm)}` : null}
                    {distanceKm !== null && slotLabel !== null ? ' · ' : null}
                    {slotLabel !== null ? `أقرب موعد ${slotLabel}` : null}
                  </Text>
                </View>
                <Text className="font-arabic-bold text-[13px] text-ih-primary-700">
                  {toArabicDigits(String(branch.priceEgp))}{' '}
                  <Text className="font-english text-[11px] text-ih-neutral-500">EGP</Text>
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}
