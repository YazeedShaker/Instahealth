import {
  DAY_LABELS_AR,
  formatDayHoursAr,
  formatDistanceAr,
  getCairoDayKey,
  getOpenStatus,
  toArabicDigits,
  WEEK_DAY_ORDER,
} from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { useState } from 'react'
import { Linking, Platform, Pressable, Text, View } from 'react-native'

import type { BranchProfile } from '../../features/branch/types'

interface BranchInfoHeaderProps {
  branch: BranchProfile
  distanceKm: number | null
  now: Date
}

function openDirections(lat: number, lng: number, label: string) {
  const encodedLabel = encodeURIComponent(label)
  const url = Platform.select({
    ios: `maps:0,0?q=${encodedLabel}@${lat},${lng}`,
    android: `geo:0,0?q=${lat},${lng}(${encodedLabel})`,
    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  })
  Linking.openURL(url).catch(() => {
    // Fall back to the universal maps URL when no native maps app handles the scheme.
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`)
  })
}

// The provider-info block from the approved mockup: name + type badge,
// rating / open-status / distance meta row, plus the spec's expandable
// full-week schedule and the اتصال / الاتجاهات actions row.
export function BranchInfoHeader({ branch, distanceKm, now }: BranchInfoHeaderProps) {
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)

  const isHospital = branch.categorySlugs.includes('scans')
  const typeBadge = isHospital ? 'مستشفى' : 'معمل تحاليل'
  const openStatus = branch.hours ? getOpenStatus(branch.hours, now) : null
  const todayKey = getCairoDayKey(now)
  const distanceLabel = distanceKm !== null ? formatDistanceAr(distanceKm) : null

  return (
    <View className="gap-2.5 border-b border-ih-neutral-200 bg-ih-neutral-0 px-5 py-[18px]">
      <View className="flex-row items-center justify-between gap-2.5">
        <Text className="flex-1 font-arabic-bold text-[22px] text-ih-neutral-800">
          {branch.nameAr}
        </Text>
        <Text className="rounded-ih-full bg-ih-primary-50 px-3 py-1 font-arabic-semibold text-xs text-ih-primary-600">
          {typeBadge}
        </Text>
      </View>

      <View className="flex-row flex-wrap items-center gap-4">
        {branch.reviewCount > 0 ? (
          <View className="flex-row items-center gap-1">
            <Text style={{ color: colors.semantic.warning, fontSize: 14 }}>★</Text>
            <Text className="font-arabic-bold text-[13px] text-ih-neutral-800">
              {toArabicDigits(branch.rating.toFixed(1))}
            </Text>
            <Text className="font-arabic text-[13px] text-ih-neutral-600">
              ({toArabicDigits(String(branch.reviewCount))} تقييم)
            </Text>
          </View>
        ) : null}
        {openStatus && branch.hours ? (
          <Pressable
            testID="branch-hours-toggle"
            accessibilityRole="button"
            accessibilityLabel="مواعيد العمل"
            accessibilityState={{ expanded: isScheduleOpen }}
            onPress={() => setIsScheduleOpen((open) => !open)}
            className="min-h-[44px] flex-row items-center gap-1.5"
          >
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
            <Text
              className="text-[10px] text-ih-neutral-500"
              style={{ transform: [{ rotate: isScheduleOpen ? '180deg' : '0deg' }] }}
            >
              ▼
            </Text>
          </Pressable>
        ) : null}
        {distanceLabel !== null ? (
          <Text className="font-arabic text-[13px] text-ih-neutral-600">📍 {distanceLabel}</Text>
        ) : null}
      </View>

      {isScheduleOpen && branch.hours ? (
        <View
          testID="branch-week-schedule"
          className="gap-1 rounded-ih-md bg-ih-neutral-50 px-4 py-3"
        >
          {WEEK_DAY_ORDER.map((dayKey) => {
            const isToday = dayKey === todayKey
            return (
              <View key={dayKey} className="min-h-[28px] flex-row items-center justify-between">
                <Text
                  className={
                    isToday
                      ? 'font-arabic-bold text-[13px] text-ih-primary-700'
                      : 'font-arabic text-[13px] text-ih-neutral-600'
                  }
                >
                  {DAY_LABELS_AR[dayKey]}
                  {isToday ? ' (اليوم)' : ''}
                </Text>
                <Text
                  className={
                    isToday
                      ? 'font-arabic-bold text-[13px] text-ih-primary-700'
                      : 'font-arabic text-[13px] text-ih-neutral-600'
                  }
                >
                  {formatDayHoursAr(branch.hours![dayKey])}
                </Text>
              </View>
            )
          })}
        </View>
      ) : null}

      {branch.addressAr !== null ? (
        <Text className="font-arabic text-[13px] leading-5 text-ih-neutral-500" numberOfLines={2}>
          📍 {branch.addressAr}
        </Text>
      ) : null}

      <View className="flex-row gap-2.5 pt-1">
        {branch.phone !== null && branch.phone.length > 0 ? (
          <Pressable
            testID="branch-call"
            accessibilityRole="button"
            accessibilityLabel={`اتصال بـ ${branch.nameAr}`}
            onPress={() => void Linking.openURL(`tel:${branch.phone}`)}
            className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-ih-sm border-[1.5px] border-ih-primary-600 bg-ih-neutral-0"
          >
            <Text className="text-sm">📞</Text>
            <Text className="font-arabic-semibold text-sm text-ih-primary-600">اتصال</Text>
          </Pressable>
        ) : null}
        {branch.lat !== null && branch.lng !== null ? (
          <Pressable
            testID="branch-directions"
            accessibilityRole="button"
            accessibilityLabel={`الاتجاهات إلى ${branch.nameAr}`}
            onPress={() =>
              openDirections(branch.lat as number, branch.lng as number, branch.nameAr)
            }
            className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-ih-sm border-[1.5px] border-ih-primary-600 bg-ih-neutral-0"
          >
            <Text className="text-sm">🗺️</Text>
            <Text className="font-arabic-semibold text-sm text-ih-primary-600">الاتجاهات</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
