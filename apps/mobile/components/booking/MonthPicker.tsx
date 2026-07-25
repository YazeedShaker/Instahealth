import type { SlotDaySection } from '@instahealth/core'
import { useMemo } from 'react'
import { Pressable, Text, View } from 'react-native'

import { buildMonthGrid } from '../../features/booking/monthGrid'

interface MonthPickerProps {
  sections: SlotDaySection[]
  selectedDate: string | null
  now: Date
  onPickDate: (date: string) => void
  onClose: () => void
}

function chunkIntoWeeks<T>(cells: T[]): T[][] {
  const weeks: T[][] = []
  for (let start = 0; start < cells.length; start += 7) {
    weeks.push(cells.slice(start, start + 7))
  }
  return weeks
}

// The month-view panel behind the "الشهر" affordance (DECISION-booking-flow:
// strip + calendar, both capped at the slot window). Selectable = days that
// actually have available slots.
export function MonthPicker({
  sections,
  selectedDate,
  now,
  onPickDate,
  onClose,
}: MonthPickerProps) {
  const grid = useMemo(() => buildMonthGrid(sections, now), [sections, now])

  return (
    <View
      testID="month-picker"
      className="mx-5 gap-3 rounded-ih-lg border border-ih-neutral-200 bg-ih-neutral-0 p-4"
      style={{
        elevation: 6,
        shadowOpacity: 0.12,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
      }}
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-arabic-bold text-[15px] text-ih-neutral-800">{grid.titleAr}</Text>
        <Pressable
          testID="month-picker-close"
          accessibilityRole="button"
          accessibilityLabel="إغلاق"
          onPress={onClose}
          className="h-8 w-8 items-center justify-center rounded-ih-full bg-ih-neutral-50"
        >
          <Text className="text-[13px] text-ih-neutral-600">✕</Text>
        </Pressable>
      </View>

      <View className="flex-row">
        {grid.weekdayHeadsAr.map((head) => (
          <Text
            key={head}
            className="flex-1 py-1 text-center font-arabic-bold text-[11px] text-ih-neutral-500"
          >
            {head}
          </Text>
        ))}
      </View>
      {chunkIntoWeeks(grid.cells).map((week, weekIndex) => (
        <View key={weekIndex} className="flex-row gap-1">
          {week.map((cell, cellIndex) =>
            cell.date === null ? (
              <View key={`lead-${cellIndex}`} className="min-h-[38px] flex-1" />
            ) : (
              <Pressable
                key={cell.date}
                testID={`month-day-${cell.date}`}
                accessibilityRole="button"
                accessibilityState={{
                  selected: cell.date === selectedDate,
                  disabled: !cell.isSelectable,
                }}
                disabled={!cell.isSelectable}
                onPress={() => onPickDate(cell.date as string)}
                className={`min-h-[38px] flex-1 items-center justify-center rounded-ih-sm ${
                  cell.date === selectedDate
                    ? 'bg-ih-primary-400'
                    : cell.isFull
                      ? 'bg-ih-neutral-100'
                      : ''
                }`}
              >
                <Text
                  className={`text-[13px] ${
                    cell.date === selectedDate
                      ? 'font-arabic-bold text-white'
                      : cell.isSelectable
                        ? 'font-arabic-semibold text-ih-neutral-800'
                        : 'font-arabic-semibold text-ih-neutral-300'
                  }`}
                >
                  {cell.labelAr}
                </Text>
              </Pressable>
            ),
          )}
          {week.length < 7
            ? Array.from({ length: 7 - week.length }, (_, filler) => (
                <View key={`tail-${filler}`} className="min-h-[38px] flex-1" />
              ))
            : null}
        </View>
      ))}

      <View className="flex-row gap-3.5">
        <View className="flex-row items-center gap-1.5">
          <View className="h-2.5 w-2.5 rounded-ih-xs bg-ih-primary-400" />
          <Text className="font-arabic text-[11px] text-ih-neutral-500">المختار</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="h-2.5 w-2.5 rounded-ih-xs border border-ih-neutral-200 bg-ih-neutral-100" />
          <Text className="font-arabic text-[11px] text-ih-neutral-500">ممتلئ</Text>
        </View>
      </View>
    </View>
  )
}
