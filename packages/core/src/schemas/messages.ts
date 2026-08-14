// Bilingual validation messages — THE pattern for all schemas (documented choice):
// every Zod issue carries a stable MESSAGE KEY (e.g. 'phone.invalid') as its
// `message`, and this map resolves keys to Arabic/English copy. UIs call
// `getErrorMessage(issue.message, locale)`. One pattern, used everywhere.

export const errorMessages = {
  'phone.required': {
    ar: 'أدخل رقم الموبايل',
    en: 'Enter your mobile number',
  },
  'phone.invalid': {
    ar: 'أدخل رقم موبايل مصري صحيح (مثال: 01012345678)',
    en: 'Enter a valid Egyptian mobile number (e.g. 01012345678)',
  },
  'otp.invalid': {
    ar: 'أدخل رمز التحقق المكوَّن من ٦ أرقام',
    en: 'Enter the 6-digit verification code',
  },
  'booking.services.empty': {
    ar: 'اختر خدمة واحدة على الأقل',
    en: 'Select at least one service',
  },
  'booking.services.mixedBranch': {
    ar: 'كل الخدمات يجب أن تكون من نفس الفرع',
    en: 'All services must be from the same branch',
  },
  'booking.paymentMethod.invalid': {
    ar: 'اختر طريقة دفع صحيحة',
    en: 'Choose a valid payment method',
  },
  'review.rating.range': {
    ar: 'التقييم من ١ إلى ٥ نجوم',
    en: 'Rating must be between 1 and 5 stars',
  },
  'review.comment.tooLong': {
    ar: 'التعليق طويل جداً (الحد الأقصى ٥٠٠ حرف)',
    en: 'Comment is too long (max 500 characters)',
  },
  'payment.outcomeInvalid': {
    ar: 'نتيجة دفع غير صالحة',
    en: 'Invalid payment outcome',
  },
  'payment.bookingIdInvalid': {
    ar: 'معرّف الحجز غير صالح',
    en: 'Invalid booking identifier',
  },
  'payment.providerRefRequired': {
    ar: 'مرجع عملية الدفع مفقود',
    en: 'Payment reference is missing',
  },
  'payment.providerRefTooLong': {
    ar: 'مرجع عملية الدفع طويل جداً',
    en: 'Payment reference is too long',
  },
  'branchProfile.phone.required': {
    ar: 'أدخل رقم هاتف الفرع',
    en: 'Enter the branch phone number',
  },
  // Copy matches the Branch Details handoff: the fields render as +20 + the
  // NATIONAL part, so examples are national ("2 2735 4416"), not 0-leading.
  'branchProfile.phone.invalid': {
    ar: 'أدخل رقماً صحيحاً — أرضي أو خط ساخن (مثال: 2 2735 4416)',
    en: 'Enter a valid number — landline or hotline (e.g. 2 2735 4416)',
  },
  'branchProfile.whatsapp.invalid': {
    ar: 'أدخل رقم موبايل صحيحاً (مثال: 10 2244 8890)',
    en: 'Enter a valid mobile number (e.g. 10 2244 8890)',
  },
  'branchProfile.addressAr.required': {
    ar: 'أدخل عنوان الفرع بالعربية',
    en: 'Enter the branch address in Arabic',
  },
  'branchProfile.address.tooLong': {
    ar: 'العنوان طويل جداً (الحد الأقصى ٥٠٠ حرف)',
    en: 'Address is too long (max 500 characters)',
  },
  // Both are field-level copy: they render UNDER the input the user is typing
  // in, so they name the field's fault rather than the form's. «صيغة البريد غير
  // صحيحة» (the Edge Function's wording) reads as a verdict on a submitted
  // form; this reads as an instruction on a field.
  'email.required': {
    ar: 'أدخل البريد الإلكتروني',
    en: 'Enter the email address',
  },
  'email.invalid': {
    ar: 'أدخل بريداً إلكترونياً صحيحاً (مثال: reception@saridarlabs.com)',
    en: 'Enter a valid email address (e.g. reception@saridarlabs.com)',
  },
  'common.uuid.invalid': {
    ar: 'معرّف غير صالح',
    en: 'Invalid identifier',
  },
  'common.pagination.invalid': {
    ar: 'قيم الصفحات غير صالحة',
    en: 'Invalid pagination values',
  },
  'common.coordinates.invalid': {
    ar: 'إحداثيات غير صالحة',
    en: 'Invalid coordinates',
  },
} as const

export type ErrorMessageKey = keyof typeof errorMessages

export function getErrorMessage(key: string, locale: 'ar' | 'en'): string {
  const entry = errorMessages[key as ErrorMessageKey] as { ar: string; en: string } | undefined
  if (!entry) return key
  return entry[locale]
}
