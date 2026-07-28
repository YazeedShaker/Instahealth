import type { PaymentMethodOption } from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { Pressable, Text, View } from 'react-native'

interface PaymentMethodRowProps {
  option: PaymentMethodOption
  selected: boolean
  /** Renders the design's failure state on the row the patient just tried. */
  failed: boolean
  disabled: boolean
  onSelect: () => void
}

const FAILED_HINT_AR = '✕ لم يكتمل الدفع — يمكنك المحاولة مرة أخرى'

// One payment-method row from the approved step-4 design: radio + icon +
// label/hint, teal when selected, red when the last attempt on it failed.
// 44px minimum height per PRODUCT.md §3 (touch targets).
export function PaymentMethodRow({
  option,
  selected,
  failed,
  disabled,
  onSelect,
}: PaymentMethodRowProps) {
  const borderColor = failed
    ? colors.semantic.error
    : selected
      ? colors.primary[400]
      : colors.neutral[200]
  const dotColor = failed ? colors.semantic.error : colors.primary[400]

  return (
    <Pressable
      testID={`payment-method-${option.method}`}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={option.labelAr}
      accessibilityHint={failed ? FAILED_HINT_AR : option.hintAr}
      disabled={disabled}
      onPress={onSelect}
      className="min-h-[44px] flex-row items-center gap-3 rounded-ih-md px-4 py-3.5"
      style={{
        backgroundColor: failed
          ? colors.semantic.errorBg
          : selected
            ? colors.primary[50]
            : colors.neutral[0],
        borderWidth: selected || failed ? 1.5 : 1,
        borderColor,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <View
        className="h-[22px] w-[22px] items-center justify-center rounded-ih-full"
        style={{
          borderWidth: 1.5,
          borderColor: selected || failed ? dotColor : colors.neutral[300],
        }}
      >
        {selected || failed ? (
          <View className="h-3 w-3 rounded-ih-full" style={{ backgroundColor: dotColor }} />
        ) : null}
      </View>
      <Text className="text-xl">{option.icon}</Text>
      <View className="flex-1 gap-px">
        <Text className="font-arabic-bold text-[15px] text-ih-neutral-800">{option.labelAr}</Text>
        <Text
          className="font-arabic text-xs"
          style={{ color: failed ? colors.semantic.errorText : colors.neutral[500] }}
        >
          {failed ? FAILED_HINT_AR : option.hintAr}
        </Text>
      </View>
    </Pressable>
  )
}
