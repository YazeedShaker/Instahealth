import { colors } from '@instahealth/design-tokens'
import { Redirect, Tabs } from 'expo-router'
import { Text } from 'react-native'

import { useAuthStore } from '../../features/auth/store'

// App group — the four destination tabs (DECISION-navigation-safe-areas §1:
// tab bar visible on destinations, hidden in auth/booking flows). Search,
// bookings, and profile are styled placeholders (F03/F07 fill them).
// Route protection lives here: no session → back to welcome.
export default function AppLayout() {
  const status = useAuthStore((state) => state.status)

  if (status === 'loading') return null
  if (status === 'signedOut') {
    return <Redirect href="/(auth)/welcome" />
  }

  const tabIcon = (emoji: string) =>
    function TabIcon({ focused }: { focused: boolean }) {
      return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>
    }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary[400],
        tabBarInactiveTintColor: colors.neutral[500],
        tabBarLabelStyle: { fontFamily: 'Cairo_600SemiBold', fontSize: 11 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'الرئيسية', tabBarIcon: tabIcon('🏠') }} />
      <Tabs.Screen name="search" options={{ title: 'البحث', tabBarIcon: tabIcon('🔍') }} />
      <Tabs.Screen name="bookings" options={{ title: 'حجوزاتي', tabBarIcon: tabIcon('📅') }} />
      <Tabs.Screen name="profile" options={{ title: 'حسابي', tabBarIcon: tabIcon('👤') }} />
      {/* Branch profile — a browsing DESTINATION: not a tab button, but the
          tab bar stays visible (DECISION-navigation-safe-areas §1). */}
      <Tabs.Screen name="branch/[id]" options={{ href: null }} />
      {/* Booking flow (nested stack) — commitment funnel: tab bar HIDDEN for
          all steps, exit via back only. */}
      <Tabs.Screen
        name="booking"
        options={{ href: null, tabBarStyle: { display: 'none' }, popToTopOnBlur: true }}
      />
    </Tabs>
  )
}
