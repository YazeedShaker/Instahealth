import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { logAuthErrorDev } from '../../features/auth/errors'
import { useAuthStore } from '../../features/auth/store'
import { releaseAllHolds } from '../../features/booking/api'
import { useBookingStore } from '../../features/booking/store'
import { supabase } from '../../lib/supabase'

// Styled placeholder profile tab — carries the logout action (moved here from
// the F01 placeholder Home). The full profile screen is a later feature.
export default function Profile() {
  const profile = useAuthStore((state) => state.profile)
  const markManualSignOut = useAuthStore((state) => state.markManualSignOut)
  const reset = useAuthStore((state) => state.reset)

  const handleLogout = async () => {
    markManualSignOut()
    // Release any active slot holds BEFORE the session clears — after signOut
    // the RLS delete-own path is gone and the hold would block its slot for
    // up to 10 minutes. Best-effort: server-side expiry is the safety net.
    const userId = useAuthStore.getState().session?.user.id
    if (userId !== undefined) {
      await releaseAllHolds(userId)
    }
    useBookingStore.getState().reset()
    try {
      await supabase.auth.signOut()
    } catch (error) {
      logAuthErrorDev('signOut', error)
    }
    reset()
  }

  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-50">
      <View className="flex-1 justify-center gap-4 px-6">
        <Text className="font-arabic-bold text-2xl text-ih-neutral-800">
          {profile?.name_ar ? profile.name_ar : 'حسابي'}
        </Text>
        <Text className="font-arabic text-base leading-7 text-ih-neutral-600">
          إعدادات الحساب الكاملة قادمة قريباً.
        </Text>
        <Pressable
          testID="home-logout"
          accessibilityRole="button"
          onPress={() => void handleLogout()}
          className="mt-4 h-[52px] items-center justify-center rounded-ih-sm border border-ih-neutral-200 bg-ih-neutral-0"
        >
          <Text className="font-arabic-semibold text-base text-ih-neutral-700">تسجيل الخروج</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
