// Global search normalization (F03) — the CLIENT mirror of the database's
// `normalize_arabic()` (migration: f03 search). Change both sides in the same
// PR; the unit tests here are the authority the SQL copy is checked against.
//
// Why normalization and not fuzzy matching: "اشعه" must find "أشعة" — hamza
// seats, taa marbuta and diacritics are KEYBOARD variance, not different
// words. Fuzzy/synonym matching is deliberately out of scope (SPEC-F03) until
// partners' real service names demand it.

import { convertArabicDigits } from './phone'

/** Minimum normalized length before the live search fires (SPEC-F03). */
export const SEARCH_MIN_QUERY_LENGTH = 2

// Arabic diacritics (tanween through sukun), dagger alif, tatweel.
const ARABIC_MARKS = /[ً-ْٰـ]/g

/**
 * Folds a search query (or an indexed name) to its canonical matching form:
 * hamza seats → bare alif, ى → ي, ة → ه, diacritics/tatweel stripped,
 * Arabic-Indic digits → Western, lowercased, whitespace collapsed.
 * Mirrors SQL `normalize_arabic()` exactly.
 */
export function normalizeArabicQuery(input: string): string {
  return convertArabicDigits(input)
    .replace(ARABIC_MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/** True when the query is substantial enough to search (min 2 normalized chars). */
export function isSearchableQuery(input: string): boolean {
  return normalizeArabicQuery(input).length >= SEARCH_MIN_QUERY_LENGTH
}

/** «أكثر بحثاً» suggestions for the no-results state — a CURATED list from the
 * approved design, not server data (SPEC-F03 forbids server-side search
 * history). Revisit when real usage data exists. */
export const POPULAR_SEARCHES_AR: readonly string[] = [
  'صورة دم كاملة',
  'فيتامين د',
  'أشعة سينية',
  'وظائف كلى',
]

/** Recent-searches list logic (storage itself is the app's — AsyncStorage).
 * Newest first, case/hamza-insensitive dedupe, capped. */
export const RECENT_SEARCHES_MAX = 8

export function addRecentSearch(recents: readonly string[], query: string): string[] {
  const trimmed = query.trim()
  if (trimmed.length === 0) return [...recents]
  const key = normalizeArabicQuery(trimmed)
  const kept = recents.filter((candidate) => normalizeArabicQuery(candidate) !== key)
  return [trimmed, ...kept].slice(0, RECENT_SEARCHES_MAX)
}

export function removeRecentSearch(recents: readonly string[], query: string): string[] {
  const key = normalizeArabicQuery(query)
  return recents.filter((candidate) => normalizeArabicQuery(candidate) !== key)
}
