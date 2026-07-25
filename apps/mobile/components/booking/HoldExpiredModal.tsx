import { Modal, Text, View } from 'react-native'

import { PrimaryButton } from '../ui/PrimaryButton'

interface HoldExpiredModalProps {
  visible: boolean
  onPickAgain: () => void
}

// Hold expiry while inside the flow — one calm action back to a refreshed
// slot picker. No dead ends, no blame (PRODUCT.md §8).
export function HoldExpiredModal({ visible, onPickAgain }: HoldExpiredModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onPickAgain}>
      <View className="flex-1 items-center justify-center bg-black/40 px-8">
        <View
          testID="hold-expired-modal"
          className="w-full items-center gap-3 rounded-ih-lg bg-ih-neutral-0 p-6"
        >
          <Text className="text-4xl">⏰</Text>
          <Text className="text-center font-arabic-bold text-lg text-ih-neutral-800">
            انتهت مدة حجز الموعد
          </Text>
          <Text className="text-center font-arabic text-sm leading-6 text-ih-neutral-600">
            لا تقلق — اختياراتك محفوظة. اختر موعداً جديداً وسنحجزه لك لمدة عشر دقائق أخرى.
          </Text>
          <View className="w-full pt-1">
            <PrimaryButton
              testID="hold-expired-pick-again"
              label="اختر موعداً آخر"
              onPress={onPickAgain}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}
