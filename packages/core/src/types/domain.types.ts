// Domain types — the shapes the apps actually pass around.
// They exist only where the app shape legitimately differs from the DB row
// (parsed, joined, or narrowed). Do not duplicate row shapes wholesale.

/** A service the patient has selected in the booking flow. `fastingHours` is
 * parsed ONCE from the service row (see `parseFastingHours`), never re-parsed in UI. */
export interface SelectedService {
  id: string
  nameAr: string
  nameEn: string
  priceEgp: number
  preparationNotesAr: string | null
  preparationNotesEn: string | null
  fastingHours: number | null
}

/** A bookable service as the branch profile renders it: the SelectedService
 * shape plus the category metadata needed for grouping. Mapped ONCE from the
 * joined branch query (price from branch_services, fasting parsed via
 * `parseFastingHours`), never re-derived in UI. */
export interface BranchServiceItem extends SelectedService {
  categorySlug: string
  categoryNameAr: string
  categoryNameEn: string
  categoryIcon: string | null
  categorySortOrder: number | null
}

/** One category section on the branch profile (تحاليل / أشعة / …). */
export interface CategoryGroup {
  slug: string
  nameAr: string
  nameEn: string
  icon: string | null
  services: BranchServiceItem[]
}

/** Output of summarizeSelection() — the sticky-CTA line. `label` is the full
 * "خدمتان · ٣٥٠ ج.م" string; `countLabelAr` is the count fragment alone for
 * layouts that show it next to "الإجمالي". */
export interface SelectionSummary {
  count: number
  totalEgp: number
  countLabelAr: string
  label: string
}

/** One entry in the expandable preparation detail list. Services sharing the
 * same normalized note are merged into a single entry. */
export interface PreparationNote {
  noteAr: string
  noteEn: string | null
  fastingHours: number | null
  serviceNamesAr: string[]
  serviceNamesEn: string[]
}

/** Output of computePreparationNotes(). Summaries are null when nothing needs showing. */
export interface PreparationResult {
  summaryAr: string | null
  summaryEn: string | null
  details: PreparationNote[]
  requiresFasting: boolean
  fastingHours: number | null
}

export type SlotStatus = 'available' | 'full'

/** What the slot picker renders. `status` is computed in core, never guessed in the UI. */
export interface SlotView {
  id: string
  startsAt: Date
  endsAt: Date
  status: SlotStatus
}

/** What confirmation + history screens show. */
export interface BookingSummary {
  id: string
  bookingRef: string | null
  branchNameAr: string
  slotDate: string
  slotTime: string
  status: string | null
  paymentStatus: string | null
  paymentMethod: string | null
  totalEgp: number | null
  services: Array<{ nameAr: string; priceEgp: number }>
}
