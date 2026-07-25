import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

// Styled placeholder — F03 builds the real search.
export default function Search() {
  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-50">
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <Text className="text-4xl">🔍</Text>
        <Text className="font-arabic-bold text-lg text-ih-neutral-800">البحث قادم قريباً</Text>
        <Text className="text-center font-arabic text-sm leading-6 text-ih-neutral-600">
          ستتمكن من البحث عن أي تحليل أو أشعة ومقارنة الأسعار بين المراكز.
        </Text>
      </View>
    </SafeAreaView>
  )
}
