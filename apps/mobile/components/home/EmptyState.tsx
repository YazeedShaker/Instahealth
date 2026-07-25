import { Pressable, Text, View } from 'react-native'

interface EmptyStateProps {
  hasActiveFilter: boolean
  onClearFilter: () => void
}

// Empty results per the approved mockup — friendly, with a way out (never a dead end).
export function EmptyState({ hasActiveFilter, onClearFilter }: EmptyStateProps) {
  return (
    <View testID="home-empty" className="items-center gap-5 px-3 py-8">
      <View className="h-32 w-32 items-center justify-center rounded-ih-full bg-ih-accent-300/35">
        <Text className="text-4xl">🔎</Text>
      </View>
      <View className="items-center gap-2">
        <Text className="text-center font-arabic-bold text-lg text-ih-neutral-800">
          لا توجد نتائج
        </Text>
        <Text className="text-center font-arabic text-sm leading-6 text-ih-neutral-600">
          جرّب تغيير الفئة — غالباً ستجد مراكز ممتازة على بُعد دقائق إضافية.
        </Text>
      </View>
      {hasActiveFilter ? (
        <Pressable
          testID="clear-filter"
          accessibilityRole="button"
          onPress={onClearFilter}
          className="h-11 items-center justify-center rounded-ih-sm border border-ih-neutral-200 px-6"
        >
          <Text className="font-arabic-semibold text-sm text-ih-neutral-700">مسح الفلاتر</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
