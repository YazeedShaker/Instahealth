import { OTP_LENGTH } from '@instahealth/core'
import { Redirect, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BackButton } from '../../components/auth/BackButton'
import { OtpInput } from '../../components/auth/OtpInput'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { AUTH_ERRORS_AR, logAuthErrorDev, mapAuthError } from '../../features/auth/errors'
import {
  getRemainingLockSeconds,
  isLockedOut,
  recordFailedAttempt,
  resetLockout,
} from '../../features/auth/lockout'
import { formatPhoneDigits } from '../../components/auth/PhoneInput'
import { ensureProfile } from '../../features/auth/profile'
import { getResendState } from '../../features/auth/resend'
import { getAuthDestination } from '../../features/auth/routing'
import { useAuthStore } from '../../features/auth/store'
import { toArabicDigits } from '../../lib/arabicDigits'
import { supabase } from '../../lib/supabase'

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return toArabicDigits(`${minutes}:${seconds}`)
}

// Screen 3 · رمز التحقق — the phone arrives via the auth store (NOT a route
// param: CLAUDE.md §8 keeps phone numbers out of URLs).
export default function Otp() {
  const router = useRouter()
  const pendingPhone = useAuthStore((state) => state.pendingPhone)
  const lastOtpRequestedAt = useAuthStore((state) => state.lastOtpRequestedAt)
  const setLastOtpRequestedAt = useAuthStore((state) => state.setLastOtpRequestedAt)
  const lockout = useAuthStore((state) => state.lockout)
  const setLockout = useAuthStore((state) => state.setLockout)
  const setProfile = useAuthStore((state) => state.setProfile)

  const [code, setCode] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // One ticking clock drives both the resend countdown and the lockout countdown.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (pendingPhone === null) {
    return <Redirect href="/(auth)/phone" />
  }

  const resend = getResendState(lastOtpRequestedAt, now)
  const locked = isLockedOut(lockout, now)
  const lockSecondsRemaining = getRemainingLockSeconds(lockout, now)
  const displayPhone = `+20 ${formatPhoneDigits(pendingPhone.slice(3))}`

  const handleVerify = async () => {
    setIsVerifying(true)
    setErrorMessage(null)
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: pendingPhone,
        token: code,
        type: 'sms',
      })
      if (error) throw error
      const userId = data.session?.user.id ?? data.user?.id
      if (userId === undefined) throw new Error('verifyOtp returned no user')
      setLockout(resetLockout())
      const profile = await ensureProfile(userId, pendingPhone)
      setProfile(profile)
      router.replace(getAuthDestination({ hasSession: true, profileName: profile.name_ar }))
    } catch (error) {
      logAuthErrorDev('verifyOtp', error)
      setErrorMessage(mapAuthError(error).messageAr)
      setLockout(recordFailedAttempt(lockout, Date.now()))
      setCode('')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    setErrorMessage(null)
    setCode('')
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: pendingPhone })
      if (error) throw error
      setLastOtpRequestedAt(Date.now())
    } catch (error) {
      logAuthErrorDev('resendOtp', error)
      setErrorMessage(mapAuthError(error).messageAr)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-0">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 px-6 pb-5 pt-4">
          <View className="pb-7 pt-2">
            <BackButton />
          </View>

          <View className="gap-2.5">
            <Text className="font-arabic-bold text-2xl text-ih-neutral-800">أدخل رمز التحقق</Text>
            <Text className="font-arabic text-[15px] leading-6 text-ih-neutral-600">
              أرسلنا رمزاً من ٦ أرقام إلى{' '}
              <Text className="font-english-bold text-ih-neutral-800">{displayPhone}</Text>
            </Text>
            <Pressable
              testID="edit-phone"
              accessibilityRole="link"
              onPress={() => router.back()}
              hitSlop={8}
            >
              <Text className="font-arabic-semibold text-sm text-ih-primary-600 underline">
                تعديل الرقم
              </Text>
            </Pressable>
          </View>

          <View className="mt-8 gap-4">
            <OtpInput
              code={code}
              onChangeCode={(nextCode) => {
                setCode(nextCode)
                if (errorMessage !== null) setErrorMessage(null)
              }}
              hasError={errorMessage !== null}
              disabled={locked || isVerifying}
            />

            {errorMessage !== null && !locked ? (
              <Text testID="otp-error" className="text-center font-arabic text-sm text-ih-error">
                ⚠ {errorMessage}
              </Text>
            ) : null}

            {locked ? (
              <Text testID="otp-locked" className="text-center font-arabic text-sm text-ih-error">
                {AUTH_ERRORS_AR.locked} ({formatCountdown(lockSecondsRemaining)})
              </Text>
            ) : (
              <View className="items-center">
                {resend.canResend ? (
                  <Pressable testID="otp-resend" onPress={() => void handleResend()} hitSlop={8}>
                    <Text className="font-arabic-bold text-sm text-ih-primary-600">
                      إعادة إرسال الرمز
                    </Text>
                  </Pressable>
                ) : (
                  <Text className="font-arabic text-sm text-ih-neutral-600">
                    يمكنك إعادة إرسال الرمز خلال{' '}
                    <Text className="font-arabic-bold text-ih-primary-600">
                      {formatCountdown(resend.secondsRemaining)}
                    </Text>
                  </Text>
                )}
              </View>
            )}
          </View>

          <View className="flex-1" />

          <View className="pb-3">
            <PrimaryButton
              testID="otp-confirm"
              label="تأكيد"
              onPress={() => void handleVerify()}
              disabled={code.length < OTP_LENGTH || locked}
              loading={isVerifying}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
