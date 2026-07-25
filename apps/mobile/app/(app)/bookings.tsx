import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

// Styled placeholder — F07 builds My Bookings.
export default function Bookings() {
  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-50">
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <Text className="text-4xl">📅</Text>
        <Text className="font-arabic-bold text-lg text-ih-neutral-800">حجوزاتك ستظهر هنا</Text>
        <Text className="text-center font-arabic text-sm leading-6 text-ih-neutral-600">
          بعد أول حجز ستجد مواعيدك وتفاصيلها في هذه الصفحة.
        </Text>
      </View>
    </SafeAreaView>
  )
}
