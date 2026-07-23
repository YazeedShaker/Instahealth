import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { logAuthErrorDev } from '../../features/auth/errors'
import { useAuthStore } from '../../features/auth/store'
import { useProfile } from '../../features/auth/useProfile'
import { supabase } from '../../lib/supabase'

// PLACEHOLDER Home — F02 replaces this screen entirely. Its only jobs here:
// greet the signed-in patient by name and offer logout.
export default function Home() {
  const profile = useAuthStore((state) => state.profile)
  const markManualSignOut = useAuthStore((state) => state.markManualSignOut)
  const reset = useAuthStore((state) => state.reset)
  useProfile()

  const handleLogout = async () => {
    markManualSignOut()
    try {
      await supabase.auth.signOut()
    } catch (error) {
      logAuthErrorDev('signOut', error)
    }
    reset()
  }

  const greetingName = profile?.name_ar?.trim()

  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-0">
      <View className="flex-1 justify-center gap-4 px-6">
        <Text testID="home-greeting" className="font-arabic-bold text-2xl text-ih-neutral-800">
          {greetingName ? `أهلاً ${greetingName} 👋` : 'أهلاً بك 👋'}
        </Text>
        <Text className="font-arabic text-base leading-7 text-ih-neutral-600">
          الرئيسية قادمة قريباً — هنا ستجد المعامل والعيادات القريبة منك.
        </Text>
        <Pressable
          testID="home-logout"
          accessibilityRole="button"
          onPress={() => void handleLogout()}
          className="mt-4 h-[52px] items-center justify-center rounded-ih-sm border border-ih-neutral-200"
        >
          <Text className="font-arabic-semibold text-base text-ih-neutral-700">تسجيل الخروج</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
