import { getBookingStatusChip, type BookingStatusTone, type BranchBooking } from '@instahealth/core'

// The EXTENDED provider chip set from the handoff: pending_payment · confirmed ·
// arrived · completed · no_show · cancelled. Colours come from the shared tone
// vocabulary, so a state that exists on both surfaces looks the same on both
// (PRODUCT.md §3 — colour never carries meaning on its own, the label does).
const TONE_STYLES: Record<BookingStatusTone, { background: string; color: string }> = {
  success: { background: 'var(--ih-success-bg)', color: 'var(--ih-success-text)' },
  warning: { background: 'var(--ih-warning-bg)', color: 'var(--ih-warning-text)' },
  error: { background: 'var(--ih-error-bg)', color: 'var(--ih-error-text)' },
  neutral: { background: 'var(--ih-neutral-100)', color: 'var(--ih-neutral-700)' },
  info: { background: 'var(--ih-primary-50)', color: 'var(--ih-primary-700)' },
}

export function StatusChip({ booking }: { booking: BranchBooking }) {
  const chip = getBookingStatusChip(booking)
  return (
    <span
      data-testid={`status-chip-${booking.id}`}
      data-status={booking.status}
      className="inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold"
      style={TONE_STYLES[chip.tone]}
    >
      {chip.labelAr}
    </span>
  )
}
