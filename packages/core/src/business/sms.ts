// Outbound SMS copy. Arabic Unicode, capped at SMS_MAX_LENGTH so Vonage never
// splits a message mid-word.
//
// ⚠ MIRROR WARNING — `supabase/functions/settle-payment/index.ts` reproduces
// `buildConfirmationSmsAr` verbatim. Edge Functions are standalone Deno
// modules and cannot import this workspace package (the same reason `send-sms`
// re-implements core's phone rules). The tests in `sms.test.ts` lock the
// template strings; if you change the copy here, change it THERE in the same PR.

import { SMS_MAX_LENGTH } from '../constants'
import { toArabicDigits } from './format'
import type { PreparationResult } from '../types/domain.types'

/**
 * The SHORT preparation line for SMS.
 *
 * Service preparation notes are written for the screen ("صيام من ٨ إلى ١٢
 * ساعة قبل التحليل. يُسمح بشرب الماء فقط.") and simply do not fit beside the
 * booking details in a 140-character Unicode SMS — measured against the real
 * seed data, the full note ALWAYS overflowed and got dropped, which silenced
 * the single most important instruction in the message (PRODUCT.md §7:
 * preparation notes are critical in Egypt).
 *
 * So the SMS carries the CONSOLIDATED rule instead — longest fast wins, per
 * DECISION-provider-data-model §3 — and the app holds the detail.
 */
export function formatPrepSmsNoteAr(prep: PreparationResult): string | null {
  if (prep.summaryAr === null) return null
  if (prep.requiresFasting && prep.fastingHours !== null) {
    return `صيام ${toArabicDigits(String(prep.fastingHours))} ساعة قبل الموعد`
  }
  return 'يلزم تحضير قبل الموعد — التفاصيل في التطبيق'
}

export interface ConfirmationSmsInput {
  bookingRef: string | null
  branchNameAr: string
  /** Already Cairo-pinned and Arabic-formatted (core `formatArabicDate`). */
  dateLabelAr: string
  /** Already Cairo-pinned and Arabic-formatted (core `formatTimeShortAr`). */
  timeLabelAr: string
  /** The SHORT consolidated line from `formatPrepSmsNoteAr`, or null when
   * nothing needs preparing. "Empty means absent" — no note produces no
   * preparation sentence at all. */
  prepNoteAr: string | null
}

/**
 * The booking-confirmation SMS. Sent server-side by `settle-payment` the moment
 * `confirm_booking()` succeeds — never from the client.
 *
 * Truncation drops the LEAST critical content first: the preparation sentence
 * is appended only if the whole message still fits, because a half-sentence
 * about fasting is worse than none (the reminder SMS repeats it the day before).
 */
export function buildConfirmationSmsAr(input: ConfirmationSmsInput): string {
  const refPart = input.bookingRef !== null ? ` رقم الحجز: ${input.bookingRef}.` : ''
  const base = `تم تأكيد حجزك في ${input.branchNameAr} يوم ${input.dateLabelAr} الساعة ${input.timeLabelAr}.${refPart}`

  if (input.prepNoteAr === null) return base.slice(0, SMS_MAX_LENGTH)

  const withPrep = `${base} تجهيز: ${input.prepNoteAr}`
  return withPrep.length <= SMS_MAX_LENGTH ? withPrep : base.slice(0, SMS_MAX_LENGTH)
}
