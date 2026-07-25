// Branch-profile selection math (F04) — grouping and the sticky-CTA summary.
// Both apps render selections through these; the UI never re-implements
// grouping order or Arabic plural forms.

import type {
  BranchServiceItem,
  CategoryGroup,
  SelectedService,
  SelectionSummary,
} from '../types/domain.types'
import { toArabicDigits } from './format'
import { calculateBookingTotal } from './pricing'

/** The stable category ordering from the approved design: labs first, then
 * scans, then doctors. Categories outside this list follow, by their own
 * sort_order (so a future category never crashes the profile). */
const CANONICAL_CATEGORY_ORDER = ['labs', 'scans', 'doctors']

const EMPTY_SELECTION_LABEL_AR = 'لم تختر بعد'

function getCategoryRank(group: CategoryGroup): number {
  const canonicalIndex = CANONICAL_CATEGORY_ORDER.indexOf(group.slug)
  if (canonicalIndex !== -1) return canonicalIndex
  const sortOrder = group.services[0]?.categorySortOrder
  return CANONICAL_CATEGORY_ORDER.length + (sortOrder ?? Number.MAX_SAFE_INTEGER / 2)
}

/**
 * Groups a branch's services by category, in the design's stable order
 * (labs → scans → doctors → anything else by category sort_order).
 * Service order WITHIN a group is preserved as given (the query orders by
 * the service's own sort_order). Empty input → empty array.
 */
export function groupServicesByCategory(services: BranchServiceItem[]): CategoryGroup[] {
  const groupsBySlug = new Map<string, CategoryGroup>()
  for (const service of services) {
    const existing = groupsBySlug.get(service.categorySlug)
    if (existing) {
      groupsBySlug.set(service.categorySlug, {
        ...existing,
        services: [...existing.services, service],
      })
      continue
    }
    groupsBySlug.set(service.categorySlug, {
      slug: service.categorySlug,
      nameAr: service.categoryNameAr,
      nameEn: service.categoryNameEn,
      icon: service.categoryIcon,
      services: [service],
    })
  }
  return [...groupsBySlug.values()].sort((a, b) => getCategoryRank(a) - getCategoryRank(b))
}

/** Arabic count phrase with correct dual/plural agreement:
 * 1 → "خدمة واحدة", 2 → "خدمتان", 3–10 → "٣ خدمات", 11+ → "١١ خدمة". */
export function formatServiceCountAr(count: number): string {
  if (count <= 0) return EMPTY_SELECTION_LABEL_AR
  if (count === 1) return 'خدمة واحدة'
  if (count === 2) return 'خدمتان'
  if (count <= 10) return `${toArabicDigits(String(count))} خدمات`
  return `${toArabicDigits(String(count))} خدمة`
}

/** "٣٥٠" or "٩٩٫٥٠" — the bare EGP figure in Arabic-Indic digits: whole
 * amounts without decimals, fractional totals with two and the Arabic mark.
 * UIs append their own currency suffix (ج.م / EGP) per the design. */
export function formatEgpDigitsAr(amount: number): string {
  const digits = Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2).replace('.', '٫')
  return toArabicDigits(digits)
}

function formatEgpAmountAr(amount: number): string {
  return `${formatEgpDigitsAr(amount)} ج.م`
}

/**
 * The sticky-CTA summary line for the current selection.
 * Empty selection → { count: 0, totalEgp: 0, label: "لم تختر بعد" }.
 * Otherwise label is "خدمتان · ٣٥٠ ج.م" (count fragment · total).
 */
export function summarizeSelection(selected: SelectedService[]): SelectionSummary {
  const count = selected.length
  const totalEgp = calculateBookingTotal(selected)
  const countLabelAr = formatServiceCountAr(count)
  const label = count === 0 ? EMPTY_SELECTION_LABEL_AR : `${countLabelAr} · ${formatEgpAmountAr(totalEgp)}`
  return { count, totalEgp, countLabelAr, label }
}
