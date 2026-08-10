import { toArabicDigits } from './format'
import { normalizeEgyptianPhone } from './phone'

// A04 — the catalog's shared vocabulary and the partner-nudge links.
//
// Why any of this is in core rather than in the admin screen: the same three
// service states are rendered in a list row, a detail header, and two confirm
// dialogs, and the same «بلا سعر» classification decides both a table badge and
// a dialog count. Three spellings of one vocabulary is how «موقوفة» ends up
// meaning two different things on two screens. (Same reasoning that put A02's
// commission-statement helpers here — admin-only does not mean page-local.)

/** The admin's dial. Mirrors `services.status`, which is the ONE source of
 *  truth; `services.is_active` is generated from it and never set by hand. */
export type ServiceStatus = 'draft' | 'published' | 'suspended'

/** What a branch's offering of one service is, from `service_branch_pricing()`.
 *  `unpriced` is the branch that has never quoted a number — it has either no
 *  `branch_services` row at all or a NULL price, which are the same thing to
 *  everyone downstream. */
export type BranchOfferingState = 'live' | 'switched_off' | 'unpriced'

export interface ServiceStatusVocabulary {
  /** The chip label, glyph included, exactly as the frame draws it. */
  readonly chipAr: string
  /** The longer form used where the consequence needs spelling out. */
  readonly meaningAr: string
  /** Whether a patient can see and book it. Must agree with `is_active`. */
  readonly isPatientVisible: boolean
}

export const SERVICE_STATUS_AR: Record<ServiceStatus, ServiceStatusVocabulary> = {
  published: { chipAr: '● منشورة', meaningAr: 'منشورة — قابلة للحجز', isPatientVisible: true },
  draft: { chipAr: '◌ مسودة', meaningAr: 'مسودة — لا تظهر للمرضى', isPatientVisible: false },
  suspended: { chipAr: '◍ موقوفة', meaningAr: 'موقوفة — لا حجوزات جديدة', isPatientVisible: false },
} as const

export const BRANCH_OFFERING_AR: Record<BranchOfferingState, string> = {
  live: 'متاحة',
  switched_off: 'أوقفها الشريك',
  unpriced: 'بلا سعر — لن تظهر',
} as const

/**
 * The transitions the server will actually accept
 * (`admin_set_service_status`). Kept here so a screen can DISABLE a control it
 * knows will be refused rather than offering it and reporting an error —
 * §1.4's display-predicate law. The server is still the enforcement; this is
 * the same rule, not a substitute for it.
 *
 * Nothing returns to draft: draft means "never been live", and a second way to
 * hide a published service would be a transition with no confirm of its own.
 */
export function nextServiceStatuses(from: ServiceStatus): readonly ServiceStatus[] {
  switch (from) {
    case 'draft':
      return ['published']
    case 'published':
      return ['suspended']
    case 'suspended':
      return ['published']
  }
}

export function canTransitionService(from: ServiceStatus, to: ServiceStatus): boolean {
  return nextServiceStatuses(from).includes(to)
}

/**
 * «١٢٠ — ١٨٠ ج.م» · «٣٥٠ ج.م» when every branch charges the same · «—» when
 * nobody has priced it yet.
 *
 * ⚠ A single-price service must NOT render as «٣٥٠ — ٣٥٠ ج.م». The handoff's
 * own list shows exactly that case (سونار بطن وحوض, priced at one branch) and
 * writes it once.
 */
export function formatPriceRangeEgpAr(
  minEgp: number | null | undefined,
  maxEgp: number | null | undefined,
): string {
  if (minEgp === null || minEgp === undefined) return '—'
  const max = maxEgp === null || maxEgp === undefined ? minEgp : maxEgp
  const lo = toArabicDigits(String(Math.round(minEgp)))
  const hi = toArabicDigits(String(Math.round(max)))
  return lo === hi ? `${lo} ج.م` : `${lo} — ${hi} ج.م`
}

/**
 * The message the founder sends a partner who has not priced a service.
 *
 * v1 is a mailto/WhatsApp link the founder sends by hand — SPEC-A04 says so
 * explicitly, and the in-portal «طلب تسعيرة» the frame's footer describes is
 * deferred. So the copy has to carry everything the partner needs to act
 * without a reply thread: which service, which branch, and what happens if they
 * do nothing.
 */
export function priceNudgeMessageAr(serviceNameAr: string, branchNameAr: string): string {
  return (
    `مرحباً — خدمة «${serviceNameAr}» غير مُسعَّرة في فرع ${branchNameAr} على إنستاهيلث، ` +
    `ولذلك لا تظهر للمرضى في هذا الفرع. من فضلك أضِف السعر من بوابة الشركاء ` +
    `(الخدمات والأسعار) وستظهر فوراً.`
  )
}

/** The bulk variant — one message naming every unpriced branch, so the founder
 *  sends a partner one message instead of one per branch. */
export function bulkPriceNudgeMessageAr(
  serviceNameAr: string,
  branchNamesAr: readonly string[],
): string {
  const list = branchNamesAr.join('، ')
  return (
    `مرحباً — خدمة «${serviceNameAr}» غير مُسعَّرة في ${toArabicDigits(String(branchNamesAr.length))} ` +
    `من فروعكم (${list})، ولذلك لا تظهر للمرضى فيها. من فضلك أضِف الأسعار من ` +
    `بوابة الشركاء (الخدمات والأسعار) وستظهر فوراً.`
  )
}

/**
 * `https://wa.me/20…?text=…`
 *
 * ⚠ `normalizeEgyptianPhone` returns E.164 WITH the plus (`+201012345678`) and
 * wa.me rejects that — it wants bare digits. The plus is stripped here rather
 * than by hand-parsing the input, so a branch number stored in any of the
 * shapes that helper accepts — Arabic-Indic digits included — still produces a
 * working link. Returns null when the branch has no usable MOBILE number
 * (WhatsApp has nothing to open for a landline), so the caller renders no
 * affordance rather than a dead one.
 */
export function whatsAppNudgeUrl(
  phone: string | null | undefined,
  messageAr: string,
): string | null {
  if (phone === null || phone === undefined || phone.trim() === '') return null
  const normalized = normalizeEgyptianPhone(phone)
  if (normalized === null) return null
  return `https://wa.me/${normalized.replace(/^\+/, '')}?text=${encodeURIComponent(messageAr)}`
}

/** `mailto:` with an encoded subject and body. Null when there is no address —
 *  same reasoning as above. */
export function mailtoNudgeUrl(
  email: string | null | undefined,
  subjectAr: string,
  bodyAr: string,
): string | null {
  if (email === null || email === undefined || email.trim() === '') return null
  const address = email.trim()
  if (!address.includes('@')) return null
  return `mailto:${address}?subject=${encodeURIComponent(subjectAr)}&body=${encodeURIComponent(bodyAr)}`
}

/** `tel:` for a landline. Carries no message — a call has no body — which is
 *  why it is the LAST resort in the chain below. */
export function telNudgeUrl(phone: string | null | undefined): string | null {
  if (phone === null || phone === undefined) return null
  const digits = convertToWesternDigits(phone).replace(/[^\d+]/g, '')
  return digits.length < 7 ? null : `tel:${digits}`
}

function convertToWesternDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
}

export interface NudgeChannel {
  readonly kind: 'email' | 'whatsapp' | 'phone'
  readonly href: string
  /** The affordance's label, so the founder knows what clicking does. */
  readonly labelAr: string
}

export interface NudgeContact {
  /** The branch's staff-account address — the person who can actually enter a
   *  price. Comes from A05's account list, not from the branch row. */
  readonly staffEmail?: string | null
  readonly whatsapp?: string | null
  readonly phone?: string | null
}

/**
 * Which channel «نبِّه الشريك» actually opens.
 *
 * ⚠ THE ORDER IS DRIVEN BY THE LIVE DATA, NOT BY PREFERENCE. Measured on dev
 * before this was written: of 24 branches, ONE has a whatsapp number and NONE
 * has a mobile phone — every `branches.phone` is a Cairo landline (`02-…`), so
 * `whatsAppNudgeUrl` correctly refuses 23 of them. A WhatsApp-first affordance
 * would therefore have rendered on exactly one row out of twenty-four and
 * looked broken on the rest.
 *
 * So EMAIL leads, and the address is the branch's own staff account — the human
 * with portal access, which is precisely who has to type the number in. That is
 * also why A04 and A05 ship together: before A05 there was no address to send
 * this to.
 *
 * Returns null when a branch has no reachable channel at all, and the caller
 * renders no link rather than a dead one.
 */
export function resolveNudgeChannel(
  contact: NudgeContact,
  subjectAr: string,
  messageAr: string,
): NudgeChannel | null {
  const email = mailtoNudgeUrl(contact.staffEmail, subjectAr, messageAr)
  if (email !== null) return { kind: 'email', href: email, labelAr: 'نبِّه بالبريد' }

  const whatsapp = whatsAppNudgeUrl(contact.whatsapp, messageAr)
  if (whatsapp !== null) return { kind: 'whatsapp', href: whatsapp, labelAr: 'نبِّه بواتساب' }

  const tel = telNudgeUrl(contact.phone)
  if (tel !== null) return { kind: 'phone', href: tel, labelAr: 'اتصل بالفرع' }

  return null
}
