import { formatTimeShortAr, type SlotDaySection, type SlotPickerSlot } from '@instahealth/core'
import { Pressable, Text, View } from 'react-native'

interface TimeGridProps {
  section: SlotDaySection | null
  selectedSlotId: string | null
  /** The slot a hold RPC is in flight for — renders a pressed/pending state. */
  requestingSlotId: string | null
  onSelectSlot: (slot: SlotPickerSlot) => void
}

// The selected day's slots as chips grouped by period (صباحاً / ظهراً / مساءً),
// 3-up grid per the design. Only `available` slots are tappable — status comes
// from core; other patients' holds are invisible, the RPC is the real gate.
export function TimeGrid({
  section,
  selectedSlotId,
  requestingSlotId,
  onSelectSlot,
}: TimeGridProps) {
  if (section === null || section.periods.length === 0) {
    return (
      <View className="items-center gap-2 px-5 py-8">
        <Text className="text-3xl">🗓️</Text>
        <Text className="text-center font-arabic text-sm text-ih-neutral-500">
          لا توجد مواعيد متاحة في هذا اليوم — جرّب يوماً آخر
        </Text>
      </View>
    )
  }

  return (
    <View className="gap-4 px-5">
      <Text className="font-arabic-bold text-sm text-ih-neutral-700">المواعيد المتاحة</Text>
      {section.periods.map((period) => (
        <View key={period.key} className="gap-2.5">
          <Text className="font-arabic-semibold text-[13px] text-ih-neutral-500">
            {period.labelAr}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {period.slots.map((slot) => {
              const isFull = slot.status === 'full'
              const isSelected = slot.id === selectedSlotId
              const isRequesting = slot.id === requestingSlotId
              return (
                <Pressable
                  key={slot.id}
                  testID={`slot-chip-${slot.slotTime.slice(0, 5)}`}
                  accessibilityRole="button"
                  accessibilityLabel={formatTimeShortAr(slot.slotTime)}
                  accessibilityState={{ selected: isSelected, disabled: isFull }}
                  disabled={isFull || isRequesting}
                  onPress={() => onSelectSlot(slot)}
                  className={`min-h-[48px] items-center justify-center gap-0 rounded-ih-sm border px-2 ${
                    isSelected || isRequesting
                      ? 'border-ih-primary-400 bg-ih-primary-400'
                      : isFull
                        ? 'border-ih-neutral-200 bg-ih-neutral-100'
                        : 'border-ih-neutral-200 bg-ih-neutral-0'
                  }`}
                  style={{ width: '31.5%', opacity: isFull ? 0.65 : 1 }}
                >
                  <Text
                    className={`text-sm ${
                      isSelected || isRequesting
                        ? 'font-arabic-bold text-white'
                        : isFull
                          ? 'font-arabic-semibold text-ih-neutral-400'
                          : 'font-arabic-semibold text-ih-neutral-800'
                    }`}
                  >
                    {formatTimeShortAr(slot.slotTime)}
                  </Text>
                  {isFull ? (
                    <Text className="font-arabic-semibold text-[10px] text-ih-neutral-400">
                      ممتلئ
                    </Text>
                  ) : null}
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}
    </View>
  )
}
