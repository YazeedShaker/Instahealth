import { Text, View } from 'react-native'

interface HomeHeaderProps {
  greetingName: string | null
  areaLabel: string
}

// Greeting + location chip + notifications bell, per the approved mockup.
export function HomeHeader({ greetingName, areaLabel }: HomeHeaderProps) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3 pt-1">
        <View className="min-h-[44px] flex-row items-center gap-2 rounded-ih-full border border-ih-neutral-200 bg-ih-neutral-0 px-3.5 py-2">
          <Text className="text-[15px]">📍</Text>
          <Text testID="location-chip" className="font-arabic-semibold text-sm text-ih-neutral-800">
            {areaLabel}
          </Text>
          <Text className="text-[10px] text-ih-neutral-500">▾</Text>
        </View>
        <View
          accessibilityLabel="الإشعارات"
          className="h-11 w-11 items-center justify-center rounded-ih-full border border-ih-neutral-200 bg-ih-neutral-0"
        >
          <Text className="text-lg">🔔</Text>
        </View>
      </View>
      <Text testID="home-greeting" className="font-arabic-bold text-xl text-ih-neutral-800">
        {greetingName ? `أهلاً ${greetingName} 👋` : 'أهلاً بك 👋'}
      </Text>
    </View>
  )
}
