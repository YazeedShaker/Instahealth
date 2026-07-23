import { normalizeEgyptianPhone } from '@instahealth/core'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { BackButton } from '../../components/auth/BackButton'
import { PhoneInput } from '../../components/auth/PhoneInput'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { AUTH_ERRORS_AR, logAuthErrorDev, mapAuthError } from '../../features/auth/errors'
import { resetLockout } from '../../features/auth/lockout'
import { useAuthStore } from '../../features/auth/store'
import { supabase } from '../../lib/supabase'

const MIN_DIGITS_FOR_SUBMIT = 10

// Screen 2 · رقم الهاتف — validation comes exclusively from @instahealth/core.
export default function Phone() {
  const router = useRouter()
  const [digits, setDigits] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const setPendingPhone = useAuthStore((state) => state.setPendingPhone)
  const setLastOtpRequestedAt = useAuthStore((state) => state.setLastOtpRequestedAt)
  const setLockout = useAuthStore((state) => state.setLockout)
  const clearSessionExpired = useAuthStore((state) => state.clearSessionExpired)

  const handleSubmit = async () => {
    const normalized = normalizeEgyptianPhone(digits)
    if (normalized === null) {
      setErrorMessage(AUTH_ERRORS_AR.invalidPhone)
      return
    }
    setIsSubmitting(true)
    setErrorMessage(null)
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: normalized })
      if (error) throw error
      // analytics hook point: onOtpRequested (PostHog lands in its own later task)
      clearSessionExpired()
      setPendingPhone(normalized)
      setLastOtpRequestedAt(Date.now())
      setLockout(resetLockout())
      router.push('/(auth)/otp')
    } catch (error) {
      logAuthErrorDev('signInWithOtp', error)
      setErrorMessage(mapAuthError(error).messageAr)
    } finally {
      setIsSubmitting(false)
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
            <Text className="font-arabic-bold text-2xl text-ih-neutral-800">ما هو رقم هاتفك؟</Text>
            <Text className="font-arabic text-[15px] leading-6 text-ih-neutral-600">
              سنرسل لك رمز تحقق عبر رسالة نصية للتأكد من رقمك.
            </Text>
          </View>

          <View className="mt-7 gap-2.5">
            <Text className="font-arabic-semibold text-[13px] text-ih-neutral-600">رقم الهاتف</Text>
            <PhoneInput
              digits={digits}
              onChangeDigits={(nextDigits) => {
                setDigits(nextDigits)
                if (errorMessage !== null) setErrorMessage(null)
              }}
              hasError={errorMessage !== null}
            />
            {errorMessage !== null ? (
              <Text testID="phone-error" className="font-arabic text-[13px] text-ih-error">
                {errorMessage}
              </Text>
            ) : (
              <Text className="font-arabic text-[13px] leading-6 text-ih-neutral-500">
                مثال: ٠١٠٠ ١٢٣ ٤٥٦٧ — لن نشارك رقمك مع أي جهة.
              </Text>
            )}
          </View>

          <View className="flex-1" />

          <View className="pb-3">
            <PrimaryButton
              testID="phone-next"
              label="التالي"
              onPress={() => void handleSubmit()}
              disabled={digits.replace(/\D/g, '').length < MIN_DIGITS_FOR_SUBMIT}
              loading={isSubmitting}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
