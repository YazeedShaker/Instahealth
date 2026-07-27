import { getRemainingHoldSeconds } from '@instahealth/core'
import { useQueryClient } from '@tanstack/react-query'
import { Redirect, Stack, useRouter, useSegments } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BookingStepsHeader } from '../../../components/booking/BookingStepsHeader'
import { HoldChip } from '../../../components/booking/HoldChip'
import { HoldExpiredModal } from '../../../components/booking/HoldExpiredModal'
import { handleHoldExpired } from '../../../features/booking/expiry'
import { useBookingStore } from '../../../features/booking/store'

const STEP_BY_SEGMENT: Record<string, number> = { slot: 1, review: 2, payment: 3 }
const TICK_MS = 1000

// The flow always starts at the slot picker (alphabetical order would pick
// "payment" as the stack's initial route otherwise).
export const unstable_settings = { initialRouteName: 'slot' }

// The booking-flow chrome (F05): step progress + the persistent hold timer.
// Tab bar is hidden for the whole flow (DECISION-navigation-safe-areas §1 —
// commitment funnel; exit only via back). The timer lives HERE, driven by the
// store's server-issued expiresAt — never a per-screen countdown.
export default function BookingFlowLayout() {
  const router = useRouter()
  const segments = useSegments()
  const queryClient = useQueryClient()

  const selectionCount = useBookingStore((state) => state.selectedServices.length)
  const hold = useBookingStore((state) => state.hold)
  // ONE source of truth for "the hold is gone" — set by this layout's timer OR
  // by the payment screen when `settle-payment` refuses with `hold_expired`.
  const holdExpired = useBookingStore((state) => state.holdExpired)

  const [nowMs, setNowMs] = useState(() => Date.now())

  // 1s tick while a hold is live — drives the chip and expiry detection.
  useEffect(() => {
    if (hold === null) return
    const interval = setInterval(() => setNowMs(Date.now()), TICK_MS)
    return () => clearInterval(interval)
  }, [hold])

  const remainingSeconds =
    hold !== null ? getRemainingHoldSeconds(new Date(hold.expiresAt), new Date(nowMs)) : null

  // Expiry while inside the flow → the shared teardown (clears the dead hold +
  // stale pending booking and raises the flag this layout's modal renders off).
  useEffect(() => {
    if (remainingSeconds === null || remainingSeconds > 0) return
    if (useBookingStore.getState().hold === null) return
    handleHoldExpired()
  }, [remainingSeconds])

  // Flow-exit teardown lives in (app)/_layout's segments watcher — pure
  // route state, always mounted. (This navigator's blur event proved
  // unreliable on device, and Tabs keep it mounted so unmount never fires;
  // both former backstops removed. App kill needs nothing: one-hold-per-
  // patient + server expiry + the 5-min cron self-heal.)

  // Guard: no selection → nothing to book (deep entry, session restore…).
  if (selectionCount === 0) {
    return <Redirect href="/(app)/home" />
  }

  const currentSegment = segments[segments.length - 1] ?? 'slot'
  const currentStep = STEP_BY_SEGMENT[currentSegment] ?? 1

  const handlePickAgain = () => {
    useBookingStore.getState().setHoldExpired(false)
    void queryClient.invalidateQueries({ queryKey: ['booking', 'slots'] })
    router.dismissTo('/(app)/booking/slot')
  }

  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-50" edges={['top']}>
      <View className="gap-3 border-b border-ih-neutral-200 bg-ih-neutral-0 px-4 pb-3.5 pt-3">
        <View className="flex-row items-center gap-2">
          <Pressable
            testID="booking-flow-back"
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/home'))}
            className="h-9 w-9 items-center justify-center rounded-ih-full border border-ih-neutral-200 bg-ih-neutral-50"
          >
            <Text className="text-base text-ih-neutral-700">→</Text>
          </Pressable>
          <View className="flex-1">
            <BookingStepsHeader currentStep={currentStep} />
          </View>
        </View>
        {hold !== null && remainingSeconds !== null && remainingSeconds > 0 ? (
          <HoldChip remainingSeconds={remainingSeconds} />
        ) : null}
      </View>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
      >
        <Stack.Screen name="slot" />
        <Stack.Screen name="review" />
        <Stack.Screen name="payment" />
      </Stack>
      <HoldExpiredModal visible={holdExpired} onPickAgain={handlePickAgain} />
    </SafeAreaView>
  )
}
