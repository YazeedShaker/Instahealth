// Every Supabase auth error path maps to a human Arabic message here.
// Raw error strings NEVER render on screen. Pure module — unit tested.

export interface MappedAuthError {
  messageAr: string
  retryable: boolean
}

export const AUTH_ERRORS_AR = {
  network: 'تعذر الاتصال بالإنترنت — تحقق من الشبكة وحاول مرة أخرى',
  invalidPhone: 'رقم غير صحيح',
  otpInvalid: 'الرمز غير صحيح — تأكد من الرقم وحاول مرة أخرى',
  otpExpired: 'انتهت صلاحية الرمز — اطلب رمزاً جديداً',
  rateLimited: 'طلبات كثيرة — حاول مرة أخرى بعد قليل',
  smsFailed: 'تعذر إرسال الرسالة — حاول مرة أخرى',
  serviceUnavailable: 'الخدمة غير متاحة حالياً — حاول لاحقاً',
  locked: 'محاولات كثيرة — حاول مرة أخرى بعد ٥ دقائق',
  unknown: 'حدث خطأ — حاول مرة أخرى',
} as const

interface AuthErrorLike {
  name?: string
  code?: string
  status?: number
  message?: string
}

function asAuthErrorLike(error: unknown): AuthErrorLike {
  if (typeof error !== 'object' || error === null) return {}
  const candidate = error as Record<string, unknown>
  return {
    name: typeof candidate.name === 'string' ? candidate.name : undefined,
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    status: typeof candidate.status === 'number' ? candidate.status : undefined,
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
  }
}

/** Maps any Supabase auth failure (or network failure) to Arabic UI copy. */
export function mapAuthError(error: unknown): MappedAuthError {
  const { name, code, status, message } = asAuthErrorLike(error)
  const lowerMessage = (message ?? '').toLowerCase()

  const isNetworkFailure =
    name === 'AuthRetryableFetchError' ||
    lowerMessage.includes('network request failed') ||
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('fetch failed')
  if (isNetworkFailure) return { messageAr: AUTH_ERRORS_AR.network, retryable: true }

  if (code === 'otp_expired' || lowerMessage.includes('token has expired or is invalid')) {
    // Supabase reports wrong AND expired codes through this path — the design copy covers both.
    return { messageAr: AUTH_ERRORS_AR.otpInvalid, retryable: false }
  }

  if (code === 'over_sms_send_rate_limit' || code === 'over_request_rate_limit' || status === 429) {
    return { messageAr: AUTH_ERRORS_AR.rateLimited, retryable: false }
  }

  if (code === 'sms_send_failed') return { messageAr: AUTH_ERRORS_AR.smsFailed, retryable: true }

  if (code === 'phone_provider_disabled' || code === 'otp_disabled') {
    return { messageAr: AUTH_ERRORS_AR.serviceUnavailable, retryable: false }
  }

  if (code === 'validation_failed' || lowerMessage.includes('invalid phone')) {
    return { messageAr: AUTH_ERRORS_AR.invalidPhone, retryable: false }
  }

  return { messageAr: AUTH_ERRORS_AR.unknown, retryable: true }
}

/** Dev-only raw error logging — never logs in production builds, never logs PII. */
export function logAuthErrorDev(context: string, error: unknown): void {
  const devFlag = (globalThis as { __DEV__?: boolean }).__DEV__
  if (devFlag === true) {
    console.warn(`[auth:${context}]`, error)
  }
}
