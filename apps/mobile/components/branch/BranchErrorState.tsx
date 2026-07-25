import { useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'

interface BranchErrorStateProps {
  /** true → the id didn't resolve to an active branch; false → network/query error. */
  isNotFound: boolean
  onRetry: () => void
}

// Friendly Arabic error state for unknown/inactive branch ids and load
// failures — always an action, never a dead end (PRODUCT.md §8).
export function BranchErrorState({ isNotFound, onRetry }: BranchErrorStateProps) {
  const router = useRouter()

  return (
    <View testID="branch-error" className="flex-1 items-center justify-center gap-4 px-8">
      <Text className="text-5xl">{isNotFound ? '🏥' : '📡'}</Text>
      <Text className="text-center font-arabic-bold text-lg text-ih-neutral-800">
        {isNotFound ? 'هذا المركز غير متاح' : 'تعذر تحميل بيانات المركز'}
      </Text>
      <Text className="text-center font-arabic text-sm leading-6 text-ih-neutral-600">
        {isNotFound
          ? 'ربما تم إيقاف هذا الفرع أو أن الرابط غير صحيح. تصفح المراكز المتاحة من الرئيسية.'
          : 'تحقق من اتصالك بالإنترنت وحاول مرة أخرى.'}
      </Text>
      {isNotFound ? (
        <Pressable
          testID="branch-error-home"
          accessibilityRole="button"
          onPress={() => router.replace('/(app)/home')}
          className="h-12 items-center justify-center rounded-ih-sm bg-ih-primary-400 px-8"
        >
          <Text className="font-arabic-semibold text-base text-white">العودة للرئيسية</Text>
        </Pressable>
      ) : (
        <Pressable
          testID="branch-error-retry"
          accessibilityRole="button"
          onPress={onRetry}
          className="h-12 items-center justify-center rounded-ih-sm border border-ih-neutral-200 bg-ih-neutral-0 px-8"
        >
          <Text className="font-arabic-semibold text-base text-ih-neutral-700">إعادة المحاولة</Text>
        </Pressable>
      )}
    </View>
  )
}
