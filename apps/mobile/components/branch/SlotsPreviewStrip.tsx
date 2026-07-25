import { getFirstAvailableSlotLabel } from '@instahealth/core'
import { ScrollView, Text, View } from 'react-native'

import type { BranchSlotPreview } from '../../features/branch/types'

interface SlotsPreviewStripProps {
  slots: BranchSlotPreview[] | undefined
  isLoading: boolean
  now: Date
}

// "أقرب المواعيد" — read-only preview chips of the next available slots.
// Actual slot picking is F05; these only tell the patient booking is possible.
export function SlotsPreviewStrip({ slots, isLoading, now }: SlotsPreviewStripProps) {
  return (
    <View className="gap-2.5">
      <Text className="font-arabic-bold text-base text-ih-neutral-800">أقرب المواعيد</Text>
      {isLoading ? (
        <View className="flex-row gap-2" accessibilityLabel="جارٍ تحميل المواعيد…">
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              className="h-9 w-24 rounded-ih-full bg-ih-neutral-200"
              style={{ opacity: 0.8 - index * 0.15 }}
            />
          ))}
        </View>
      ) : slots === undefined || slots.length === 0 ? (
        <Text testID="branch-no-slots" className="font-arabic text-[13px] text-ih-neutral-500">
          لا توجد مواعيد متاحة حالياً
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2">
            {slots.map((slot) => (
              <View
                key={`${slot.slotDate}-${slot.slotTime}`}
                className="h-9 items-center justify-center rounded-ih-full border border-ih-neutral-200 bg-ih-neutral-0 px-3.5"
              >
                <Text className="font-arabic-semibold text-[13px] text-ih-primary-700">
                  {getFirstAvailableSlotLabel(slot, now)}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  )
}
