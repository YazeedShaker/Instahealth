import { useRouter } from 'expo-router'
import { Pressable, Text } from 'react-native'

// 44px circular back control from the approved mockups. The arrow points
// "forward" (→) because the app is RTL — back is toward the reading direction.
export function BackButton({ testID }: { testID?: string }) {
  const router = useRouter()
  return (
    <Pressable
      testID={testID ?? 'auth-back'}
      accessibilityRole="button"
      accessibilityLabel="رجوع"
      onPress={() => router.back()}
      className="h-11 w-11 items-center justify-center rounded-ih-full border border-ih-neutral-200 bg-ih-neutral-50"
    >
      <Text className="text-lg text-ih-neutral-700">→</Text>
    </Pressable>
  )
}
