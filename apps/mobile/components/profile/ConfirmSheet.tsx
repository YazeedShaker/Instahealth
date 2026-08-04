import { Modal, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { PrimaryButton } from '../ui/PrimaryButton'

// Generic destructive-action confirmation — the CancelBookingSheet anatomy
// (PRODUCT §6: modals for destructive actions, clear back-out, the SAFE action
// is the primary button and the destructive one is the quiet one).
export function ConfirmSheet({
  visible,
  title,
  body,
  safeLabel,
  destructiveLabel,
  isBusy,
  onSafe,
  onDestructive,
  testId,
}: {
  visible: boolean
  title: string
  body: string
  safeLabel: string
  destructiveLabel: string
  isBusy: boolean
  onSafe: () => void
  onDestructive: () => void
  testId: string
}) {
  const insets = useSafeAreaInsets()
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={isBusy ? undefined : onSafe}
    >
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(2,20,27,0.45)' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="إغلاق"
          disabled={isBusy}
          onPress={onSafe}
          className="flex-1"
        />
        <View
          testID={testId}
          accessibilityViewIsModal
          accessibilityRole="alert"
          className="gap-4 rounded-t-[24px] bg-ih-neutral-0 px-6 pt-6"
          style={{ paddingBottom: insets.bottom + 24 }}
        >
          <View className="h-1 w-10 self-center rounded-ih-full bg-ih-neutral-200" />
          <View className="gap-2">
            <Text
              accessibilityRole="header"
              className="text-center font-arabic-bold text-lg text-ih-neutral-800"
            >
              {title}
            </Text>
            <Text className="text-center font-arabic text-sm leading-6 text-ih-neutral-600">
              {body}
            </Text>
          </View>
          <PrimaryButton testID={`${testId}-safe`} label={safeLabel} onPress={onSafe} />
          <Pressable
            testID={`${testId}-confirm`}
            accessibilityRole="button"
            accessibilityLabel={destructiveLabel}
            disabled={isBusy}
            onPress={onDestructive}
            className="min-h-[44px] items-center justify-center"
          >
            <Text className="font-arabic-semibold text-[15px] text-ih-error">
              {isBusy ? '…' : destructiveLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
