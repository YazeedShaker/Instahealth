import type { SlotDaySection } from '@instahealth/core'
import { ScrollView, Pressable, Text, View } from 'react-native'

interface DateStripProps {
  sections: SlotDaySection[]
  selectedDate: string | null
  onSelectDate: (date: string) => void
}

// The horizontal day strip from the approved design — data-driven from the
// actual slot sections; fully-booked days render disabled with "ممتلئ".
export function DateStrip({ sections, selectedDate, onSelectDate }: DateStripProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row gap-2 px-5 py-0.5">
        {sections.map((section) => {
          const isSelected = section.date === selectedDate
          const isDisabled = !section.hasAvailability
          return (
            <Pressable
              key={section.date}
              testID={`date-chip-${section.date}`}
              accessibilityRole="button"
              accessibilityLabel={`${section.dayLabelAr} ${section.dayNumberAr}`}
              accessibilityState={{ selected: isSelected, disabled: isDisabled }}
              disabled={isDisabled}
              onPress={() => onSelectDate(section.date)}
              className={`min-w-[60px] items-center justify-center gap-0.5 rounded-ih-md border p-2 ${
                isSelected
                  ? 'border-ih-primary-400 bg-ih-primary-400'
                  : isDisabled
                    ? 'border-ih-neutral-200 bg-ih-neutral-100'
                    : 'border-ih-neutral-200 bg-ih-neutral-0'
              }`}
              style={isDisabled ? { opacity: 0.6 } : undefined}
            >
              <Text
                className={`font-arabic-semibold text-xs ${
                  isSelected ? 'text-white/90' : 'text-ih-neutral-500'
                }`}
              >
                {section.dayLabelAr}
              </Text>
              <Text
                className={`font-arabic-bold text-lg ${
                  isSelected
                    ? 'text-white'
                    : isDisabled
                      ? 'text-ih-neutral-400'
                      : 'text-ih-neutral-800'
                }`}
              >
                {section.dayNumberAr}
              </Text>
              {isDisabled ? (
                <Text className="font-arabic-semibold text-[9px] text-ih-neutral-400">ممتلئ</Text>
              ) : null}
            </Pressable>
          )
        })}
      </View>
    </ScrollView>
  )
}
