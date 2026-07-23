// Resend-countdown gating — pure, `now` injected. The 60s interval comes from core.

import { OTP_RESEND_SECONDS } from '@instahealth/core'

const MILLISECONDS_PER_SECOND = 1000

export interface ResendState {
  canResend: boolean
  secondsRemaining: number
}

/** Resend is disabled until OTP_RESEND_SECONDS have passed since the last request. */
export function getResendState(lastRequestedAt: number | null, now: number): ResendState {
  if (lastRequestedAt === null) return { canResend: true, secondsRemaining: 0 }

  const elapsedMs = now - lastRequestedAt
  const remainingMs = OTP_RESEND_SECONDS * MILLISECONDS_PER_SECOND - elapsedMs
  if (remainingMs <= 0) return { canResend: true, secondsRemaining: 0 }

  return { canResend: false, secondsRemaining: Math.ceil(remainingMs / MILLISECONDS_PER_SECOND) }
}
