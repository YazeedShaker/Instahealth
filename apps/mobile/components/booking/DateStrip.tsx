import type { SlotDaySection } from '@instahealth/core'
import { ScrollView, Pressable, Text, View } from 'react-native'

interface DateStripProps {
  sections: SlotDaySection[]
  selectedDate: string | null
  onSelectDate: (date: string) => void
}

// The horizontal day strip from the approved design — data-driven from the
// actual slot sections; fully-booked days render disabled with "ممتلئ".
//
// ⚠ SELECTED AND FULL ARE INDEPENDENT, AND THE COMBINATION IS THE COMMON CASE —
// not a race. `selectedDate` falls back to `hold?.slotDate`, and a patient's own
// hold CONSUMES capacity, so taking the last slot of a day makes that day both
// the active selection and full in the same render. Every patient who books the
// last appointment of a day sees this chip.
//
// The design's own frame computes `sel` and `full` as separate flags and gives
// every label a `sel` branch — except «ممتلئ», which it hardcodes to
// `var(--ih-neutral-400)`. On the teal selected fill, dimmed to 0.6, that is
// **1.15:1** — worse than the plain full-day chip (1.36:1) and simply unreadable.
// The bundle carries the same bug; it is flagged in design/handoff/EXPORT.md.
//
// Two changes, both staying inside the design's existing vocabulary:
//   ① «ممتلئ» gets the `sel` branch its siblings already have → pure white,
//      the same colour the design gives the day NUMBER when selected. 2.26:1 —
//      exact parity with that number, so this invents no new treatment.
//   ② A SELECTED chip is not dimmed. `opacity: 0.6` is the design's
//      de-emphasis for an unavailable day; applying it to the day the patient
//      is actively on is what dragged every label on it toward the background.
//
// ⚠ 2.26:1 is not AA. It is the brand mint's own contrast with white, which the
// design already accepts for the day number on every selected chip — raising it
// is a question about `primary.400` as a fill, not about this bug.
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
              // ⚠ NOT dimmed when selected — see the header note.
              style={isDisabled && !isSelected ? { opacity: 0.6 } : undefined}
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
                <Text
                  className={`font-arabic-semibold text-[9px] ${
                    isSelected ? 'text-white' : 'text-ih-neutral-400'
                  }`}
                >
                  ممتلئ
                </Text>
              ) : null}
            </Pressable>
          )
        })}
      </View>
    </ScrollView>
  )
}
