import { convertArabicDigits, type BranchServiceItem, type CategoryGroup } from '@instahealth/core'

// The thin in-list filter on the branch profile (NOT F03's global search).
// Pure so it's unit-testable; matching is diacritic-light: case-insensitive,
// Arabic-Indic digits normalized, matches Arabic or English names.

function normalizeQuery(text: string): string {
  return convertArabicDigits(text).toLowerCase().trim()
}

export function matchesServiceQuery(service: BranchServiceItem, query: string): boolean {
  const normalized = normalizeQuery(query)
  if (normalized.length === 0) return true
  return (
    normalizeQuery(service.nameAr).includes(normalized) ||
    normalizeQuery(service.nameEn).includes(normalized)
  )
}

/** Filters every group's services; groups left empty by the filter drop out. */
export function filterGroupsByQuery(groups: CategoryGroup[], query: string): CategoryGroup[] {
  if (normalizeQuery(query).length === 0) return groups
  return groups
    .map((group) => ({
      ...group,
      services: group.services.filter((service) => matchesServiceQuery(service, query)),
    }))
    .filter((group) => group.services.length > 0)
}
