import { Stack } from 'expo-router'

// حجوزاتي is a DESTINATION with a detail screen inside it, so it owns a nested
// stack rather than a sibling route. Nesting is what keeps the tab bar visible
// on both list and detail, which DECISION-navigation-safe-areas §1 requires
// ("My Bookings (list + detail)") — no per-screen tabBarStyle override needed.
export const unstable_settings = { initialRouteName: 'index' }

export default function BookingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  )
}
