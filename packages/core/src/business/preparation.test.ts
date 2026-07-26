import { describe, expect, test } from 'vitest'

import type { SelectedService } from '../types/domain.types'
import {
  PREPARATION_SUMMARY_FASTING_AR,
  PREPARATION_SUMMARY_FASTING_EN,
  PREPARATION_SUMMARY_PREP_AR,
  PREPARATION_SUMMARY_PREP_EN,
  computePreparationNotes,
  isReassurancePrepNote,
  parseFastingHours,
} from './preparation'

const FASTING_NOTE_12_AR = 'صيام كامل ١٢ ساعة ضروري. الماء فقط مسموح.'
const FASTING_NOTE_8_AR = 'يُفضَّل الصيام ٨ ساعات. تجنب الإجهاد الشديد قبل التحليل.'
const NON_FASTING_PREP_AR = 'عينة أول صباح أفضل. يُعطى الحاوي من المختبر.'

function makeService(overrides: Partial<SelectedService>): SelectedService {
  return {
    id: 'svc-1',
    nameAr: 'صورة دم كاملة',
    nameEn: 'CBC',
    priceEgp: 150,
    preparationNotesAr: null,
    preparationNotesEn: null,
    fastingHours: null,
    ...overrides,
  }
}

describe('parseFastingHours', () => {
  test('extracts the longest value from an Arabic range', () => {
    expect(parseFastingHours('صيام من ٨ إلى ١٢ ساعة قبل التحليل.', null)).toBe(12)
  })

  test('extracts hours from a single-value Arabic note', () => {
    expect(parseFastingHours(FASTING_NOTE_12_AR, null)).toBe(12)
    expect(parseFastingHours(FASTING_NOTE_8_AR, null)).toBe(8)
  })

  test('extracts hours from English notes with ranges', () => {
    expect(parseFastingHours(null, 'Fast for 8–12 hours before the test.')).toBe(12)
  })

  test('returns null when the note explicitly says no fasting', () => {
    expect(parseFastingHours('لا يشترط صيام', 'No fasting required')).toBeNull()
  })

  test('returns null for non-fasting prep and empty notes', () => {
    expect(parseFastingHours(NON_FASTING_PREP_AR, null)).toBeNull()
    expect(parseFastingHours(null, null)).toBeNull()
    expect(parseFastingHours('', '')).toBeNull()
  })
})

describe('computePreparationNotes', () => {
  test('no selected services → empty result, null summaries', () => {
    const result = computePreparationNotes([])
    expect(result).toEqual({
      summaryAr: null,
      summaryEn: null,
      details: [],
      requiresFasting: false,
      fastingHours: null,
    })
  })

  test('selections with no prep notes → empty result', () => {
    const result = computePreparationNotes([makeService({}), makeService({ id: 'svc-2' })])
    expect(result.details).toHaveLength(0)
    expect(result.summaryAr).toBeNull()
    expect(result.summaryEn).toBeNull()
  })

  test('one fasting service → its hours, its detail, fasting summary', () => {
    const result = computePreparationNotes([
      makeService({
        nameAr: 'دهون ثلاثية',
        preparationNotesAr: FASTING_NOTE_12_AR,
        preparationNotesEn: 'A full 12-hour fast is required.',
        fastingHours: 12,
      }),
    ])
    expect(result.requiresFasting).toBe(true)
    expect(result.fastingHours).toBe(12)
    expect(result.details).toHaveLength(1)
    expect(result.details[0]?.serviceNamesAr).toEqual(['دهون ثلاثية'])
    expect(result.summaryAr).toBe(PREPARATION_SUMMARY_FASTING_AR)
    expect(result.summaryEn).toBe(PREPARATION_SUMMARY_FASTING_EN)
  })

  test('8h + 12h fasting selected → longest fast wins, fasting mentioned once, 2 details', () => {
    const result = computePreparationNotes([
      makeService({
        id: 'a',
        nameAr: 'وظائف كبد',
        preparationNotesAr: FASTING_NOTE_8_AR,
        fastingHours: 8,
      }),
      makeService({
        id: 'b',
        nameAr: 'دهون ثلاثية',
        preparationNotesAr: FASTING_NOTE_12_AR,
        fastingHours: 12,
      }),
    ])
    expect(result.fastingHours).toBe(12)
    expect(result.details).toHaveLength(2)
    const fastingMentions = [result.summaryAr, result.summaryEn].filter(
      (summary) =>
        summary === PREPARATION_SUMMARY_FASTING_AR || summary === PREPARATION_SUMMARY_FASTING_EN,
    )
    expect(fastingMentions).toHaveLength(2) // one Arabic + one English summary, each mentioning fasting once
  })

  test('fasting + non-fasting prep mixed → both represented, fasting summary', () => {
    const result = computePreparationNotes([
      makeService({
        id: 'a',
        nameAr: 'سكر صائم',
        preparationNotesAr: FASTING_NOTE_8_AR,
        fastingHours: 8,
      }),
      makeService({
        id: 'b',
        nameAr: 'تحليل بول',
        preparationNotesAr: NON_FASTING_PREP_AR,
        fastingHours: null,
      }),
    ])
    expect(result.requiresFasting).toBe(true)
    expect(result.fastingHours).toBe(8)
    expect(result.details).toHaveLength(2)
    expect(result.summaryAr).toBe(PREPARATION_SUMMARY_FASTING_AR)
  })

  test('only non-fasting prep → non-fasting summary variant', () => {
    const result = computePreparationNotes([
      makeService({ nameAr: 'تحليل بول', preparationNotesAr: NON_FASTING_PREP_AR }),
    ])
    expect(result.requiresFasting).toBe(false)
    expect(result.fastingHours).toBeNull()
    expect(result.summaryAr).toBe(PREPARATION_SUMMARY_PREP_AR)
    expect(result.summaryEn).toBe(PREPARATION_SUMMARY_PREP_EN)
  })

  test('duplicate notes across services → merged into one detail listing both services', () => {
    const result = computePreparationNotes([
      makeService({
        id: 'a',
        nameAr: 'سكر صائم',
        preparationNotesAr: '  صيام ٨  ساعات. ',
        fastingHours: 8,
      }),
      makeService({
        id: 'b',
        nameAr: 'حمض اليوريك',
        preparationNotesAr: 'صيام ٨ ساعات.',
        fastingHours: 8,
      }),
    ])
    expect(result.details).toHaveLength(1)
    expect(result.details[0]?.serviceNamesAr).toEqual(['سكر صائم', 'حمض اليوريك'])
  })

  test('reassurance-only notes ("لا يشترط صيام") are NOT preparation — empty result', () => {
    const result = computePreparationNotes([
      makeService({ id: 'a', nameAr: 'فيتامين د', preparationNotesAr: 'لا يشترط صيام.' }),
      makeService({
        id: 'b',
        nameAr: 'هرمونات الغدة',
        preparationNotesAr: 'لا يشترط صيام. يُفضَّل أخذ العينة صباحاً قبل الأدوية.',
      }),
    ])
    expect(result.summaryAr).toBeNull()
    expect(result.summaryEn).toBeNull()
    expect(result.details).toEqual([])
    expect(result.requiresFasting).toBe(false)
  })

  test('reassurance services mixed with real prep → only the real prep surfaces', () => {
    const result = computePreparationNotes([
      makeService({ id: 'a', nameAr: 'فيتامين د', preparationNotesAr: 'لا يشترط صيام.' }),
      makeService({
        id: 'b',
        nameAr: 'دهون ثلاثية',
        preparationNotesAr: FASTING_NOTE_12_AR,
        fastingHours: 12,
      }),
    ])
    expect(result.summaryAr).toBe(PREPARATION_SUMMARY_FASTING_AR)
    expect(result.details).toHaveLength(1)
    expect(result.details[0]?.serviceNamesAr).toEqual(['دهون ثلاثية'])
  })

  test('isReassurancePrepNote: prefix match, Arabic and English, null-safe', () => {
    expect(isReassurancePrepNote('لا يشترط صيام.')).toBe(true)
    expect(isReassurancePrepNote('  لا يشترط  صيام. يُفضَّل صباحاً.')).toBe(true)
    expect(isReassurancePrepNote('No fasting required.')).toBe(true)
    expect(isReassurancePrepNote('صيام ١٢ ساعة كامل.')).toBe(false)
    expect(isReassurancePrepNote(null)).toBe(false)
    expect(isReassurancePrepNote('')).toBe(false)
  })

  test('arabic strings are preserved exactly (no encoding mangling)', () => {
    const result = computePreparationNotes([
      makeService({
        nameAr: 'دهون ثلاثية وكوليسترول',
        preparationNotesAr: FASTING_NOTE_12_AR,
        fastingHours: 12,
      }),
    ])
    expect(result.details[0]?.noteAr).toBe(FASTING_NOTE_12_AR)
    expect(result.summaryAr).toContain('صياماً')
  })
})
