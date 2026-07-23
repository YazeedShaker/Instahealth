import { z } from 'zod'

import { convertArabicDigits } from '../business/phone'
import { OTP_LENGTH } from '../constants'
import { phoneSchema } from './phone.schema'

const OTP_CODE_PATTERN = new RegExp(`^[0-9]{${OTP_LENGTH}}$`)

/** Request an OTP — the phone is normalized to E.164 by phoneSchema. */
export const otpRequestSchema = z.object({
  phone: phoneSchema,
})

/** Verify an OTP — Arabic-Indic digits are transformed to Western before validation. */
export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z
    .string({ message: 'otp.invalid' })
    .transform((value) => convertArabicDigits(value.trim()))
    .pipe(z.string().regex(OTP_CODE_PATTERN, { message: 'otp.invalid' })),
})

export type OtpRequest = z.infer<typeof otpRequestSchema>
export type OtpVerify = z.infer<typeof otpVerifySchema>
