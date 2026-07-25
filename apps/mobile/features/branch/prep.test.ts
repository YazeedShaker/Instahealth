import {
  PREPARATION_SUMMARY_FASTING_AR,
  PREPARATION_SUMMARY_PREP_AR,
  type SelectedService,
} from '@instahealth/core'
import { describe, expect, it } from 'vitest'

import { getPreparationStrip, getServicePrepChip } from './prep'

function makeService(overrides: Partial<SelectedService> = {}): SelectedService {
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

describe('getPreparationStrip', () => {
  it('hidden for an empty selection', () => {
    expect(getPreparationStrip([])).toBeNull()
  })

  it('hidden when no selected service has preparation notes', () => {
    expect(getPreparationStrip([makeService(), makeService({ id: 'svc-2' })])).toBeNull()
  })

  it('shows the fasting summary when a selected service requires fasting', () => {
    const strip = getPreparationStrip([
      makeService(),
      makeService({
        id: 'lipid',
        nameAr: 'دهون ثلاثية وكوليسترول',
        preparationNotesAr: 'صيام كامل ١٢ ساعة ضروري. الماء فقط مسموح.',
        fastingHours: 12,
      }),
    ])
    expect(strip?.summaryAr).toBe(PREPARATION_SUMMARY_FASTING_AR)
    expect(strip?.requiresFasting).toBe(true)
    expect(strip?.fastingHours).toBe(12)
  })

  it('mentions fasting ONCE for multi-fasting selections — longest fast wins', () => {
    const strip = getPreparationStrip([
      makeService({
        id: 'fbs',
        nameAr: 'سكر صائم',
        preparationNotesAr: 'صيام من ٨ إلى ١٢ ساعة قبل التحليل.',
        fastingHours: 12,
      }),
      makeService({
        id: 'iron',
        nameAr: 'حديد وفيريتين',
        preparationNotesAr: 'صيام ١٢ ساعة.',
        fastingHours: 12,
      }),
    ])
    expect(strip?.summaryAr).toBe(PREPARATION_SUMMARY_FASTING_AR)
    expect(strip?.fastingHours).toBe(12)
    const fastingMentions = [strip?.summaryAr].filter(
      (text) => text?.includes('صيام') ?? false,
    ).length
    expect(fastingMentions).toBe(1)
  })

  it('shows the generic prep summary for non-fasting preparation', () => {
    const strip = getPreparationStrip([
      makeService({
        id: 'mri',
        nameAr: 'رنين مغناطيسي على الركبة',
        preparationNotesAr: 'أزل جميع المعادن والمجوهرات قبل الفحص.',
      }),
    ])
    expect(strip?.summaryAr).toBe(PREPARATION_SUMMARY_PREP_AR)
    expect(strip?.requiresFasting).toBe(false)
  })

  it('disappears again when the prep-requiring service is deselected', () => {
    const fasting = makeService({
      id: 'lipid',
      preparationNotesAr: 'صيام كامل ١٢ ساعة ضروري.',
      fastingHours: 12,
    })
    expect(getPreparationStrip([fasting])).not.toBeNull()
    expect(getPreparationStrip([makeService()])).toBeNull()
  })
})

describe('getServicePrepChip', () => {
  it('fasting services get the fasting chip', () => {
    expect(
      getServicePrepChip(
        makeService({ preparationNotesAr: 'صيام كامل ١٢ ساعة ضروري.', fastingHours: 12 }),
      ),
    ).toBe('fasting')
  })

  it('non-fasting real prep gets the generic chip', () => {
    expect(
      getServicePrepChip(
        makeService({ preparationNotesAr: 'أزل جميع المعادن والمجوهرات قبل الفحص.' }),
      ),
    ).toBe('prep')
  })

  it('no note → no chip', () => {
    expect(getServicePrepChip(makeService())).toBeNull()
  })

  it('"لا يشترط صيام" reassurance notes → no chip', () => {
    expect(getServicePrepChip(makeService({ preparationNotesAr: 'لا يشترط صيام.' }))).toBeNull()
    expect(
      getServicePrepChip(
        makeService({
          preparationNotesAr: 'لا يشترط صيام. يُفضَّل أخذ العينة صباحاً قبل الأدوية.',
        }),
      ),
    ).toBeNull()
  })
})
