import {
  getBookingStatusChip,
  type BookingStatusTone,
  type PatientBooking,
} from '@instahealth/core'
import { colors } from '@instahealth/design-tokens'
import { Text } from 'react-native'

// The design-system StatusBadge: pill, colour AND label always together
// (PRODUCT.md §3 — a colourblind patient must tell مؤكد from ملغي without
// seeing green vs red, so the Arabic word is never decoration).

const TONE_COLORS: Record<BookingStatusTone, { bg: string; fg: string }> = {
  success: { bg: colors.semantic.successBg, fg: colors.semantic.successText },
  warning: { bg: colors.semantic.warningBg, fg: colors.semantic.warningText },
  error: { bg: colors.semantic.errorBg, fg: colors.semantic.errorText },
  neutral: { bg: colors.neutral[100], fg: colors.neutral[600] },
}

export function BookingStatusBadge({
  booking,
  testID,
}: {
  booking: PatientBooking
  testID?: string
}) {
  const { labelAr, tone } = getBookingStatusChip(booking)
  const { bg, fg } = TONE_COLORS[tone]
  return (
    <Text
      testID={testID}
      className="rounded-ih-full px-3 py-1 font-arabic-semibold text-[11.5px]"
      style={{ backgroundColor: bg, color: fg }}
    >
      {labelAr}
    </Text>
  )
}
