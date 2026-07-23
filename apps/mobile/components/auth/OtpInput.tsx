import { convertArabicDigits, OTP_LENGTH } from '@instahealth/core'
import { useRef } from 'react'
import { TextInput, View } from 'react-native'

import { colors } from '@instahealth/design-tokens'

interface OtpInputProps {
  code: string
  onChangeCode: (code: string) => void
  hasError: boolean
  disabled?: boolean
}

// 6 boxes, auto-advance, backspace-to-previous, paste support (a multi-digit
// change is distributed across boxes). Arabic-Indic digits normalized on input.
// The row is LTR — codes read left-to-right even in an RTL app.
export function OtpInput({ code, onChangeCode, hasError, disabled }: OtpInputProps) {
  const inputRefs = useRef<(TextInput | null)[]>([])

  const handleChange = (index: number, rawText: string) => {
    const digits = convertArabicDigits(rawText).replace(/\D/g, '')
    if (digits.length === 0) {
      onChangeCode(code.slice(0, index))
      return
    }
    const nextCode = (code.slice(0, index) + digits).slice(0, OTP_LENGTH)
    onChangeCode(nextCode)
    const nextIndex = Math.min(nextCode.length, OTP_LENGTH - 1)
    inputRefs.current[nextIndex]?.focus()
  }

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && code.length <= index && index > 0) {
      inputRefs.current[index - 1]?.focus()
      onChangeCode(code.slice(0, index - 1))
    }
  }

  return (
    <View className="flex-row justify-center gap-2.5" style={{ direction: 'ltr' }}>
      {Array.from({ length: OTP_LENGTH }, (_, index) => {
        const digit = code[index] ?? ''
        const isFilled = digit.length > 0
        const borderColor = hasError
          ? colors.semantic.error
          : isFilled
            ? colors.primary[500]
            : colors.neutral[200]
        const backgroundColor = hasError
          ? colors.semantic.errorBg
          : isFilled
            ? colors.primary[50]
            : colors.neutral[0]
        return (
          <TextInput
            key={index}
            ref={(ref) => {
              inputRefs.current[index] = ref
            }}
            testID={`otp-box-${index}`}
            inputMode="numeric"
            keyboardType="number-pad"
            editable={disabled !== true}
            value={digit}
            onChangeText={(text) => handleChange(index, text)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
            className="h-14 w-[46px] rounded-ih-sm text-center font-arabic-bold text-2xl text-ih-neutral-800"
            style={{ borderWidth: 1.5, borderColor, backgroundColor }}
          />
        )
      })}
    </View>
  )
}
