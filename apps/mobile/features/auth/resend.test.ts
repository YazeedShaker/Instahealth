import { OTP_RESEND_SECONDS } from '@instahealth/core'
import { describe, expect, test } from 'vitest'

import { getResendState } from './resend'

const NOW = 1_700_000_000_000

describe('getResendState', () => {
  test('no previous request → resend allowed immediately', () => {
    expect(getResendState(null, NOW)).toEqual({ canResend: true, secondsRemaining: 0 })
  })

  test('just requested → full countdown, resend disabled', () => {
    expect(getResendState(NOW, NOW)).toEqual({
      canResend: false,
      secondsRemaining: OTP_RESEND_SECONDS,
    })
  })

  test('mid-countdown → correct remaining seconds', () => {
    const result = getResendState(NOW - 25_000, NOW)
    expect(result.canResend).toBe(false)
    expect(result.secondsRemaining).toBe(OTP_RESEND_SECONDS - 25)
  })

  test('unlocks exactly when the interval elapses', () => {
    const boundary = NOW - OTP_RESEND_SECONDS * 1000
    expect(getResendState(boundary + 1000, NOW).canResend).toBe(false)
    expect(getResendState(boundary, NOW)).toEqual({ canResend: true, secondsRemaining: 0 })
  })
})
