import { convertArabicDigits, OTP_LENGTH } from '@instahealth/core'
import { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { colors } from '@instahealth/design-tokens'

interface OtpInputProps {
  code: string
  onChangeCode: (code: string) => void
  hasError: boolean
  disabled?: boolean
}

// ONE invisible TextInput over six rendered digit boxes — the standard OTP
// pattern. Per-box TextInputs misrendered on iOS devices (default padding +
// forced-RTL shifted digits off center); a <Text> centered inside a <View>
// cannot. Bonus: single input means native paste + iOS SMS autofill
// (textContentType oneTimeCode) just work, and backspace needs no key
// juggling. Arabic-Indic digits normalized on input; the row is LTR.
export function OtpInput({ code, onChangeCode, hasError, disabled }: OtpInputProps) {
  const inputRef = useRef<TextInput | null>(null)
  const [isFocused, setIsFocused] = useState(false)

  const activeIndex = Math.min(code.length, OTP_LENGTH - 1)

  const handleChangeText = (rawText: string) => {
    onChangeCode(convertArabicDigits(rawText).replace(/\D/g, '').slice(0, OTP_LENGTH))
  }

  return (
    <Pressable
      testID="otp-field"
      accessibilityLabel="رمز التحقق"
      onPress={() => inputRef.current?.focus()}
    >
      <View className="flex-row justify-center gap-2.5" style={{ direction: 'ltr' }}>
        {Array.from({ length: OTP_LENGTH }, (_, index) => {
          const digit = code[index] ?? ''
          const isFilled = digit.length > 0
          const isActive = isFocused && index === activeIndex && disabled !== true
          const borderColor = hasError
            ? colors.semantic.error
            : isActive
              ? colors.primary[400]
              : isFilled
                ? colors.primary[500]
                : colors.neutral[200]
          const backgroundColor = hasError
            ? colors.semantic.errorBg
            : isFilled
              ? colors.primary[50]
              : colors.neutral[0]
          return (
            <View
              key={index}
              testID={`otp-box-${index}`}
              className="h-14 w-[46px] items-center justify-center rounded-ih-sm"
              style={{ borderWidth: isActive ? 2 : 1.5, borderColor, backgroundColor }}
            >
              {isFilled ? (
                <Text className="font-arabic-bold text-2xl text-ih-neutral-800">{digit}</Text>
              ) : isActive ? (
                <View
                  className="h-7 w-0.5 rounded-ih-full"
                  style={{ backgroundColor: colors.primary[400] }}
                />
              ) : null}
            </View>
          )
        })}
      </View>
      {/* The real input: covers the row, fully transparent (color transparent
          + hidden caret) but NOT opacity-0, so Maestro and screen readers can
          still target it. */}
      <TextInput
        ref={inputRef}
        testID="otp-input"
        accessibilityLabel="أدخل رمز التحقق"
        inputMode="numeric"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        editable={disabled !== true}
        caretHidden
        value={code}
        maxLength={OTP_LENGTH}
        onChangeText={handleChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={[StyleSheet.absoluteFillObject, { color: 'transparent', fontSize: 1 }]}
      />
    </Pressable>
  )
}
