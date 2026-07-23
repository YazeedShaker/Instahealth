import { colors } from '@instahealth/design-tokens'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { logAuthErrorDev, mapAuthError } from '../../features/auth/errors'
import { updateProfileName } from '../../features/auth/profile'
import { useAuthStore } from '../../features/auth/store'

const MIN_NAME_LENGTH = 2

// First-time-only name entry — not mocked in DESIGN-01; built from the design
// system with the same skeleton as phone entry (one field, one sticky CTA).
export default function Name() {
  const router = useRouter()
  const session = useAuthStore((state) => state.session)
  const setProfile = useAuthStore((state) => state.setProfile)
  const [name, setName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async () => {
    const userId = session?.user.id
    if (userId === undefined) return
    setIsSaving(true)
    setErrorMessage(null)
    try {
      const profile = await updateProfileName(userId, name)
      // analytics hook point: onSignupCompleted (PostHog lands in its own later task)
      setProfile(profile)
      router.replace('/(app)/home')
    } catch (error) {
      logAuthErrorDev('updateProfileName', error)
      setErrorMessage(mapAuthError(error).messageAr)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-0">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 px-6 pb-5 pt-4">
          <View className="gap-2.5 pt-12">
            <Text className="font-arabic-bold text-2xl text-ih-neutral-800">ما هو اسمك؟</Text>
            <Text className="font-arabic text-[15px] leading-6 text-ih-neutral-600">
              سيظهر اسمك في حجوزاتك وفي رسائل التأكيد.
            </Text>
          </View>

          <View className="mt-7 gap-2.5">
            <Text className="font-arabic-semibold text-[13px] text-ih-neutral-600">الاسم</Text>
            <TextInput
              testID="name-input"
              accessibilityLabel="الاسم"
              value={name}
              onChangeText={(text) => {
                setName(text)
                if (errorMessage !== null) setErrorMessage(null)
              }}
              placeholder="اكتب اسمك هنا"
              placeholderTextColor={colors.neutral[400]}
              className="min-h-[52px] rounded-ih-sm px-4 font-arabic text-lg text-ih-neutral-800"
              style={{
                borderWidth: 1.5,
                borderColor: name.length > 0 ? colors.primary[400] : colors.neutral[200],
                textAlign: 'right',
              }}
            />
            {errorMessage !== null ? (
              <Text testID="name-error" className="font-arabic text-[13px] text-ih-error">
                {errorMessage}
              </Text>
            ) : null}
          </View>

          <View className="flex-1" />

          <View className="pb-3">
            <PrimaryButton
              testID="name-continue"
              label="متابعة"
              onPress={() => void handleSubmit()}
              disabled={name.trim().length < MIN_NAME_LENGTH}
              loading={isSaving}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
