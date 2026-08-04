import { colors } from '@instahealth/design-tokens'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { performPostDeletionCleanup } from '../../features/auth/logout'
import { deleteAccount } from '../../features/profile/api'

// PROF-01 — the account-deletion consequences screen. Plain Arabic about what
// actually happens (the ratified semantics), then a TYPE-TO-CONFIRM gate (the
// P03 price-editor pattern: a destructive action nobody should reach by
// mis-tap), then the server call.
//
// Composed from existing anatomies only: the F01 single-field screen skeleton,
// the design system's PrimaryButton, the accent/error tones already in use.

const CONFIRM_WORD = 'حذف'

const CONSEQUENCES = [
  'ستُلغى حجوزاتك القادمة، وسيُخطر المركز بالإلغاء.',
  'سجلّ حجوزاتك السابقة لن يظهر لك بعد الآن.',
  'سيتحرر رقم هاتفك، ويمكنك التسجيل من جديد كحساب جديد.',
  'لا يمكن التراجع عن هذا الإجراء.',
]

export default function DeleteAccount() {
  const router = useRouter()
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Re-entry guard as a REF: a second tap before React re-renders reads stale
  // state and sails through (the §6a lesson, same shape as the desk's).
  const deletingRef = useRef(false)

  const canDelete = confirmText.trim() === CONFIRM_WORD

  const handleDelete = async () => {
    if (deletingRef.current || !canDelete) return
    deletingRef.current = true
    setIsDeleting(true)
    setErrorMessage(null)
    const result = await deleteAccount()
    if (result.kind === 'ok') {
      // The auth user is gone server-side; clear the LOCAL session only (a
      // server-scoped signOut would 403 against a deleted user). The root
      // guard sends us to the welcome screen once the session clears.
      await performPostDeletionCleanup()
      return
    }
    deletingRef.current = false
    setIsDeleting(false)
    setErrorMessage('تعذّر حذف الحساب — تحقق من الاتصال وحاول مرة أخرى.')
  }

  return (
    <SafeAreaView className="flex-1 bg-ih-neutral-0">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="px-6 pt-4">
          <Pressable
            testID="delete-account-back"
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            disabled={isDeleting}
            onPress={() => router.back()}
            className="h-11 w-11 items-center justify-center"
          >
            <Text className="text-lg text-ih-neutral-700">→</Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="px-6 pb-5 gap-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-2.5 pt-4">
            <Text className="font-arabic-bold text-2xl text-ih-neutral-800">حذف الحساب</Text>
            <Text className="font-arabic text-[15px] leading-6 text-ih-neutral-600">
              قبل أن تكمل، هذا ما سيحدث:
            </Text>
          </View>

          <View className="gap-3 rounded-ih-md border border-ih-neutral-200 bg-ih-neutral-50 p-4">
            {CONSEQUENCES.map((line) => (
              <View key={line} className="flex-row gap-2.5">
                <Text className="text-ih-neutral-500">•</Text>
                <Text className="flex-1 font-arabic text-[14px] leading-6 text-ih-neutral-700">
                  {line}
                </Text>
              </View>
            ))}
          </View>

          <View className="gap-2.5">
            <Text className="font-arabic-semibold text-[13px] text-ih-neutral-600">
              للتأكيد، اكتب «{CONFIRM_WORD}»
            </Text>
            <TextInput
              testID="delete-confirm-input"
              accessibilityLabel={`اكتب ${CONFIRM_WORD} للتأكيد`}
              value={confirmText}
              onChangeText={(text) => {
                setConfirmText(text)
                if (errorMessage !== null) setErrorMessage(null)
              }}
              editable={!isDeleting}
              placeholder={CONFIRM_WORD}
              placeholderTextColor={colors.neutral[400]}
              className="min-h-[52px] rounded-ih-sm px-4 font-arabic text-lg text-ih-neutral-800"
              style={{
                borderWidth: 1.5,
                borderColor: canDelete ? colors.semantic.error : colors.neutral[200],
                textAlign: 'right',
              }}
            />
            {errorMessage !== null ? (
              <Text testID="delete-account-error" className="font-arabic text-[13px] text-ih-error">
                {errorMessage}
              </Text>
            ) : null}
          </View>

          <View className="gap-3 pt-2">
            {/* The SAFE action is the primary button (PRODUCT §6); deleting is
                the quiet destructive one below it. */}
            <PrimaryButton
              testID="delete-account-keep"
              label="الاحتفاظ بالحساب"
              onPress={() => router.back()}
              disabled={isDeleting}
            />
            <Pressable
              testID="delete-account-confirm"
              accessibilityRole="button"
              accessibilityLabel="حذف حسابي نهائياً"
              accessibilityState={{ disabled: !canDelete || isDeleting }}
              disabled={!canDelete || isDeleting}
              onPress={() => void handleDelete()}
              className="min-h-[52px] items-center justify-center rounded-ih-sm border border-ih-error"
              style={!canDelete || isDeleting ? { opacity: 0.45 } : undefined}
            >
              <Text className="font-arabic-semibold text-base text-ih-error">
                {isDeleting ? 'جارٍ الحذف…' : 'حذف حسابي نهائياً'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
