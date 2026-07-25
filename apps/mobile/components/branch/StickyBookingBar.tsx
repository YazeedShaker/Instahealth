import { formatEgpDigitsAr, type SelectionSummary } from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { Pressable, Text, View } from 'react-native'

interface StickyBookingBarProps {
  summary: SelectionSummary
  onBook: () => void
}

// The sticky bottom bar from the approved mockup: running total + count on the
// start side, احجز الآن CTA on the end. Disabled until ≥1 service is selected.
// Sits ABOVE the tab bar (branch profile is a destination — tabs stay visible),
// so the tab bar itself provides the bottom safe-area clearance.
export function StickyBookingBar({ summary, onBook }: StickyBookingBarProps) {
  const hasSelection = summary.count > 0

  return (
    <View
      className="flex-row items-center gap-4 border-t border-ih-neutral-200 bg-ih-neutral-0 px-5 py-3.5"
      style={{
        shadowColor: colors.primary[700],
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      <View className="flex-1 gap-0.5">
        <Text className="font-arabic text-xs text-ih-neutral-500">
          الإجمالي <Text className="text-ih-neutral-400">· {summary.countLabelAr}</Text>
        </Text>
        <Text
          testID="booking-total"
          className={`font-arabic-bold text-xl ${
            hasSelection ? 'text-ih-primary-700' : 'text-ih-neutral-400'
          }`}
        >
          {formatEgpDigitsAr(summary.totalEgp)}{' '}
          <Text
            className={`font-english text-[13px] ${
              hasSelection ? 'text-ih-neutral-500' : 'text-ih-neutral-400'
            }`}
          >
            EGP
          </Text>
        </Text>
      </View>
      <Pressable
        testID="book-now"
        accessibilityRole="button"
        accessibilityLabel="احجز الآن"
        accessibilityState={{ disabled: !hasSelection }}
        disabled={!hasSelection}
        onPress={onBook}
        className="h-[52px] min-w-[150px] items-center justify-center rounded-ih-sm bg-ih-primary-400 px-6"
        style={!hasSelection ? { opacity: 0.45 } : undefined}
      >
        <Text className="font-arabic-semibold text-base text-white">احجز الآن</Text>
      </Pressable>
    </View>
  )
}
