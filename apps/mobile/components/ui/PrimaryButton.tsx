import { ActivityIndicator, Pressable, Text } from 'react-native'

interface PrimaryButtonProps {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  testID?: string
}

// Design-system primary button: teal fill, lg (52px), full width.
// Loading shows a spinner and disables; disabled is 45% opacity (PRODUCT.md §6).
export function PrimaryButton({ label, onPress, disabled, loading, testID }: PrimaryButtonProps) {
  const isDisabled = disabled === true || loading === true
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={isDisabled}
      onPress={onPress}
      className="h-[52px] w-full items-center justify-center rounded-ih-sm bg-ih-primary-400"
      style={isDisabled ? { opacity: 0.45 } : undefined}
    >
      {loading === true ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text className="font-arabic-semibold text-base text-white">{label}</Text>
      )}
    </Pressable>
  )
}
