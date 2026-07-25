import { formatHoldCountdown, getHoldChipState } from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { Text, View } from 'react-native'

interface HoldChipProps {
  remainingSeconds: number
}

// The flow-wide hold countdown from the approved design: calm (teal tint,
// "خذ وقتك بهدوء") → amber under two minutes. Expiry itself is handled by the
// layout's modal — this chip only renders the two live states.
export function HoldChip({ remainingSeconds }: HoldChipProps) {
  const state = getHoldChipState(remainingSeconds)
  if (state === 'expired') return null
  const isWarning = state === 'warning'
  const countdown = formatHoldCountdown(remainingSeconds)

  return (
    <View
      testID="hold-chip"
      accessibilityLiveRegion="polite"
      className="flex-row items-center gap-2.5 rounded-ih-md px-4 py-3"
      style={{
        backgroundColor: isWarning ? colors.semantic.warningBg : colors.primary[50],
        borderWidth: 1,
        borderColor: isWarning ? colors.semantic.warningBorder : colors.primary[100],
      }}
    >
      <Text className="text-base">🕐</Text>
      {isWarning ? (
        <Text
          testID="hold-chip-warning"
          className="flex-1 font-arabic text-[13.5px] leading-6"
          style={{ color: colors.semantic.warningText }}
        >
          <Text className="font-arabic-bold">بقي أقل من دقيقتين على انتهاء الحجز</Text> —{' '}
          <Text className="font-arabic-bold">{countdown}</Text>
        </Text>
      ) : (
        <Text
          className="flex-1 font-arabic text-[13.5px] leading-6"
          style={{ color: colors.primary[800] }}
        >
          موعدك محجوز لك لمدة <Text className="font-arabic-bold">{countdown}</Text> دقيقة — خذ وقتك
          بهدوء
        </Text>
      )}
    </View>
  )
}
