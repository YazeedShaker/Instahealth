import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { useAuthStore } from '../../features/auth/store'

// Screen 1 · الترحيب — built to the approved DESIGN-01 mockup.
export default function Welcome() {
  const router = useRouter()
  const sessionExpired = useAuthStore((state) => state.sessionExpired)

  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-0">
      <View className="flex-1 px-6 pb-5 pt-4">
        {/* Logo row */}
        <View className="flex-row items-center gap-2.5 pt-2">
          <View className="h-10 w-10 items-center justify-center rounded-ih-md bg-ih-primary-600">
            <Text className="text-xl text-white">♥</Text>
          </View>
          <View style={{ direction: 'ltr' }}>
            <Text className="font-arabic-bold text-[22px]">
              <Text className="text-ih-neutral-800">Insta</Text>
              <Text className="text-ih-primary-400">Health</Text>
            </Text>
          </View>
        </View>

        {/* Hero + copy */}
        <View className="flex-1 justify-center gap-7">
          <View className="h-[300px] rounded-ih-xl bg-ih-accent-300/35 p-3.5">
            <View className="flex-1 items-center justify-center rounded-ih-lg bg-ih-accent-200/60">
              <Text className="text-5xl">🩺</Text>
            </View>
          </View>
          <View className="gap-3 px-1">
            <Text className="text-center font-arabic-bold text-[27px] leading-10 text-ih-neutral-800">
              خدمتك الطبية أونلاين — احجز في دقائق
            </Text>
            <Text className="text-center font-arabic text-base leading-7 text-ih-neutral-600">
              اعثر على أقرب معمل أو عيادة، قارن الأسعار، واحجز موعدك بكل سهولة.
            </Text>
          </View>
        </View>

        {/* Sticky CTA — inside the safe area (DECISION-navigation-safe-areas §2) */}
        <View className="gap-3 pb-3">
          {sessionExpired ? (
            <Text className="text-center font-arabic text-sm text-ih-neutral-600">
              انتهت الجلسة — سجّل الدخول مرة أخرى
            </Text>
          ) : null}
          <PrimaryButton
            testID="welcome-start"
            label="ابدأ"
            onPress={() => router.push('/(auth)/phone')}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}
