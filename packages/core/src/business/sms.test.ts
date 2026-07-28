import { describe, expect, it } from 'vitest'

import { SMS_MAX_LENGTH } from '../constants'
import { buildConfirmationSmsAr, formatPrepSmsNoteAr } from './sms'

const base = {
  bookingRef: 'IH-2026-48291',
  branchNameAr: 'معامل سريدار — الدقي',
  dateLabelAr: 'الثلاثاء ٢١ يوليو',
  timeLabelAr: '٢:٠٠م',
  prepNoteAr: null,
}

describe('buildConfirmationSmsAr', () => {
  // Locks the template. `supabase/functions/settle-payment` MIRRORS this copy —
  // if this test changes, the Edge Function changes in the same PR.
  it('renders the confirmation template with ref, branch, date and time', () => {
    expect(buildConfirmationSmsAr(base)).toBe(
      'تم تأكيد حجزك في معامل سريدار — الدقي يوم الثلاثاء ٢١ يوليو الساعة ٢:٠٠م. رقم الحجز: IH-2026-48291.',
    )
  })

  it('appends the preparation sentence when there is one', () => {
    const message = buildConfirmationSmsAr({ ...base, prepNoteAr: 'صيام ١٢ ساعة' })
    expect(message).toContain('تجهيز: صيام ١٢ ساعة')
  })

  it('omits the preparation sentence entirely when nothing needs preparing', () => {
    expect(buildConfirmationSmsAr(base)).not.toContain('تجهيز')
  })

  it('drops the whole preparation sentence rather than truncating it mid-word', () => {
    const longNote = 'صيام كامل ١٢ ساعة، الماء فقط مسموح، وتجنب المجهود البدني قبل التحليل بيوم'
    const message = buildConfirmationSmsAr({
      ...base,
      branchNameAr: 'معامل سريدار — فرع مدينة نصر الأول بجوار مستشفى الكلية الحربية',
      prepNoteAr: longNote,
    })
    expect(message).not.toContain('تجهيز')
    expect(message.length).toBeLessThanOrEqual(SMS_MAX_LENGTH)
  })

  // Regression guard for the bug this caught against real seed data: the full
  // service note never fit, so the fasting instruction silently vanished.
  it('fits the consolidated fasting line alongside a realistic branch name', () => {
    const prep = formatPrepSmsNoteAr({
      summaryAr: 'x',
      summaryEn: 'x',
      details: [],
      requiresFasting: true,
      fastingHours: 12,
    })
    const message = buildConfirmationSmsAr({
      ...base,
      branchNameAr: 'ساريدار — الدقي',
      prepNoteAr: prep,
    })
    expect(message).toContain('تجهيز: صيام ١٢ ساعة قبل الموعد')
    expect(message.length).toBeLessThanOrEqual(SMS_MAX_LENGTH)
  })

  it('never exceeds the Vonage single-message cap', () => {
    const message = buildConfirmationSmsAr({
      ...base,
      branchNameAr: 'م'.repeat(200),
      prepNoteAr: 'صيام ١٢ ساعة',
    })
    expect(message.length).toBeLessThanOrEqual(SMS_MAX_LENGTH)
  })

  it('omits the reference clause when the DB trigger has not produced one', () => {
    const message = buildConfirmationSmsAr({ ...base, bookingRef: null })
    expect(message).not.toContain('رقم الحجز')
    expect(message).toContain('تم تأكيد حجزك')
  })
})

describe('formatPrepSmsNoteAr', () => {
  const empty = {
    summaryAr: null,
    summaryEn: null,
    details: [],
    requiresFasting: false,
    fastingHours: null,
  }

  it('returns null when nothing needs preparing', () => {
    expect(formatPrepSmsNoteAr(empty)).toBeNull()
  })

  it('states the consolidated fast in Arabic-Indic digits', () => {
    expect(
      formatPrepSmsNoteAr({ ...empty, summaryAr: 'x', requiresFasting: true, fastingHours: 12 }),
    ).toBe('صيام ١٢ ساعة قبل الموعد')
  })

  it('uses the longest fast, per the consolidation rule', () => {
    expect(
      formatPrepSmsNoteAr({ ...empty, summaryAr: 'x', requiresFasting: true, fastingHours: 8 }),
    ).toBe('صيام ٨ ساعة قبل الموعد')
  })

  it('points at the app for non-fasting preparation', () => {
    expect(formatPrepSmsNoteAr({ ...empty, summaryAr: 'x' })).toBe(
      'يلزم تحضير قبل الموعد — التفاصيل في التطبيق',
    )
  })

  it('falls back to the generic line when fasting is flagged without hours', () => {
    expect(
      formatPrepSmsNoteAr({ ...empty, summaryAr: 'x', requiresFasting: true, fastingHours: null }),
    ).toBe('يلزم تحضير قبل الموعد — التفاصيل في التطبيق')
  })
})
