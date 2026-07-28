// Supabase auth errors → calm Arabic. Same discipline as F01's mobile mapping:
// the patient (here, the receptionist) never sees a raw provider string, and
// every message offers the next action rather than blaming them (PRODUCT.md §8).

export type LoginErrorKey =
  'invalidCredentials' | 'notProvider' | 'rateLimited' | 'unconfirmed' | 'network' | 'unknown'

const MESSAGES_AR: Record<LoginErrorKey, string> = {
  invalidCredentials:
    'البريد الإلكتروني أو كلمة المرور غير صحيحة. تأكد من البيانات أو تواصل مع فريق InstaHealth للمساعدة.',
  // Deliberately does NOT say "you are a patient" — it says what to do.
  notProvider:
    'هذا الحساب غير مسجَّل كحساب شريك. استخدم حساب الفرع، أو تواصل مع فريق InstaHealth لتفعيل حسابك.',
  rateLimited: 'محاولات كثيرة خلال وقت قصير. انتظر دقيقة ثم حاول مرة أخرى.',
  unconfirmed: 'لم يتم تفعيل هذا الحساب بعد. تواصل مع فريق InstaHealth لتفعيله.',
  network: 'تعذّر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى.',
  unknown: 'تعذّر تسجيل الدخول. حاول مرة أخرى أو تواصل مع دعم الشركاء.',
}

/** Maps a Supabase auth error onto our key set. Matching is on the stable
 * `code` where Supabase provides one, falling back to message text. */
export function toLoginErrorKey(error: { code?: string; message?: string } | null): LoginErrorKey {
  if (error === null) return 'unknown'
  const code = error.code ?? ''
  const message = (error.message ?? '').toLowerCase()

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'invalidCredentials'
  }
  if (code === 'over_request_rate_limit' || message.includes('rate limit')) return 'rateLimited'
  if (code === 'email_not_confirmed' || message.includes('not confirmed')) return 'unconfirmed'
  if (message.includes('fetch') || message.includes('network')) return 'network'
  return 'unknown'
}

export function getLoginErrorMessageAr(key: LoginErrorKey): string {
  return MESSAGES_AR[key]
}
