import { colors } from '@instahealth/design-tokens'
import { Redirect, Tabs } from 'expo-router'

import { useAuthStore } from '../../features/auth/store'

// App group — tab bar shell (single Home tab until F02 adds the rest).
// Route protection lives here: no session → back to welcome.
export default function AppLayout() {
  const status = useAuthStore((state) => state.status)

  if (status === 'loading') return null
  if (status === 'signedOut') {
    return <Redirect href="/(auth)/welcome" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary[400],
        tabBarInactiveTintColor: colors.neutral[500],
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'الرئيسية' }} />
    </Tabs>
  )
}
