import { describe, expect, it } from 'vitest'

import {
  BRANCH_ADDRESS_MAX_LENGTH,
  branchPhoneToNational,
  getProfileErrorAr,
  nationalToBranchPhone,
  normalizeBranchPhone,
  normalizeBranchWhatsapp,
} from './branch-profile'

describe('normalizeBranchPhone', () => {
  it('accepts a Cairo landline with a dash, keeping the display form', () => {
    expect(normalizeBranchPhone('02-25787202')).toBe('02-25787202')
  })

  it('accepts a governorate landline (048 area code)', () => {
    expect(normalizeBranchPhone('048-9101827')).toBe('048-9101827')
  })

  it('accepts an 11-digit mobile', () => {
    expect(normalizeBranchPhone('01012345678')).toBe('01012345678')
  })

  it('accepts short-code hotlines — the shape Town (15276) actually uses', () => {
    expect(normalizeBranchPhone('15276')).toBe('15276')
    expect(normalizeBranchPhone('16723')).toBe('16723')
    expect(normalizeBranchPhone('1272')).toBe('1272')
  })

  it('rejects a short code that does not start with 1', () => {
    expect(normalizeBranchPhone('25276')).toBeNull()
  })

  it('folds Arabic-Indic digits to Western before validating', () => {
    expect(normalizeBranchPhone('٠١٠١٢٣٤٥٦٧٨')).toBe('01012345678')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeBranchPhone('  02-25787202  ')).toBe('02-25787202')
  })

  it('rejects empty and whitespace-only input', () => {
    expect(normalizeBranchPhone('')).toBeNull()
    expect(normalizeBranchPhone('   ')).toBeNull()
  })

  it('rejects a number that does not start with 0', () => {
    expect(normalizeBranchPhone('2025787202')).toBeNull()
  })

  it('rejects too-short and too-long digit runs', () => {
    expect(normalizeBranchPhone('0123')).toBeNull()
    expect(normalizeBranchPhone('012345678901')).toBeNull()
  })

  it('rejects letters mixed into the number', () => {
    expect(normalizeBranchPhone('02-CALL-NOW')).toBeNull()
  })
})

describe('normalizeBranchWhatsapp', () => {
  it('folds a local mobile to the stored 01X form', () => {
    expect(normalizeBranchWhatsapp('01012345678')).toBe('01012345678')
  })

  it('folds +20 international form to local', () => {
    expect(normalizeBranchWhatsapp('+201012345678')).toBe('01012345678')
  })

  it('folds 0020 international form to local', () => {
    expect(normalizeBranchWhatsapp('00201012345678')).toBe('01012345678')
  })

  it('accepts Arabic-Indic digits', () => {
    expect(normalizeBranchWhatsapp('٠١١١٢٣٤٥٦٧٨')).toBe('01112345678')
  })

  it('rejects a landline — WhatsApp needs a mobile', () => {
    expect(normalizeBranchWhatsapp('02-25787202')).toBeNull()
  })

  it('rejects a non-Egyptian mobile prefix', () => {
    expect(normalizeBranchWhatsapp('01312345678')).toBeNull()
  })
})

describe('national (+20) display mapping', () => {
  it('strips the leading 0 for display and restores it on compose', () => {
    expect(branchPhoneToNational('02-27354416')).toBe('2-27354416')
    expect(nationalToBranchPhone('2-27354416')).toBe('02-27354416')
  })

  it('round-trips a spaced national landline', () => {
    expect(nationalToBranchPhone('2 2735 4416')).toBe('02 2735 4416')
    expect(branchPhoneToNational('02 2735 4416')).toBe('2 2735 4416')
  })

  it('passes hotlines through verbatim in both directions', () => {
    expect(branchPhoneToNational('15276')).toBe('15276')
    expect(nationalToBranchPhone('15276')).toBe('15276')
  })

  it('does not double a 0 the desk already typed', () => {
    expect(nationalToBranchPhone('02-27354416')).toBe('02-27354416')
  })

  it('composes a national mobile back to the 0-leading form', () => {
    expect(nationalToBranchPhone('10 2244 8890')).toBe('010 2244 8890')
    expect(branchPhoneToNational('01022448890')).toBe('1022448890')
  })

  it('folds Arabic-Indic digits while composing', () => {
    expect(nationalToBranchPhone('٢ ٢٧٣٥ ٤٤١٦')).toBe('02 2735 4416')
  })

  it('the composed form always satisfies the validator when the input was sane', () => {
    for (const national of ['2 2735 4416', '10 2244 8890', '15276', '48-9101827']) {
      expect(normalizeBranchPhone(nationalToBranchPhone(national))).not.toBeNull()
    }
  })
})

describe('getProfileErrorAr', () => {
  it('maps every server refusal to Arabic copy', () => {
    for (const reason of [
      'invalid_phone',
      'invalid_whatsapp',
      'invalid_address',
      'branch_not_found',
    ]) {
      const message = getProfileErrorAr(reason)
      expect(message.length).toBeGreaterThan(0)
      expect(message).not.toBe(getProfileErrorAr('something_else'))
    }
  })

  it('falls back to a generic message for unknown reasons', () => {
    expect(getProfileErrorAr('unknown')).toContain('حاول مرة أخرى')
  })
})

describe('BRANCH_ADDRESS_MAX_LENGTH', () => {
  it('matches the server bound (migration 20260804121655)', () => {
    expect(BRANCH_ADDRESS_MAX_LENGTH).toBe(500)
  })
})
