import { colors } from '@instahealth/design-tokens'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { logAuthErrorDev, mapAuthError } from '../../features/auth/errors'
import { updateProfileName } from '../../features/auth/profile'
import { useAuthStore } from '../../features/auth/store'

const MIN_NAME_LENGTH = 2

// PROF-01 — name editing. The F01 name-entry anatomy verbatim (one field, one
// sticky CTA) over the SAME RLS-scoped `updateProfileName` path; the only
// differences are a back affordance and a pre-filled value.
export default function EditName() {
  const router = useRouter()
  const session = useAuthStore((state) => state.session)
  const profile = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)
  const [name, setName] = useState(profile?.name_ar ?? '')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async () => {
    const userId = session?.user.id
    if (userId === undefined) return
    setIsSaving(true)
    setErrorMessage(null)
    try {
      const updated = await updateProfileName(userId, name)
      setProfile(updated)
      router.back()
    } catch (error) {
      logAuthErrorDev('updateProfileName', error)
      setErrorMessage(mapAuthError(error).messageAr)
    } finally {
      setIsSaving(false)
    }
  }

  const unchanged = name.trim() === (profile?.name_ar ?? '').trim()

  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-0">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-1 px-6 pb-5 pt-4">
          <Pressable
            testID="edit-name-back"
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center"
          >
            <Text className="text-lg text-ih-neutral-700">→</Text>
          </Pressable>

          <View className="gap-2.5 pt-6">
            <Text className="font-arabic-bold text-2xl text-ih-neutral-800">اسمك</Text>
            <Text className="font-arabic text-[15px] leading-6 text-ih-neutral-600">
              يظهر في حجوزاتك وفي رسائل التأكيد.
            </Text>
          </View>

          <View className="mt-7 gap-2.5">
            <Text className="font-arabic-semibold text-[13px] text-ih-neutral-600">الاسم</Text>
            <TextInput
              testID="edit-name-input"
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
              <Text testID="edit-name-error" className="font-arabic text-[13px] text-ih-error">
                {errorMessage}
              </Text>
            ) : null}
          </View>

          <View className="flex-1" />

          <View className="pb-3">
            <PrimaryButton
              testID="edit-name-save"
              label="حفظ"
              onPress={() => void handleSubmit()}
              disabled={name.trim().length < MIN_NAME_LENGTH || unchanged}
              loading={isSaving}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
