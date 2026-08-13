import { useRouter } from 'expo-router'
import { Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { LogoHorizontal } from '../../components/brand/Logo'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { useAuthStore } from '../../features/auth/store'

// Screen 1 · الترحيب — built to the approved DESIGN-01 mockup.
export default function Welcome() {
  const router = useRouter()
  const sessionExpired = useAuthStore((state) => state.sessionExpired)

  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-0">
      <View className="flex-1 px-6 pb-5 pt-4">
        {/* ⚠ THE REAL LOCKUP, not a hand-set one. What stood here broke three
            brand rules at once: a ♥ glyph in place of the mark, «InstaHealth»
            set in CAIRO (`font-arabic-bold`) when the Latin wordmark is
            Atkinson Hyperlegible Bold, and a two-tone word colour that is not
            one of the four approved tones. The bundle's own "Don't" list is
            explicit — «never rebuild a lockup by setting the type yourself». */}
        <View className="flex-row pt-2">
          <LogoHorizontal tone="color" size={40} />
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
