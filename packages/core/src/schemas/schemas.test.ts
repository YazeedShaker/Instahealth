import { describe, expect, test } from 'vitest'

import { otpRequestSchema, otpVerifySchema } from './auth.schema'
import { confirmBookingSchema, serviceSelectionSchema, slotChoiceSchema } from './booking.schema'
import { branchProfileSchema } from './branchProfile.schema'
import { coordinatesSchema, paginationSchema, uuidSchema } from './common.schema'
import { emailFieldErrorKey, emailSchema, isBlankEmail, isValidEmail } from './email.schema'
import { errorMessages, getErrorMessage } from './messages'
import { settlePaymentRequestSchema } from './payment.schema'
import { phoneSchema } from './phone.schema'
import { reviewSchema } from './review.schema'

const BRANCH_ID = '3f3f3f3f-1111-4222-8333-444444444444'
const OTHER_BRANCH_ID = '5a5a5a5a-1111-4222-8333-444444444444'
const SERVICE_ID = '7b7b7b7b-1111-4222-8333-444444444444'

function firstMessage(result: {
  success: boolean
  error?: { issues: Array<{ message: string }> }
}): string {
  if (result.success || !result.error) throw new Error('expected a failed parse')
  return result.error.issues[0]?.message ?? ''
}

describe('phoneSchema', () => {
  test('valid input passes and transforms to E.164', () => {
    expect(phoneSchema.parse('010 1234 5678')).toBe('+201012345678')
    expect(phoneSchema.parse('٠١٠١٢٣٤٥٦٧٨')).toBe('+201012345678')
  })

  test('invalid phone yields the phone.invalid key', () => {
    expect(firstMessage(phoneSchema.safeParse('01312345678'))).toBe('phone.invalid')
  })

  test('empty phone yields the phone.required key', () => {
    expect(firstMessage(phoneSchema.safeParse(''))).toBe('phone.required')
  })
})

describe('auth schemas', () => {
  test('otp request normalizes the phone', () => {
    expect(otpRequestSchema.parse({ phone: '01012345678' })).toEqual({ phone: '+201012345678' })
  })

  test('otp verify transforms Arabic-Indic code digits to western', () => {
    const parsed = otpVerifySchema.parse({ phone: '01012345678', code: '١٢٣٤٥٦' })
    expect(parsed.code).toBe('123456')
  })

  test('wrong-length or non-numeric code yields otp.invalid', () => {
    expect(firstMessage(otpVerifySchema.safeParse({ phone: '01012345678', code: '12345' }))).toBe(
      'otp.invalid',
    )
    expect(firstMessage(otpVerifySchema.safeParse({ phone: '01012345678', code: 'abcdef' }))).toBe(
      'otp.invalid',
    )
  })
})

describe('booking schemas', () => {
  test('valid selection passes', () => {
    const parsed = serviceSelectionSchema.parse({
      branchId: BRANCH_ID,
      services: [{ branchServiceId: SERVICE_ID, branchId: BRANCH_ID }],
    })
    expect(parsed.services).toHaveLength(1)
  })

  test('empty selection yields booking.services.empty', () => {
    expect(
      firstMessage(serviceSelectionSchema.safeParse({ branchId: BRANCH_ID, services: [] })),
    ).toBe('booking.services.empty')
  })

  test('services from another branch yield booking.services.mixedBranch', () => {
    const result = serviceSelectionSchema.safeParse({
      branchId: BRANCH_ID,
      services: [
        { branchServiceId: SERVICE_ID, branchId: BRANCH_ID },
        { branchServiceId: SERVICE_ID, branchId: OTHER_BRANCH_ID },
      ],
    })
    expect(firstMessage(result)).toBe('booking.services.mixedBranch')
  })

  test('slot choice — the whole hold payload — validates its uuid', () => {
    expect(slotChoiceSchema.parse({ slotId: BRANCH_ID }).slotId).toBe(BRANCH_ID)
    expect(firstMessage(slotChoiceSchema.safeParse({ slotId: 'nope' }))).toBe('common.uuid.invalid')
  })

  test('the hold payload carries NO user id — the server derives the holder', () => {
    // Migration 20260801005955 dropped `p_user_id` from create_slot_hold. If a
    // userId ever reappears in this schema, an identity the client controls has
    // crept back into a hold — the exact shape ENGINEERING-WORKFLOW §5 forbids.
    expect(Object.keys(slotChoiceSchema.shape)).toEqual(['slotId'])
  })

  test('confirm booking accepts valid method, rejects unknown method', () => {
    const parsed = confirmBookingSchema.parse({ bookingId: BRANCH_ID, paymentMethod: 'cash' })
    expect(parsed.paymentMethod).toBe('cash')
    expect(
      firstMessage(
        confirmBookingSchema.safeParse({ bookingId: BRANCH_ID, paymentMethod: 'bitcoin' }),
      ),
    ).toBe('booking.paymentMethod.invalid')
  })
})

describe('reviewSchema', () => {
  test('valid review passes; comment is optional', () => {
    expect(reviewSchema.parse({ bookingId: BRANCH_ID, rating: 5 }).rating).toBe(5)
  })

  test('out-of-range or fractional rating yields review.rating.range', () => {
    expect(firstMessage(reviewSchema.safeParse({ bookingId: BRANCH_ID, rating: 0 }))).toBe(
      'review.rating.range',
    )
    expect(firstMessage(reviewSchema.safeParse({ bookingId: BRANCH_ID, rating: 6 }))).toBe(
      'review.rating.range',
    )
    expect(firstMessage(reviewSchema.safeParse({ bookingId: BRANCH_ID, rating: 4.5 }))).toBe(
      'review.rating.range',
    )
  })

  test('over-long comment yields review.comment.tooLong', () => {
    const result = reviewSchema.safeParse({
      bookingId: BRANCH_ID,
      rating: 4,
      comment: 'س'.repeat(501),
    })
    expect(firstMessage(result)).toBe('review.comment.tooLong')
  })
})

describe('common schemas', () => {
  test('uuid schema accepts uuids and rejects with common.uuid.invalid', () => {
    expect(uuidSchema.parse(BRANCH_ID)).toBe(BRANCH_ID)
    expect(firstMessage(uuidSchema.safeParse('123'))).toBe('common.uuid.invalid')
  })

  test('pagination applies defaults and caps the limit', () => {
    expect(paginationSchema.parse({})).toEqual({ limit: 20, offset: 0 })
    expect(firstMessage(paginationSchema.safeParse({ limit: 51 }))).toBe(
      'common.pagination.invalid',
    )
    expect(firstMessage(paginationSchema.safeParse({ offset: -1 }))).toBe(
      'common.pagination.invalid',
    )
  })

  test('coordinates bounds are enforced', () => {
    expect(coordinatesSchema.parse({ lat: 30.04, lng: 31.24 })).toEqual({ lat: 30.04, lng: 31.24 })
    expect(firstMessage(coordinatesSchema.safeParse({ lat: 91, lng: 0 }))).toBe(
      'common.coordinates.invalid',
    )
    expect(firstMessage(coordinatesSchema.safeParse({ lat: 0, lng: -181 }))).toBe(
      'common.coordinates.invalid',
    )
  })
})

describe('bilingual messages', () => {
  test('every message key resolves in both locales', () => {
    for (const key of Object.keys(errorMessages)) {
      expect(getErrorMessage(key, 'ar').length).toBeGreaterThan(0)
      expect(getErrorMessage(key, 'en').length).toBeGreaterThan(0)
    }
  })

  test('unknown keys fall back to the key itself', () => {
    expect(getErrorMessage('nope.missing', 'en')).toBe('nope.missing')
  })
})

describe('emailSchema', () => {
  test('a real partner address parses and normalizes', () => {
    expect(emailSchema.parse('reception@saridarlabs.com')).toBe('reception@saridarlabs.com')
    expect(emailSchema.parse('  Reception@SaridarLabs.com  ')).toBe('reception@saridarlabs.com')
  })

  test('blank yields email.required, malformed yields email.invalid', () => {
    expect(firstMessage(emailSchema.safeParse(''))).toBe('email.required')
    expect(firstMessage(emailSchema.safeParse('   '))).toBe('email.required')
    expect(firstMessage(emailSchema.safeParse('no-at-sign'))).toBe('email.invalid')
  })

  // ⚠ THE REGRESSION THAT MATTERS. Each of these was ACCEPTED by the
  // `includes('@')` predicate that guarded the login form and the staff
  // dialog, and REFUSED by the server action behind them — so the desk got a
  // disabled-then-generic-failure with no reason attached. The list is the
  // measured divergence, not a guess at one.
  test.each([
    'a@b',
    'a@b.c',
    '@saridarlabs.com',
    'reception@',
    'reception@@saridarlabs.com',
    'reception saridar@labs.com',
    'reception@saridarlabs',
    'a@.com',
    'a@b..com',
  ])('rejects %j, which includes("@") accepted', (input) => {
    expect(input.includes('@')).toBe(true) // the old predicate said yes…
    expect(isValidEmail(input)).toBe(false) // …and the rule says no.
  })

  test.each(['reception@saridarlabs.com', 'a@b.co', 'reception@sub.saridarlabs.com'])(
    'accepts %j',
    (input) => {
      expect(isValidEmail(input)).toBe(true)
    },
  )

  test('isValidEmail is total over null and undefined', () => {
    expect(isValidEmail(null)).toBe(false)
    expect(isValidEmail(undefined)).toBe(false)
  })

  test('isBlankEmail separates "not yet answered" from "wrong"', () => {
    expect(isBlankEmail('')).toBe(true)
    expect(isBlankEmail('   ')).toBe(true)
    expect(isBlankEmail(null)).toBe(true)
    expect(isBlankEmail(undefined)).toBe(true)
    expect(isBlankEmail('a@b.co')).toBe(false)
  })
})

describe('emailFieldErrorKey', () => {
  test('an untouched empty field is silent, a touched one asks', () => {
    expect(emailFieldErrorKey('', false)).toBeNull()
    expect(emailFieldErrorKey('   ', false)).toBeNull()
    expect(emailFieldErrorKey('', true)).toBe('email.required')
  })

  // An address is malformed at every keystroke on the way to being valid.
  test.each(['r', 're', 'reception@', 'reception@saridarlabs'])(
    'stays silent on %j while the field is untouched',
    (partial) => {
      expect(emailFieldErrorKey(partial, false)).toBeNull()
      expect(emailFieldErrorKey(partial, true)).toBe('email.invalid')
    },
  )

  test('the submit predicate refuses an untouched empty field that shows no message', () => {
    expect(emailFieldErrorKey('', false)).toBeNull() // nothing rendered…
    expect(emailFieldErrorKey('', true)).toBe('email.required') // …but not submittable.
  })

  test('valid is silent', () => {
    expect(emailFieldErrorKey('reception@saridarlabs.com', true)).toBeNull()
  })

  test('both keys resolve to Arabic copy', () => {
    expect(getErrorMessage('email.required', 'ar')).toBe('أدخل البريد الإلكتروني')
    expect(getErrorMessage('email.invalid', 'ar')).toContain('بريداً إلكترونياً صحيحاً')
  })
})

describe('settlePaymentRequestSchema', () => {
  const valid = {
    bookingId: BRANCH_ID,
    method: 'card',
    providerRef: 'MOCK-3F8B1C2D-1',
    outcome: 'success',
  }

  test('accepts a well-formed settlement request and defaults the payload to null', () => {
    const parsed = settlePaymentRequestSchema.parse(valid)
    expect(parsed).toEqual({ ...valid, providerPayload: null })
  })

  test('keeps a provider payload when one is supplied', () => {
    const parsed = settlePaymentRequestSchema.parse({
      ...valid,
      providerPayload: { tran_ref: 'TST123', response_status: 'A' },
    })
    expect(parsed.providerPayload).toEqual({ tran_ref: 'TST123', response_status: 'A' })
  })

  test('rejects a non-uuid booking id', () => {
    expect(firstMessage(settlePaymentRequestSchema.safeParse({ ...valid, bookingId: 'abc' }))).toBe(
      'payment.bookingIdInvalid',
    )
  })

  test('rejects a method the DB constraint would refuse', () => {
    expect(
      firstMessage(settlePaymentRequestSchema.safeParse({ ...valid, method: 'bitcoin' })),
    ).toBe('booking.paymentMethod.invalid')
  })

  test('rejects an unknown outcome', () => {
    expect(firstMessage(settlePaymentRequestSchema.safeParse({ ...valid, outcome: 'maybe' }))).toBe(
      'payment.outcomeInvalid',
    )
  })

  test('requires a provider reference', () => {
    expect(firstMessage(settlePaymentRequestSchema.safeParse({ ...valid, providerRef: '' }))).toBe(
      'payment.providerRefRequired',
    )
  })

  test('rejects an over-long provider reference', () => {
    expect(
      firstMessage(
        settlePaymentRequestSchema.safeParse({ ...valid, providerRef: 'x'.repeat(256) }),
      ),
    ).toBe('payment.providerRefTooLong')
  })
})

describe('branchProfileSchema', () => {
  const valid = {
    phone: '02-25787202',
    whatsapp: '+20 101 234 5678',
    addressAr: '  ١٢ شارع التسعين، التجمع الخامس ',
    addressEn: '',
  }

  test('valid input normalizes: phone kept as typed, whatsapp folded to local, empties to null', () => {
    expect(branchProfileSchema.parse(valid)).toEqual({
      phone: '02-25787202',
      whatsapp: '01012345678',
      addressAr: '١٢ شارع التسعين، التجمع الخامس',
      addressEn: null,
    })
  })

  test('whatsapp and addressEn may be omitted entirely', () => {
    expect(branchProfileSchema.parse({ phone: '01012345678', addressAr: 'العنوان' })).toEqual({
      phone: '01012345678',
      whatsapp: null,
      addressAr: 'العنوان',
      addressEn: null,
    })
  })

  test('a present English address is kept, trimmed', () => {
    expect(
      branchProfileSchema.parse({ ...valid, addressEn: '  12 90th St, Fifth Settlement ' })
        .addressEn,
    ).toBe('12 90th St, Fifth Settlement')
  })

  test('an invalid phone yields branchProfile.phone.invalid', () => {
    // '12345' would PASS — five digits starting with 1 is a hotline (15276 is
    // Town's real number). Eight 1-leading digits fit neither rule.
    expect(firstMessage(branchProfileSchema.safeParse({ ...valid, phone: '12345678' }))).toBe(
      'branchProfile.phone.invalid',
    )
  })

  test('a short-code hotline is a valid branch phone', () => {
    expect(branchProfileSchema.parse({ ...valid, phone: '15276' }).phone).toBe('15276')
  })

  test('an empty phone yields branchProfile.phone.required', () => {
    expect(firstMessage(branchProfileSchema.safeParse({ ...valid, phone: '' }))).toBe(
      'branchProfile.phone.required',
    )
  })

  test('a landline whatsapp yields branchProfile.whatsapp.invalid', () => {
    expect(firstMessage(branchProfileSchema.safeParse({ ...valid, whatsapp: '02-25787202' }))).toBe(
      'branchProfile.whatsapp.invalid',
    )
  })

  test('a whitespace-only Arabic address yields branchProfile.addressAr.required', () => {
    expect(firstMessage(branchProfileSchema.safeParse({ ...valid, addressAr: '   ' }))).toBe(
      'branchProfile.addressAr.required',
    )
  })

  test('over-long addresses yield branchProfile.address.tooLong on either field', () => {
    const long = 'ع'.repeat(501)
    expect(firstMessage(branchProfileSchema.safeParse({ ...valid, addressAr: long }))).toBe(
      'branchProfile.address.tooLong',
    )
    expect(
      firstMessage(branchProfileSchema.safeParse({ ...valid, addressEn: 'x'.repeat(501) })),
    ).toBe('branchProfile.address.tooLong')
  })
})
