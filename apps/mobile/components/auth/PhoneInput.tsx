import { convertArabicDigits } from '@instahealth/core'
import { Text, TextInput, View } from 'react-native'

import { colors } from '@instahealth/design-tokens'

const MAX_LOCAL_DIGITS = 11 // with the leading 0 (01012345678); 10 without

/** Groups digits for display: `010 1234 5678` / `10 1234 5678`. */
export function formatPhoneDigits(digits: string): string {
  const headLength = digits.startsWith('0') ? 3 : 2
  const parts = [
    digits.slice(0, headLength),
    digits.slice(headLength, headLength + 4),
    digits.slice(headLength + 4, headLength + 8),
  ].filter((part) => part.length > 0)
  return parts.join(' ')
}

interface PhoneInputProps {
  digits: string
  onChangeDigits: (digits: string) => void
  hasError: boolean
  testID?: string
}

// Phone field from the approved mockup: 🇪🇬 +20 prefix chip + LTR numeric input.
// Accepts Arabic-Indic and Western numerals; only digits are kept.
export function PhoneInput({ digits, onChangeDigits, hasError, testID }: PhoneInputProps) {
  const borderColor = hasError
    ? colors.semantic.error
    : digits.length > 0
      ? colors.primary[400]
      : colors.neutral[200]

  return (
    <View className="flex-row gap-2.5" style={{ direction: 'ltr' }}>
      <View className="min-h-[52px] flex-row items-center gap-1.5 rounded-ih-sm border-[1.5px] border-ih-neutral-200 bg-ih-neutral-50 px-3.5">
        <Text className="text-base">🇪🇬</Text>
        <Text className="font-english text-base font-semibold text-ih-neutral-700">+20</Text>
      </View>
      <TextInput
        testID={testID ?? 'phone-input'}
        accessibilityLabel="رقم الهاتف"
        inputMode="numeric"
        keyboardType="number-pad"
        placeholder="10 1234 5678"
        placeholderTextColor={colors.neutral[400]}
        value={formatPhoneDigits(digits)}
        onChangeText={(text) => {
          const nextDigits = convertArabicDigits(text).replace(/\D/g, '').slice(0, MAX_LOCAL_DIGITS)
          onChangeDigits(nextDigits)
        }}
        className="min-h-[52px] flex-1 rounded-ih-sm px-4 font-arabic text-lg text-ih-neutral-800"
        style={{ borderWidth: 1.5, borderColor, textAlign: 'left', letterSpacing: 0.7 }}
      />
    </View>
  )
}
