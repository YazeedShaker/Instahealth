import type { PreparationResult } from '@instahealth/core'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

interface PreparationStripProps {
  prep: PreparationResult
}

// The consolidated preparation callout (cream accent) — collapsed summary,
// tap to reveal per-service details IN PLACE (DECISION-provider-data-model §3:
// expandable inline, no modal, no dead end). Content comes from core's
// computePreparationNotes — never recomputed here.
export function PreparationStrip({ prep }: PreparationStripProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <View
      testID="prep-strip"
      className="overflow-hidden rounded-ih-sm border border-ih-accent-400 bg-ih-accent-200"
    >
      <Pressable
        testID="prep-strip-toggle"
        accessibilityRole="button"
        accessibilityLabel={prep.summaryAr ?? ''}
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen((open) => !open)}
        className="min-h-[44px] flex-row items-center gap-2.5 px-4 py-3.5"
      >
        <Text className="text-[15px]">⚠</Text>
        <Text className="flex-1 font-arabic-semibold text-[13.5px] leading-5 text-ih-primary-800">
          {prep.summaryAr}
        </Text>
        <Text
          className="text-xs text-ih-primary-700"
          style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
        >
          ▼
        </Text>
      </Pressable>
      {isOpen ? (
        <View className="gap-2 border-t border-ih-accent-400 px-4 pb-3.5 pt-0.5">
          {prep.details.map((detail) => (
            <View key={detail.noteAr} className="flex-row gap-2 pt-2.5">
              <Text className="text-[13px] text-ih-primary-700">•</Text>
              <Text className="flex-1 font-arabic text-[13.5px] leading-6 text-ih-primary-800">
                <Text className="font-arabic-bold">{detail.serviceNamesAr.join('، ')}: </Text>
                {detail.noteAr}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}
