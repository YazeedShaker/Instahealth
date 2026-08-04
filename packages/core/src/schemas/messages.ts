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
  'branchProfile.phone.invalid': {
    ar: 'أدخل رقم هاتف مصرياً صحيحاً — أرضي أو موبايل (مثال: 02-25787202)',
    en: 'Enter a valid Egyptian phone number — landline or mobile (e.g. 02-25787202)',
  },
  'branchProfile.whatsapp.invalid': {
    ar: 'أدخل رقم واتساب موبايل مصرياً صحيحاً (مثال: 01012345678)',
    en: 'Enter a valid Egyptian mobile WhatsApp number (e.g. 01012345678)',
  },
  'branchProfile.addressAr.required': {
    ar: 'أدخل عنوان الفرع بالعربية',
    en: 'Enter the branch address in Arabic',
  },
  'branchProfile.address.tooLong': {
    ar: 'العنوان طويل جداً (الحد الأقصى ٥٠٠ حرف)',
    en: 'Address is too long (max 500 characters)',
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
