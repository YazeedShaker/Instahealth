# SPEC · F02 — Home & Discovery (Mobile) + Launch-Partner Seed

> Hand this to Claude Code. Read `CLAUDE.md`, `PRODUCT.md`, `PROGRESS.md` (F02 hand-off notes),
> `DECISION-navigation-safe-areas.md`, `docs/data/saridar-branches-template.md`, and the Home design
> handoff bundle first. Requires: F01 merged. One PR.

---

## Goal

The patient's entry point. After auth, Home shows: a greeting, a location chip, a search bar,
the three service categories (labs + scans active, doctors "coming soon"), and a nearby-providers
list where **Town Hospital and the Saridar branches appear as real cards** — name, type badge,
distance, open/closed, first-available slot. This makes the app real: actual partners, on an
actual map of the patient's world.

Three deliverables in one PR: (A) the launch-partner seed, (B) a users-row trigger migration
(deferred follow-up from F01), (C) the Home screen itself.

---

## A · Launch-partner seed (`supabase/seeds/002_launch_partners.sql`)

Generate SQL from the data in `docs/data/saridar-branches-template.md`:

- **Town Hospital** — provider (type: hospital) + its New Cairo branch (coords 30.014288,
  31.4379333, hotline 15276, 24/7 hours for lab & radiology) + `branch_services` rows linking
  a representative set of the 20 seeded lab tests AND 5–8 scan services (create the scan
  services if the seed catalog lacks them: X-ray, ultrasound, CT, MRI, mammogram — AR/EN names,
  prep notes where real, e.g. fasting for abdominal ultrasound).
- **Saridar Labs** — provider (type: lab, hotline 19232) + **only the branches that have
  coordinates and are NOT in the "confirm still open" section** of the template (that's ~22
  branches today). Branches marked NEEDS LINK or unconfirmed are NOT seeded — they get added
  by a data-only follow-up when confirmed. Labs services only (no scans at Saridar).
- Per-branch hours from the template (Town 24/7; Saridar standard schedule until the
  per-branch hours question is answered — note this in PROGRESS).
- **All prices are placeholders**: round numbers (e.g. 150/250/400 EGP). Add a PROGRESS.md
  risk entry: "All seeded prices are placeholders — replace before real patients."
- `instahealth_slot_allocation` = 5 (default) per branch. Verify `generate-slots` picks the
  new branches up on its nightly run; also backfill slots for the next 7 days in the seed so
  Home has data immediately.
- Seed must be idempotent (upsert on natural keys) — safe to re-run.

## B · Migration `006_user_profile_trigger.sql`

Closes the F01 deviation: add `handle_new_user()` trigger on `auth.users` INSERT creating the
matching `public.users` row (patient role), backfill any existing auth users missing a row,
and verify the `user_role` JWT claim path works for trigger-created rows. Keep the client-side
insert in the app as a no-op fallback (INSERT ... ON CONFLICT DO NOTHING → converted to
row-exists check). Regenerate `database.ts` in the same PR (CLAUDE.md rule).

## C · Home screen (`app/(app)/home.tsx` + components)

Build to the approved Home mockup from the design handoff:

1. **Header** — greeting with the patient's first name (from profile), location chip
   ("القاهرة — التجمع الخامس" style: governorate — area). Location via `expo-location`
   with a soft-ask flow: explain why → request permission → on grant, use coords for
   distance sorting; on deny, default to Cairo center and sort by name. Never block on it.
2. **Search bar** — visual per design; tapping navigates to the Search tab (F03 builds the
   real thing; for now the search screen is a styled placeholder).
3. **Category cards** — تحاليل (labs) and أشعة (scans) active with Health Icons; أطباء
   (doctors) rendered in the approved "coming soon" dimmed state, non-navigating. Tapping an
   active category filters the provider list below (client-side filter is fine at this scale).
4. **Nearby providers list** — the provider card per design: name (Arabic), type badge
   (مستشفى/معمل), distance ("١٫٢ كم"), open/closed chip, first-available-slot line
   ("أقرب موعد: اليوم ٣:٣٠ م"). States: loading skeletons, empty ("لا توجد نتائج"), and a
   card-level "no slots" state ("لا توجد مواعيد متاحة"). Branches with NULL coords (future
   data) sort to the end without a distance label — never crash, never show "NaN كم".
5. **Tab bar** — per `docs/decisions/DECISION-navigation-safe-areas.md`: visible here, with الرئيسية active;
   البحث / حجوزاتي / حسابي are styled placeholder screens (F03/F07/profile fill them).
6. **Data** — TanStack Query: one query for branches+services+provider joined (RLS: public
   read on active providers), one for first-available slots (batched, not N+1 — a single
   query over the visible branch ids). Pull-to-refresh.

## Additions to `@instahealth/core` (with unit tests)

- `computeDistanceKm(a: LatLng, b: LatLng): number` — Haversine; and
  `formatDistanceAr(km): string` (Arabic-Indic numerals, "كم", one decimal under 10km).
- `isBranchOpenNow(hours: BranchHours, now: Date): boolean` — supports 24/7, per-day ranges,
  and the Friday-different pattern; `now` injected, Africa/Cairo timezone explicit.
- `getFirstAvailableSlotLabel(slot, now, locale)` — "اليوم/غداً + time" per the design copy.

## Tests

**Unit:** Haversine known-distance cases; open/closed across boundaries (Fri 16:59/17:01,
24/7 always true, midnight-crossing ranges); distance formatting with Arabic numerals;
null-coords sorting rule.
**Maestro:** login with static test number → Home shows Town Hospital card AND at least one
Saridar card → tap تحاليل filters to labs-only providers → deny location → list still renders
sorted by name → pull-to-refresh works.

## Acceptance criteria

- [ ] Seed applied to dev: Town + ~22 Saridar branches queryable, each with services and 7 days
      of slots; re-running the seed changes nothing
- [ ] Trigger migration live: a fresh OTP signup creates the users row with NO client insert path
      exercised; `database.ts` regenerated
- [ ] Home renders the approved design RTL on device: categories, real provider cards with
      correct distance from an actual Cairo location, open/closed correct for the current time
- [ ] Doctors category visibly "coming soon", non-tappable
- [ ] Location denial path graceful; NULL-coord branches at list end without distance
- [ ] No slots / empty / loading states all reachable and styled
- [ ] CI fully green including Maestro

## What NOT to do

- No branch profile screen (F04) — provider cards navigate nowhere yet (or to a stub route).
- No real search (F03), no booking flow (F05), no map view (post-MVP).
- No hardcoded provider data in the app — everything renders from the DB.
- Do not seed unconfirmed/linkless Saridar branches; do not invent scan prices beyond
  placeholder rounds.

## When done

Update PROGRESS.md (Shipped + placeholder-prices risk + per-branch-hours open question +
notes for F03/F04: query shapes, card component API). F04 (Branch Profile) is the natural
next since F03 (Search) can ride after it.
