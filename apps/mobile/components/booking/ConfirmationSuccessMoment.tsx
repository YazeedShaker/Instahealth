import { colors } from '@instahealth/design-tokens'
import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Text, View } from 'react-native'

const RING_DURATION_MS = 2600
const SECOND_RING_DELAY_MS = 500

/**
 * The success moment from the approved confirmation design: two expanding
 * rings behind a gradient check disc.
 *
 * ON THE LOTTIE QUESTION — the spec calls this "one of the two sanctioned
 * Lottie uses". It is built with RN Animated instead, deliberately:
 *
 *  · The design handoff's own artifact IS this animation (the `ih-ring`
 *    keyframes on a `data-lottie-slot` placeholder) — matching it needs no
 *    animation file, and no Lottie file was shipped in the bundle.
 *  · `lottie-react-native` is a NATIVE module. Expo Go is the founder's only
 *    device path until the Apple Developer account lands
 *    (ENGINEERING-WORKFLOW §6), so adding one risks the single way this gets
 *    tested, for zero visual gain.
 *
 * This component is the seam: swap its body for a Lottie view when dev builds
 * unblock, and nothing else changes.
 *
 * Respects reduced motion, as the design's own
 * `@media (prefers-reduced-motion: reduce)` rule does.
 */
export function ConfirmationSuccessMoment() {
  const [isReduceMotionEnabled, setIsReduceMotionEnabled] = useState(false)
  const outerRing = useRef(new Animated.Value(0)).current
  const innerRing = useRef(new Animated.Value(0)).current

  useEffect(() => {
    let isMounted = true
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isMounted) setIsReduceMotionEnabled(enabled)
    })
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setIsReduceMotionEnabled,
    )
    return () => {
      isMounted = false
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    if (isReduceMotionEnabled) return
    const pulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: RING_DURATION_MS,
            easing: Easing.bezier(0.22, 1, 0.36, 1),
            useNativeDriver: true,
          }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      )
    const animation = Animated.parallel([
      pulse(outerRing, 0),
      pulse(innerRing, SECOND_RING_DELAY_MS),
    ])
    animation.start()
    return () => animation.stop()
  }, [isReduceMotionEnabled, outerRing, innerRing])

  // 0.85 → 1.35 scale, 0.55 → 0 opacity (the design's ih-ring keyframes).
  const ringStyle = (value: Animated.Value) =>
    isReduceMotionEnabled
      ? { opacity: 0.25 }
      : {
          opacity: value.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.55, 0, 0] }),
          transform: [
            {
              scale: value.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [0.85, 1.35, 1.35],
              }),
            },
          ],
        }

  return (
    <View
      testID="confirmation-success-moment"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="h-[116px] w-[116px] items-center justify-center"
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            backgroundColor: colors.primary[50],
          },
          ringStyle(outerRing),
        ]}
      />
      <Animated.View
        style={[
          {
            position: 'absolute',
            inset: 10,
            borderRadius: 999,
            backgroundColor: colors.primary[100],
          },
          ringStyle(innerRing),
        ]}
      />
      <LinearGradient
        colors={[colors.primary[700], colors.primary[400]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 78,
          height: 78,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text className="text-[34px] text-white">✓</Text>
      </LinearGradient>
    </View>
  )
}
