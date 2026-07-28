import { colors } from '@instahealth/design-tokens'
import { Redirect, Tabs, useSegments } from 'expo-router'
import { useEffect } from 'react'
import { Text } from 'react-native'

import { useAuthStore } from '../../features/auth/store'
import { cleanupFlow } from '../../features/booking/cleanup'
import { useBookingStore } from '../../features/booking/store'

// App group — the four destination tabs (DECISION-navigation-safe-areas §1:
// tab bar visible on destinations, hidden in auth/booking flows). Search,
// bookings, and profile are styled placeholders (F03/F07 fill them).
// Route protection lives here: no session → back to welcome.
export default function AppLayout() {
  const status = useAuthStore((state) => state.status)
  const userId = useAuthStore((state) => state.session?.user.id ?? null)

  // AUTHORITATIVE flow-exit release. This layout is always mounted while
  // signed in, and segments are pure route state — the moment the route is
  // no longer inside /booking while a hold or pending booking lingers, tear
  // it down. (The booking layout's own blur listener never fired on a real
  // device — holds leaked for their full 10 minutes after backing out.)
  const segments = useSegments()
  const isInBookingFlow = segments.includes('booking')
  const hasFlowState = useBookingStore(
    (state) => state.hold !== null || state.pendingBooking !== null,
  )
  useEffect(() => {
    if (!isInBookingFlow && hasFlowState) cleanupFlow(userId)
  }, [isInBookingFlow, hasFlowState, userId])

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
      {/* Nested stack: list + detail. Tab bar stays visible on BOTH
          (DECISION-navigation-safe-areas §1 names "My Bookings (list + detail)"
          as a destination) — nesting gives that for free. */}
      <Tabs.Screen name="bookings" options={{ title: 'حجوزاتي', tabBarIcon: tabIcon('📅') }} />
      <Tabs.Screen name="profile" options={{ title: 'حسابي', tabBarIcon: tabIcon('👤') }} />
      {/* Branch profile — a browsing DESTINATION: not a tab button, but the
          tab bar stays visible (DECISION-navigation-safe-areas §1). */}
      <Tabs.Screen name="branch/[id]" options={{ href: null }} />
      {/* Booking flow (nested stack) — commitment funnel: tab bar HIDDEN for
          all steps, exit via back only.
          NO `popToTopOnBlur`: bottom-tabs dispatches POP_TO_TOP when the blur
          ANIMATION finishes, which on a confirmed booking is after the replace
          to /confirmation has already torn the flow stack down — nothing is
          left to handle the action and it logged
          "The action 'POP_TO_TOP' was not handled by any navigator" on every
          successful payment. It was belt-and-braces anyway: re-entry is blocked
          by the flow layout's own selection guard, which redirects to Home. */}
      <Tabs.Screen name="booking" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      {/* Booking confirmation (F06) — deliberately OUTSIDE the booking group:
          the approved design has no step header and no hold timer, and the
          flow layout renders both. Tab bar stays hidden so the two stacked
          CTAs own the bottom of the screen, as designed. */}
      <Tabs.Screen name="confirmation" options={{ href: null, tabBarStyle: { display: 'none' } }} />
    </Tabs>
  )
}
