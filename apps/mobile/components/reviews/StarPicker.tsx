import { starLabelAr } from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { Pressable, Text, View } from 'react-native'

// The prompt's five star tiles, per frame B.
//
// ⚠ THE TILES ARE 44×44 BECAUSE THAT IS THE TAP FLOOR, and the frame draws them
// at exactly that size — the design and the accessibility minimum agree here,
// which is why neither is a compromise.
//
// ⚠ THE LABEL IS ABSENT UNTIL A PICK, not «صفر نجوم». `starLabelAr` returns
// null for no selection, so there is no rung of the ladder that means "unrated".

const STARS = [1, 2, 3, 4, 5] as const

export function StarPicker({
  value,
  onChange,
}: {
  value: number | null
  onChange: (rating: number) => void
}) {
  const label = starLabelAr(value)

  return (
    <View className="items-center gap-3">
      {/* Laid out right-to-left with the container's direction, so star ١ sits
          on the right where an Arabic reader starts. */}
      <View className="flex-row items-center justify-center gap-2.5">
        {STARS.map((star) => {
          const isOn = value !== null && star <= value
          return (
            <Pressable
              key={star}
              testID={`star-${star}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: value === star }}
              accessibilityLabel={starLabelAr(star) ?? String(star)}
              onPress={() => onChange(star)}
              className="h-11 w-11 items-center justify-center rounded-[10px] border-[1.5px]"
              style={{
                borderColor: isOn ? colors.semantic.warning : colors.neutral[200],
                backgroundColor: isOn ? colors.semantic.warningBg : colors.neutral[0],
              }}
            >
              <Text
                className="text-[20px]"
                style={{ color: isOn ? colors.semantic.warning : colors.neutral[300] }}
              >
                ★
              </Text>
            </Pressable>
          )
        })}
      </View>

      {label !== null ? (
        <Text testID="star-label" className="font-arabic-bold text-[13px] text-ih-neutral-700">
          {label}
        </Text>
      ) : null}
    </View>
  )
}
