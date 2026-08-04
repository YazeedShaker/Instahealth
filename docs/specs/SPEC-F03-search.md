# SPEC · F03 — Search (Mobile)

> Hand this to Claude Code. Read the root docs, ENGINEERING-WORKFLOW, PROGRESS (latest
> hand-offs), DECISION-provider-data-model (active-category law), DECISION-navigation-safe-areas
> (search is a DESTINATION — tab bar visible), and the Search screen in the refreshed
> design/handoff/ bundle. Verify queries against the live dev DB. One PR.

## Goal

The البحث tab becomes real: live search across services AND providers, grouped results per the
approved design, ending in the existing branch-profile flow. "سونار" finds both the scan service
and every branch that offers it.

## Screen & states (per the approved design — build exactly)

1. **Initial:** focused field, recent searches (local AsyncStorage, max 8, clearable, no server
   persistence), category shortcut chips (تحاليل / أشعة) that jump to category-filtered results.
2. **Results (live, debounced ~300ms, min 2 chars):** two sections per design —
   **خدمات**: service rows (name, "متوفر في X فرع" from ACTIVE branch links). Tapping opens a
   branches-for-service list (name, distance, that branch's price, open/closed — reuse existing
   row/card components) → tapping a branch opens the branch profile with THAT service
   preselected in the booking store (small, high-value: search → selection in two taps).
   **مراكز**: the existing provider card, the exact component from Home — no variants.
3. **No results:** calm empty state per design + category-browse suggestion.
4. Loading skeletons; tab bar visible; safe areas per the standing rules.

## Search correctness (the substantive part)

- **Arabic normalization is required, both sides:** أ/إ/آ→ا, ى→ي, ة→ه, strip diacritics/tatweel —
  "اشعه" must match "أشعة". Implement as a core function (`normalizeArabicQuery`) + the matching
  DB-side treatment (normalized generated columns or an immutable normalize fn used in the
  query — Claude Code picks against the live schema and documents the choice). English matched
  case-insensitively on name_en.
- **The active-law applies server-side:** results only from active categories, active services,
  active branches/providers — the SAME predicates Home/booking enforce (no parallel definitions;
  if a shared derivation exists, use it; if not, create it once in core/api).
- Branch results sort by distance (existing location state; null-coords last, no NaN).
- Query implementation server-side (RPC or RLS-safe selects) — no client-side filtering of
  over-fetched data.

## Tests

**Unit:** normalization table (hamza/taa-marbuta/diacritics cases), grouping, recent-searches
store (add/dedupe/cap/clear).
**Node-against-dev:** normalized matches hit; inactive service/category/branch excluded;
counts ("متوفر في X فرع") correct against seed.
**Maestro:** search a seeded lab test with a hamza-variant spelling → service row → branches
list → branch profile with the service preselected → recent search persists across app
restart; gibberish → empty state; category chip → filtered results.

## Acceptance criteria

- [ ] Matches the approved design RTL on device, all four states
- [ ] Hamza/variant Arabic queries match; active-law enforced server-side with shared predicates
- [ ] Search → preselected service on branch profile works end-to-end
- [ ] Recent searches local-only; PROGRESS updated; CI green

## What NOT to do

No search history on the server. No fuzzy/synonym engine (normalization only — note fuzzy as a
future candidate if partners' service names demand it). No map results. No doctor content.
No new card designs.
