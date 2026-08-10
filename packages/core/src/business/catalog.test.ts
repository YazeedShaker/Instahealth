import { describe, expect, it } from 'vitest'

import {
  BRANCH_OFFERING_AR,
  SERVICE_STATUS_AR,
  bulkPriceNudgeMessageAr,
  canTransitionService,
  formatPriceRangeEgpAr,
  mailtoNudgeUrl,
  nextServiceStatuses,
  resolveNudgeChannel,
  telNudgeUrl,
  priceNudgeMessageAr,
  whatsAppNudgeUrl,
} from './catalog'

describe('service status vocabulary', () => {
  it('marks only the published state as visible to patients', () => {
    expect(SERVICE_STATUS_AR.published.isPatientVisible).toBe(true)
    expect(SERVICE_STATUS_AR.draft.isPatientVisible).toBe(false)
    expect(SERVICE_STATUS_AR.suspended.isPatientVisible).toBe(false)
  })

  it('names every offering state, including the one that is an absent row', () => {
    expect(BRANCH_OFFERING_AR.unpriced).toContain('بلا سعر')
    expect(BRANCH_OFFERING_AR.live).toBe('متاحة')
    expect(BRANCH_OFFERING_AR.switched_off).toContain('الشريك')
  })
})

describe('service status transitions', () => {
  it('allows a draft to be published', () => {
    expect(canTransitionService('draft', 'published')).toBe(true)
  })

  it('allows a published service to be suspended and a suspended one republished', () => {
    expect(canTransitionService('published', 'suspended')).toBe(true)
    expect(canTransitionService('suspended', 'published')).toBe(true)
  })

  it('never allows a return to draft — a published service has been live', () => {
    expect(canTransitionService('published', 'draft')).toBe(false)
    expect(canTransitionService('suspended', 'draft')).toBe(false)
  })

  it('refuses to suspend something that was never published', () => {
    expect(canTransitionService('draft', 'suspended')).toBe(false)
  })

  it('offers exactly one next state from anywhere', () => {
    expect(nextServiceStatuses('draft')).toEqual(['published'])
    expect(nextServiceStatuses('published')).toEqual(['suspended'])
    expect(nextServiceStatuses('suspended')).toEqual(['published'])
  })
})

describe('formatPriceRangeEgpAr', () => {
  it('renders a spread as a range in Arabic digits', () => {
    expect(formatPriceRangeEgpAr(120, 180)).toBe('١٢٠ — ١٨٠ ج.م')
  })

  it('writes a single price ONCE when every branch charges the same', () => {
    expect(formatPriceRangeEgpAr(350, 350)).toBe('٣٥٠ ج.م')
  })

  it('treats a missing max as a single price', () => {
    expect(formatPriceRangeEgpAr(200, null)).toBe('٢٠٠ ج.م')
  })

  it('renders an em-dash when nobody has priced it', () => {
    expect(formatPriceRangeEgpAr(null, null)).toBe('—')
    expect(formatPriceRangeEgpAr(undefined, undefined)).toBe('—')
  })

  it('rounds rather than printing a fractional pound', () => {
    expect(formatPriceRangeEgpAr(119.6, 180.2)).toBe('١٢٠ — ١٨٠ ج.م')
  })
})

describe('nudge copy', () => {
  it('names the service, the branch, and the consequence of doing nothing', () => {
    const message = priceNudgeMessageAr('فيتامين د', 'مدينة نصر')
    expect(message).toContain('فيتامين د')
    expect(message).toContain('مدينة نصر')
    expect(message).toContain('لا تظهر للمرضى')
  })

  it('lists every unpriced branch in the bulk variant and counts them in Arabic', () => {
    const message = bulkPriceNudgeMessageAr('فيتامين د', ['مدينة نصر', 'حلوان'])
    expect(message).toContain('مدينة نصر، حلوان')
    expect(message).toContain('٢')
  })
})

describe('whatsAppNudgeUrl', () => {
  it('builds a wa.me link with no plus sign and an encoded body', () => {
    const url = whatsAppNudgeUrl('01012345678', 'مرحباً')
    expect(url).toBe(`https://wa.me/201012345678?text=${encodeURIComponent('مرحباً')}`)
  })

  it('accepts a number written with Arabic digits', () => {
    expect(whatsAppNudgeUrl('٠١٠١٢٣٤٥٦٧٨', 'x')).toContain('wa.me/201012345678')
  })

  it('returns null for a branch with no number, so no dead affordance renders', () => {
    expect(whatsAppNudgeUrl(null, 'x')).toBeNull()
    expect(whatsAppNudgeUrl(undefined, 'x')).toBeNull()
    expect(whatsAppNudgeUrl('   ', 'x')).toBeNull()
  })

  it('returns null for a number that is not a valid Egyptian mobile', () => {
    expect(whatsAppNudgeUrl('12345', 'x')).toBeNull()
  })
})

describe('mailtoNudgeUrl', () => {
  it('encodes the subject and the body separately', () => {
    const url = mailtoNudgeUrl('a@b.eg', 'تسعيرة', 'مرحباً')
    expect(url).toBe(
      `mailto:a@b.eg?subject=${encodeURIComponent('تسعيرة')}&body=${encodeURIComponent('مرحباً')}`,
    )
  })

  it('returns null without an address or without an @', () => {
    expect(mailtoNudgeUrl(null, 's', 'b')).toBeNull()
    expect(mailtoNudgeUrl('', 's', 'b')).toBeNull()
    expect(mailtoNudgeUrl('not-an-address', 's', 'b')).toBeNull()
  })
})

describe('telNudgeUrl', () => {
  it('accepts the Cairo landline shape every seeded branch actually has', () => {
    expect(telNudgeUrl('02-35424042')).toBe('tel:0235424042')
  })

  it('converts Arabic-Indic digits', () => {
    expect(telNudgeUrl('٠٢-٣٥٤٢٤٠٤٢')).toBe('tel:0235424042')
  })

  it('returns null for nothing usable', () => {
    expect(telNudgeUrl(null)).toBeNull()
    expect(telNudgeUrl(undefined)).toBeNull()
    expect(telNudgeUrl('12')).toBeNull()
  })
})

describe('resolveNudgeChannel', () => {
  it('prefers the branch staff account — the person who can enter the price', () => {
    const channel = resolveNudgeChannel(
      { staffEmail: 'desk@nile.eg', whatsapp: '01012345678', phone: '02-35424042' },
      'تسعيرة',
      'رسالة',
    )
    expect(channel?.kind).toBe('email')
    expect(channel?.href).toContain('mailto:desk@nile.eg')
  })

  it('falls back to WhatsApp when the branch has no staff account yet', () => {
    const channel = resolveNudgeChannel(
      { staffEmail: null, whatsapp: '01012345678', phone: '02-35424042' },
      's',
      'رسالة',
    )
    expect(channel?.kind).toBe('whatsapp')
  })

  it('falls back to the landline — the only channel 23 of 24 dev branches have', () => {
    const channel = resolveNudgeChannel(
      { staffEmail: null, whatsapp: null, phone: '02-35424042' },
      's',
      'm',
    )
    expect(channel?.kind).toBe('phone')
    expect(channel?.href).toBe('tel:0235424042')
  })

  it('returns null when a branch is unreachable, so no dead link renders', () => {
    expect(
      resolveNudgeChannel({ staffEmail: null, whatsapp: null, phone: null }, 's', 'm'),
    ).toBeNull()
  })
})
