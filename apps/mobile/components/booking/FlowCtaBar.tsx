import type { ReactNode } from 'react'
import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// Sticky CTA container for the booking flow. The tab bar is hidden here, so
// THIS bar must clear the home indicator itself (DECISION-navigation-safe-areas
// §2: every sticky bottom element sits inside the safe-area inset).
export function FlowCtaBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <View
      className="gap-2 border-t border-ih-neutral-200 bg-ih-neutral-0 px-5 pt-3.5"
      style={{
        paddingBottom: insets.bottom + 14,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 8,
      }}
    >
      {children}
    </View>
  )
}
