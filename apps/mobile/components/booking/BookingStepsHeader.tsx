import { Text, View } from 'react-native'

export const BOOKING_STEP_LABELS = ['الخدمات', 'الموعد', 'المراجعة', 'الدفع'] as const

interface BookingStepsHeaderProps {
  /** 0-based index of the CURRENT step. Everything before it renders as done. */
  currentStep: number
}

// The 4-step progress header from the approved booking design. Step 1
// (الخدمات) happened on the branch profile, so inside the flow it always
// shows as completed (✓).
export function BookingStepsHeader({ currentStep }: BookingStepsHeaderProps) {
  return (
    <View className="flex-row items-start px-1" accessibilityLabel="خطوات الحجز">
      {BOOKING_STEP_LABELS.map((label, index) => {
        const isDone = index < currentStep
        const isCurrent = index === currentStep
        return (
          <View key={label} className="flex-1 flex-row items-start">
            {index > 0 ? (
              <View
                className={`mt-3.5 h-0.5 flex-1 ${isDone || isCurrent ? 'bg-ih-primary-400' : 'bg-ih-neutral-200'}`}
              />
            ) : null}
            <View className="items-center gap-1" style={{ minWidth: 56 }}>
              <View
                className={`h-7 w-7 items-center justify-center rounded-ih-full ${
                  isDone
                    ? 'bg-ih-primary-400'
                    : isCurrent
                      ? 'border-2 border-ih-primary-400 bg-ih-primary-50'
                      : 'border border-ih-neutral-300 bg-ih-neutral-0'
                }`}
              >
                <Text
                  className={`text-xs ${
                    isDone
                      ? 'text-white'
                      : isCurrent
                        ? 'font-arabic-bold text-ih-primary-700'
                        : 'font-arabic-semibold text-ih-neutral-500'
                  }`}
                >
                  {isDone ? '✓' : ['١', '٢', '٣', '٤'][index]}
                </Text>
              </View>
              <Text
                className={`text-[11px] ${
                  isCurrent
                    ? 'font-arabic-bold text-ih-primary-700'
                    : isDone
                      ? 'font-arabic-semibold text-ih-neutral-700'
                      : 'font-arabic text-ih-neutral-500'
                }`}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}
