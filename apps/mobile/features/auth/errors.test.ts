import { describe, expect, test } from 'vitest'

import { AUTH_ERRORS_AR, mapAuthError } from './errors'

describe('mapAuthError', () => {
  test('network failures map to the connectivity message with retry', () => {
    expect(mapAuthError({ name: 'AuthRetryableFetchError', message: 'fetch failed' })).toEqual({
      messageAr: AUTH_ERRORS_AR.network,
      retryable: true,
    })
    expect(mapAuthError(new TypeError('Network request failed'))).toEqual({
      messageAr: AUTH_ERRORS_AR.network,
      retryable: true,
    })
  })

  test('wrong or expired OTP maps to the design error copy', () => {
    expect(mapAuthError({ code: 'otp_expired', status: 403 }).messageAr).toBe(
      AUTH_ERRORS_AR.otpInvalid,
    )
    expect(mapAuthError({ message: 'Token has expired or is invalid' }).messageAr).toBe(
      AUTH_ERRORS_AR.otpInvalid,
    )
  })

  test('rate limiting maps to the calm rate-limit message', () => {
    expect(mapAuthError({ code: 'over_sms_send_rate_limit' }).messageAr).toBe(
      AUTH_ERRORS_AR.rateLimited,
    )
    expect(mapAuthError({ status: 429 }).messageAr).toBe(AUTH_ERRORS_AR.rateLimited)
  })

  test('sms send failure is retryable', () => {
    expect(mapAuthError({ code: 'sms_send_failed' })).toEqual({
      messageAr: AUTH_ERRORS_AR.smsFailed,
      retryable: true,
    })
  })

  test('disabled provider maps to service unavailable', () => {
    expect(mapAuthError({ code: 'phone_provider_disabled' }).messageAr).toBe(
      AUTH_ERRORS_AR.serviceUnavailable,
    )
    expect(mapAuthError({ code: 'otp_disabled' }).messageAr).toBe(AUTH_ERRORS_AR.serviceUnavailable)
  })

  test('invalid phone maps to the inline phone error', () => {
    expect(mapAuthError({ code: 'validation_failed', message: 'Invalid phone' }).messageAr).toBe(
      AUTH_ERRORS_AR.invalidPhone,
    )
  })

  test('unknown errors fall back to the generic message — raw strings never surface', () => {
    const mapped = mapAuthError({ message: 'SOME_INTERNAL_SUPABASE_DETAIL xyz' })
    expect(mapped.messageAr).toBe(AUTH_ERRORS_AR.unknown)
    expect(mapped.messageAr).not.toContain('SUPABASE')
  })

  test('non-object garbage never throws', () => {
    expect(mapAuthError(undefined).messageAr).toBe(AUTH_ERRORS_AR.unknown)
    expect(mapAuthError('boom').messageAr).toBe(AUTH_ERRORS_AR.unknown)
    expect(mapAuthError(null).messageAr).toBe(AUTH_ERRORS_AR.unknown)
  })
})
