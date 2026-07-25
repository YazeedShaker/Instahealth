import { useRouter } from 'expo-router'
import { Pressable, Text } from 'react-native'

// Visual search bar per the design — tapping navigates to the Search tab
// (F03 builds the real search; the tab is a styled placeholder until then).
export function HomeSearchBar() {
  const router = useRouter()
  return (
    <Pressable
      testID="home-search-bar"
      accessibilityRole="search"
      accessibilityLabel="ابحث عن تحليل، أشعة، أو طبيب"
      onPress={() => router.push('/(app)/search')}
      className="min-h-[52px] flex-row items-center gap-2.5 rounded-ih-md border-[1.5px] border-ih-neutral-200 bg-ih-neutral-0 px-4"
    >
      <Text className="text-[17px]" style={{ opacity: 0.7 }}>
        🔍
      </Text>
      <Text className="font-arabic text-[15px] text-ih-neutral-400">
        ابحث عن تحليل، أشعة، أو طبيب…
      </Text>
    </Pressable>
  )
}
