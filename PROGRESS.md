# PROGRESS.md — InstaHealth Build Log

> Living log of everything shipped. **Update this after every feature.**
> Any session (yours or Claude Code's) can read this to know exactly where things stand.
> Newest entries at the top of the "Shipped" section.

---

## How to use this file

After each feature merges to `main`, add an entry under **Shipped** with:

- Date, feature ID + name, PR link
- What was built (files/packages touched)
- Key decisions made during the build
- Anything the next session needs to know (gotchas, follow-ups)

Keep **Current status** and **Next up** accurate at all times.

---

## Current status

**Phase:** Slot Hold & Review done (F05) → Payment & Confirmation (F06) next (+ P01–P06 in parallel to close the loop); F03 Search still open
**Milestone target:** Labs + Scans booking working end-to-end at Town Hospital & Saridar Labs
**Environment:** Supabase `instahealth-dev` live (Frankfurt). Design system published in Claude Design.
Core patient screens approved. Monorepo scaffolded — both app shells boot with tokens/fonts/RTL.

**Launch partners secured:**

- ✅ Town Hospital (New Cairo) — labs, scans, doctor appointments — full access confirmed
- ✅ Saridar Labs — lab tests — owner confirmed, ready to test

**Stack decided:** Mobile-first. React Native + Expo patient app (THE product) + Next.js web for
provider dashboard/admin. Turborepo monorepo, shared `packages/core`, Supabase. Full CI/CD rigor
from day one (Vercel for web, EAS for mobile). See CLAUDE.md.

**Design approach:** Claude Design pass on core patient screens before implementation, to lock the
visual contract. Then specs → Claude Code.

---

## Next up (in order)

- [x] **DESIGN-01** — ✅ DONE. Core patient screens approved in Claude Design (see Shipped).
- [x] **SETUP-01** — ✅ DONE. Monorepo scaffold: `apps/mobile` (Expo) + `apps/web` (Next.js) +
      `packages/*`, Turborepo, pnpm, tsconfig, ESLint, Prettier, tokens, CI skeleton (see Shipped)
- [~] **SETUP-02** — CI/CD pipeline: gates verified green since SETUP-01; Vercel preview+production
  wiring VERIFIED (PR #2); on-demand EAS build workflow wired (`deploy.yml`, workflow_dispatch,
  EXPO_TOKEN). Remaining: Maestro-in-CI against a real dev build (currently a stub) + first
  dispatched EAS build run.
- [x] **CORE-01** — ✅ DONE. Core package: DB types, Zod schemas, Supabase client, business logic,
      constants (see Shipped)
- [x] **F01** — ✅ DONE. Mobile: patient auth (phone OTP via Vonage) — see Shipped
- [x] **F02** — ✅ DONE. Mobile: Home & Discovery + launch-partner seed + users-row trigger (see Shipped)
- [x] **F04** — ✅ DONE. Mobile: branch profile & service selection (see Shipped)
- [ ] **F03** — Mobile: search (rides on F04's branch route)
- [x] **F05** — ✅ DONE. Mobile: slot picker + 10-min hold + review + pending booking (see Shipped)
- [ ] **F06** — Mobile: Paymob payment + confirmation screen + SMS (replaces the payment stub)
- [ ] **P01–P06** — Web: provider dashboard (build alongside F05–F06 to close the loop)
- [ ] **F07–F09** — Mobile: bookings history, cancel, reviews, profile
- [ ] **A01–A06** — Web: admin panel
- [ ] **006_practitioners.sql + doctor booking** — after labs/scans proven

**First milestone:** patient books on mobile at Town/Saridar → pays → gets SMS + confirmation →
receptionist sees it on web dashboard and confirms. Closed loop = model proven.

---

## Shipped

### 2026-07-26 · FIX — Race-test findings: hold-aware availability, sign-out release, prep strip, OTP centering

Four fixes from the founder's post-capacity-model race testing:

**1 · Displayed availability now counts active holds** (the picker showed a slot as
available while `create_slot_hold` correctly rejected it — an abandoned hold was invisible
under RLS SELECT-own). New migration `20260726170254_slot_availability_and_hold_refresh`:
`get_branch_slots(branch, from, to)` RPC (SECURITY DEFINER, STABLE) returns slots WITH
DB-computed active unexpired hold counts — counts only, no user data. Both the slot picker
and the F04 preview strip now feed those counts into core `getSlotStatus`, which is
documented as THE shared availability definition (same predicate as the RPC + trigger:
`booked_count + active holds < capacity`). Regression tests: fully-held slot renders full;
all-held day disables in the strip.

**2 · Sign-out releases holds** — `releaseAllHolds(userId)` runs BEFORE `signOut()` (the
RLS delete-own path needs the live session); the booking store also resets so no selection
leaks across users. Same-user semantics fixed + documented in the same migration:
**re-holding a slot you already hold now REFRESHES the hold** (the old count included your
own hold, so capacity-1 refreshes returned `slot_full`). SQL-verified: A hold → A re-hold =
success with new hold_id, ONE row; B still `slot_full`. The F05 "known quirk" note is void.

**3 · Prep strip renders NOTHING when there's nothing** — core `computePreparationNotes`
now filters reassurance-only notes (`isReassurancePrepNote`: notes starting "لا يشترط" /
"No fasting required" are information, not preparation). Selecting only such services shows
no strip at all; mixed selections surface only the real prep. The per-row chip uses the
SAME core predicate. (The old core test that locked the merge of "لا يشترط" notes was
updated — it had locked the wrong behavior.)

**4 · OTP digit centering on iOS device** — zeroed the TextInput's default inner padding
and pinned `textAlign`/`writingDirection` at the native style level (the forced-RTL context
shifted digits in the 46px boxes; web was unaffected). Founder device check pending.

`database.ts` updated (get_branch_slots surfaces in Functions). ENGINEERING-WORKFLOW
gained bootstrap rule #4: "display state derives from the same predicate the DB enforces."

### 2026-07-26 · FIX — Slot capacity model: allocation = bookings per branch per DAY

F05 sign-off blocker: the founder's two-phone race test produced TWO simultaneous holds.
Root cause — both `generate_branch_slots()` and the F02 seed backfill generated a slot every
30 min across the FULL opening window, each with `capacity = instahealth_slot_allocation`
(5). Town (24/7): 48 slots/day × 5 = **240 bookings/day** instead of 5, and any slot
legitimately admitted 5 holds. `create_slot_hold`'s locking was NOT at fault (it does
`SELECT … FOR UPDATE` + counts unexpired holds correctly) — the capacity DATA was wrong.

**Migration `20260726151039_slot_capacity_per_day_model`** (applied to dev + saved):

- `generate_branch_slots()` rewritten (same signature — the generate-slots Edge Function
  is untouched): exactly `allocation` **capacity-1** slots per day, evenly spread on a
  30-min grid within opening hours; 24/7 branches use a 09:00–21:00 daytime window.
  Verified spreads — Town: ٩/١١/١٣/١٥/١٧؛ Saridar Sat–Thu: 8:00/10:30/13:00/15:30/18:00؛
  Friday: 9:00/10:30/12:00/13:30/15:00.
- **Safety trigger** `trg_slot_holds_capacity` (BEFORE INSERT on slot_holds, slot row
  locked): active unexpired holds + booked_count can never exceed capacity — closes every
  write path the RPC's own check doesn't cover.
- **Dropped the `slot_holds` RLS INSERT policy** — it let clients insert holds directly,
  bypassing the RPC's capacity check entirely. Holds now ONLY via the SECURITY DEFINER RPC.
- Seed 002's backfill now delegates to `generate_branch_slots()` (volume is tiny under the
  new model, so the per-branch loop is timeout-safe) — one source of truth for the grid.

**Dev cleanup + verification (all via live SQL, recorded):** old holds + 4.5k
wrongly-generated future slots deleted; founder's 9 test bookings (8 cancelled, 1 abandoned
pending) purged with their legacy slots; 30-day window regenerated → **3,720 slots, every
branch-day exactly 5, all capacity 1, nothing outside 08:00–21:00, window now to +30 days**.
Race re-test on a real slot: user A success, user B `slot_full` — one winner. Direct-insert
bypass attempt against a held slot: **blocked by the trigger** (first attempt "passed"
because the prior hold had genuinely expired between test steps — timing artifact, not a
hole). `confirm_booking()` and `cleanup-holds` need no changes (capacity-1 agrees: confirm
increments booked_count under lock → slot full; CHECK constraint intact). `database.ts`
regenerated — byte-identical (functions/trigger changes don't surface in types).

**Notes:** re-calling `create_slot_hold` for a slot you ALREADY hold returns `slot_full`
on capacity-1 slots (own hold counts before the delete-and-replace) — the app never does
this (same-slot re-tap is a no-op), F06 should keep that guard. The auth.uid() hardening
remains a separate spawned task.

### 2026-07-26 · F05 — Slot selection, hold & booking review (mobile)

Steps 2–3 of the booking flow, built to the approved booking-flow mockup. Routes under
`app/(app)/booking/`: `_layout` (step-progress header الخدمات✓→الموعد→المراجعة→الدفع, the
**persistent hold-timer chip**, expiry modal, flow-exit teardown, no-selection guard),
`slot` (date strip + month-view picker + period-grouped time grid صباحاً/ظهراً/مساءً),
`review` (order summary card + prep strip + بياناتك read-only name/phone + notes), and
`payment` (styled stub "الدفع — قريباً" + recap — **F06 replaces it**). F04's stub
`booking/index.tsx` deleted; its CTA now targets `/booking/slot`.

**The hold:** tapping an available slot calls the `create_slot_hold` RPC (never a direct
insert); rejection shows "تم حجز هذا الموعد للتو — اختر موعداً آخر" + refetch, never an
optimistic proceed. The chip counts down from the SERVER's `expires_at` (calm → amber under
2 min via core `getHoldChipState`), lives in the flow layout so it survives screen
transitions. Expiry anywhere in the flow → modal → back to a refreshed picker. Leaving the
flow releases the hold + cancels any pending booking (best-effort; cron is the safety net).

**Two-session race test (spec-required): ✅ verified at the DB level** — capacity-1 slot,
`create_slot_hold` called for two different users: user A `success:true` + hold row, user B
`{success:false, error:"slot_full"}`. Exactly one winner. (Temp slot cleaned up after.
On-device two-phone repeat stays on the founder checklist.)

**Pending booking (the confirm_booking contract):** متابعة للدفع inserts a
`status='pending_payment'` bookings row (+ `booking_services` with `price_at_booking`)
— exactly what `confirm_booking()` requires to exist. Patients have NO UPDATE policy on
bookings, so a slot re-pick cancels the stale row (`cancel_booking` RPC) and creates a
fresh one; same-slot re-entry reuses the row.

**Core additions** (core now 172 tests, 100% lines): `buildSlotDaySections()`
(`slot-sections.ts` — Cairo-pinned day/period grouping, past-slot pruning, window cap,
disabled-day flags), `getHoldChipState()` + `formatHoldCountdown()` in slots.ts.
`BranchServiceItem` gained **`branchServiceId`** (the branch_services row id —
`booking_services.branch_service_id` references it; F04's query now selects it).
Design tokens gained `warningBorder`/`warningText` (the amber chip pairings, AA contrast).

**For F06 (hand-off):**

- Store (`features/booking/store.ts`): `{ ...F04 selection, hold: {holdId, slotId,
slotDate, slotTime, expiresAt}, pendingBooking: {id, bookingRef, slotId}, notes }`.
  Payment reads everything from here; `confirm_booking(p_booking_id=pendingBooking.id,
p_payment_method, …)` is the confirmation call — it flips status/payment, inserts the
  payments row, increments the slot, deletes the hold, all atomically.
- After a successful confirm, F06 must clear `hold`/`pendingBooking` BEFORE navigating out
  so the layout's exit-teardown (blur listener) doesn't cancel the confirmed booking.
- `payment.tsx` is the file to replace; the flow layout (timer, steps) needs no changes.
- Mutations live in `features/booking/api.ts` (`acquireSlotHold`, `releaseHold`,
  `createPendingBooking`, `cancelPendingBooking`).

**Decisions / notes:**

- Hold on slot-TAP (not on التالي) — matches PRODUCT.md §7 and the design's live timer on
  the picker; التالي just navigates once a hold exists.
- Switching slots releases the old hold client-side first — the RPC only auto-replaces a
  hold on the SAME slot; without this the old hold leaks and blocks its slot ~10 min.
- Availability display can't see other patients' holds (RLS: SELECT own only) — chips show
  capacity/booked only; the RPC rejection is the real gate (per spec, documented).
- Flow exit detection is the parent Tabs screen's **blur** event (Tabs keep the navigator
  mounted, unmount alone never fires) + `popToTopOnBlur` so re-entry starts fresh at slot.
- Review = design step-3 fields (name/phone/notes) merged with the order summary; name is
  READ-ONLY per spec (design showed it editable — spec wins, profile editing out of scope).
- `commission_amount` left NULL on pending rows (column default rate 0.12 applies; no
  provider-level rate column exists yet) — compute at payout/reporting time (A-specs).

### 2026-07-25 · F04 — Branch profile & service selection (mobile)

Built to the approved branch-profile mockup: `app/(app)/branch/[id].tsx` (deep-linkable
`instahealth://branch/<id>`, signed-in via the `(app)` group guard). Photo gallery header
(dots + counter; styled placeholder while seeded branches have no photos), provider info
(name, derived type badge, rating, open/closed chip with **expandable full-week schedule**,
distance from the Home location state, address), **اتصال / الاتجاهات** actions row,
"أقرب المواعيد" read-only preview chips, services **grouped by category** (DB `icon` +
`name_ar` headers, core ordering labs → scans → doctors), thin in-list search, per-row
prep chips (يتطلب صياماً / تحضيراً), live **preparation strip** (cream, expandable in place,
from `computePreparationNotes`), sticky **احجز الآن** bar with running total + Arabic
dual/plural count. Unknown/inactive id → friendly error with back-to-Home; skeletons per
mockup. Home's `ProviderCard` (card + احجز) now navigates here. Booking stub
`app/(app)/booking/index.tsx` shows قريباً + selection recap — F05 replaces it.

**Core additions** (all tested; core now 150 tests, 100% line coverage):
`groupServicesByCategory()` / `summarizeSelection()` / `formatServiceCountAr()` /
`formatEgpDigitsAr()` in `business/selection.ts` (+ `BranchServiceItem`, `CategoryGroup`,
`SelectionSummary` domain types); hours.ts gained `getCairoDayKey()`, `DAY_LABELS_AR`,
`WEEK_DAY_ORDER`, `formatDayHoursAr()` for the week schedule.

**For F05 (hand-off):**

- **Booking store** (`features/booking/store.ts`, Zustand): `{ branchId, branchNameAr,
selectedServices, openBranch, toggleService, clearSelection, reset }`. `openBranch()`
  keeps the selection for the same branch, resets on a different one. The branch screen
  calls it on load — F05 reads the store, never re-selects.
- **Queries** (`features/branch/queries.ts`): `useBranchProfile(id)` (cache key
  `['branch', id]`, maps rows → `BranchServiceItem` incl. one-time `parseFastingHours`);
  `useBranchSlotsPreview(id)` (`['branch', id, 'slots-preview']`, 3-day window, filters
  full slots via `getSlotStatus` with holds=0 — F05 must count holds for real picking).
- **Stub route to replace:** `app/(app)/booking/index.tsx`. Its Tabs registration
  (`booking/index` with `tabBarStyle: { display: 'none' }`) already hides the tab bar for
  the flow; keep that pattern for the other 3 steps (or move the flow to its own group).

**Decisions / notes:**

- **Tab bar stays visible on the branch profile** (destination, per
  DECISION-navigation-safe-areas) — the sticky CTA sits above it, so the tab bar provides
  the bottom safe-area clearance. In the booking flow the tab bar is hidden.
- **CTA label is the spec's "احجز الآن"** (mockup said "احجز موعد" — spec wins, named twice).
- **Row prep-chip rule:** fasting chip when `fastingHours > 0`; generic تحضير chip for other
  real prep; notes starting "لا يشترط" get NO chip (reassurance, not preparation). The
  strip itself is core-authoritative (`computePreparationNotes` includes any non-empty note).
- **Call button dials `branches.phone` and is hidden when NULL** — no hotline column exists;
  Kerdasa's seeded phone IS the 19232 hotline (data-level fallback, verified). If a future
  branch lands with no phone, add a provider-level hotline column rather than hardcoding.
- Prices/totals render Arabic-Indic digits + latin "EGP" suffix per the mockup; the core
  `summarizeSelection` label uses "ج.م" per the spec example (both from core helpers).
- Maestro: `e2e/branch-profile.test.yaml` covers the full spec flow (Town select fasting +
  non-fasting → consolidated strip → stub recap → Saridar reset). Runs when SETUP-02's
  Maestro CI job lands.

### 2026-07-25 · F02 — Home & Discovery + launch-partner seed + users-row trigger

Three deliverables, applied to the LIVE dev project:

**A · Seed** (`supabase/seeds/002_launch_partners.sql`, idempotent — verified by double-run):
Town Hospital (New Cairo, 24/7, labs + 6 new scan services) + **23 Saridar branches** (every
template branch with resolved coordinates that's on the website and not "use only after
confirmation" — the spec's ~22; excluded: Maadi, Giza, Faisal 3, El-Mahla, Benha, Zagazig,
Mansoura). 486 branch_services rows, 5,260 slots backfilled for 7 days. **Scans category
activated** (the Decision-2 launch switch — labs+scans now live). Slot backfill is SET-BASED
in the seed — the per-row `generate_branch_slots()` loop exceeds the platform statement
timeout at 24 branches (nightly Edge Function still fine branch-by-branch).

**B · Migration** `20260725165604_user_profile_trigger.sql`: `handle_new_user()` on auth.users
INSERT creates the patient row (E.164-normalized phone); backfilled 2 existing users; verified
the static-test-number user got its row with no client insert. `database.ts` regenerated —
byte-identical (trigger functions don't surface in generated types). `ensureProfile()` remains
as fallback.

**C · Home screen**: built to the approved mockup — greeting + location chip + bell, search bar
(→ Search tab placeholder), category grid (تحاليل/أشعة active filters; أطباء dimmed "قريباً"
non-tappable), coming-soon chips, nearby list with real DB cards (type badge, distance,
open/closed chip, first-slot line, skeletons/empty/no-slots states), pull-to-refresh, soft-ask
location flow (deny → Cairo center + name sort; NULL-coord branches at end, no NaN). Tabs are
now the real 4-tab bar; logout moved to حسابي.

**Core additions** (all unit-tested; core now 131 tests, 100% line coverage):
`computeDistanceKm`/`formatDistanceAr` (Haversine + Arabic formatting), `parseBranchHours`/
`isBranchOpenNow`/`getOpenStatus` (24/7, Friday-different, midnight-crossing, Cairo-pinned),
`getFirstAvailableSlotLabel` (اليوم/غداً/weekday), `toArabicDigits`/`formatTimeShortAr`.

**Decisions / notes:**

- **Type badge is DERIVED**: branch serves scans → "مستشفى", labs-only → "معمل تحاليل". There is
  no provider-type column — architect may want one when a scans-only chain onboards.
- Slots query is one batched fetch (date+time ascending, 3-day window, limit 1000) — each
  branch's first appearance in that ordering IS its earliest slot; no N+1.
- F03/F04 hand-off: `useHomeBranches()` / `useFirstAvailableSlots()` in
  `features/home/queries.ts` are the query shapes to extend; `ProviderCard` takes
  `{ branch: HomeBranchWithDistance, firstSlot, now }` and should navigate to the F04 branch
  profile route when it exists (احجز button is currently a stub).

### 2026-07-23 · F01 — Patient phone-OTP authentication (mobile)

Full onboarding flow built to the DESIGN-01 handoff bundle (`design/onboarding/`): welcome →
phone → OTP → (first-time) name → Home placeholder. Route groups `(auth)` / `(app)` with
protection in the group layouts; Supabase Auth phone flow; session survives restarts via
AsyncStorage injected into core's `createClient()`. 21 unit tests on the pure auth modules.

**For F02 (hand-off):**

- **Auth store** (`features/auth/store.ts`, Zustand): `{ status, session, profile, pendingPhone,
lastOtpRequestedAt, lockout, sessionExpired }` + actions. `useProfile()`
  (`features/auth/useProfile.ts`) fetches/creates the profile via TanStack Query and syncs it in.
- **Route-group pattern:** `(auth)/_layout` redirects signed-in-with-name users to Home;
  `(app)/_layout` redirects signed-out users to welcome; `app/index.tsx` routes on launch via
  the pure `getAuthDestination()`. F02 replaces `(app)/home.tsx` and adds tabs to `(app)/_layout`.
- Reusable: `PrimaryButton`, `BackButton`, `PhoneInput`, `OtpInput`, `toArabicDigits()`.

**Decisions / deviations (verified against the live DB):**

- The spec's "existing DB trigger creates the users row" does NOT exist, and there is no
  `full_name` column. Instead: `ensureProfile()` creates the patient's own row client-side —
  which is exactly what the RLS policy "users: patient inserts own row" was written for — and
  `name_ar` is the profile-name field.
- The OTP screen gets the phone via the auth store, NOT a route param (CLAUDE.md §8: phone
  numbers never in URLs; overrides the spec's param note).
- Client lockout after 3 failed OTP attempts = 5 min (UX only; server limits are Supabase's).

**Verified prerequisites:** phone provider enabled + static test number works end-to-end
(`+201000000001` / `123456` issues a real session — probed against the live project). Real-SMS
Arabic delivery on a physical device remains a manual founder check.

**Maestro:** `e2e/auth-flow.test.yaml` covers the five spec scenarios (fresh install, persistence,
returning user, wrong-OTP lockout, invalid phone). Runs for real once SETUP-02 wires the dev-build
job; the CI Maestro step is still the SETUP-01 stub.

### 2026-07-23 · CORE-01 — Shared core package

`packages/core` filled per `docs/SPEC-CORE-01-core-package.md`. **92 tests, 100% line coverage
(98.8% branch)** on `business/` + `schemas/` + `constants/` — Vitest thresholds gate 95/95/95/90
so it can't regress. Both apps compile importing the barrel; placeholders now render live core
constants.

**Built:**

- `types/` — `database.ts` generated from the LIVE dev project (15 tables + 7 RPC function
  signatures), `helpers.types.ts` (Tables<…> aliases + named rows), `domain.types.ts`
  (SelectedService, PreparationNote/Result, SlotView, BookingSummary).
- `client/` — `createClient({ url, anonKey, storage? })` (storage injection is the only platform
  variance; RN passes AsyncStorage at F01) + `createServiceClient` (server-only, key injected,
  JSDoc + client-secret-guard boundary). No `process.env` anywhere in core.
- `business/` — `computePreparationNotes()` (longest fast wins, duplicates merged, locked summary
  copy in core) + `parseFastingHours()` (parses fasting from note text incl. Arabic-Indic digits
  and ranges; "لا يشترط صيام" → null); `slots.ts` display math (DB functions stay authoritative);
  `pricing.ts` in integer piasters (invalid/missing commission rate THROWS); `phone.ts` E.164
  normalization mirroring send-sms rules; `format.ts` pinned to Africa/Cairo.
- `schemas/` — phone/auth/booking/review/common.
- `constants/` — SLOT_HOLD_MINUTES et al; magic numbers trace here.
- Root `pnpm gen:types` script + package README documenting regeneration after every migration.
- ESLint `no-restricted-imports` bans react/react-native/next/expo in core — enforced in CI.

**Decisions:**

- **Bilingual error pattern (§6): message KEYS.** Every Zod issue's `message` is a stable key
  (`phone.invalid`); `schemas/messages.ts` maps keys → { ar, en }; UIs call
  `getErrorMessage(issue.message, locale)`. One pattern everywhere.
- Money math in integer piasters, rounding half-up at the boundary only.
- Date/time formatting pinned to Africa/Cairo — slots are Egypt wall-clock, they must not shift
  with the viewer's device timezone.
- Spec's `client/` dir naming used (supersedes the older `api/` name in CLAUDE.md §3 tree).

**For F01 (next):** consume `otpRequestSchema` / `otpVerifySchema`, `normalizeEgyptianPhone`,
`createClient()` (inject AsyncStorage as the `storage` adapter + Expo env), and
`getErrorMessage()` for field errors. OTP length/resend constants are in core.

### 2026-07-22 · SETUP-01 — Monorepo scaffold ([PR #1](https://github.com/YazeedShaker/Instahealth/pull/1))

Turborepo + pnpm workspaces stood up with both app shells and all three packages. Both placeholders
prove tokens + fonts + RTL on their platform; all CI-equivalent gates pass locally (lint, typecheck,
unit w/ coverage, web build, mobile Metro bundle, Playwright smoke, `pnpm audit --audit-level=high`).

**Built:** root workspace (turbo.json, tsconfig.base, Prettier, .env.example), `packages/config`
(shared ESLint presets — eslintrc + flat), `packages/design-tokens` (tokens.css/ts from DESIGN-01 +
`nativewind.ts` mapping + unit tests, 100% coverage), `packages/core` (empty structure, barrel
exports — CORE-01 fills it), `apps/mobile` (Expo SDK 57, Expo Router, NativeWind v4, forced RTL via
`I18nManager`, Cairo + Atkinson via `@expo-google-fonts`, Zod env validation, Maestro smoke flow,
eas.json + EAS projectId wired), `apps/web` (Next 15.5, Tailwind v4 via `@config` → shared tokens,
next/font Cairo + Atkinson, TanStack Query provider, Zod env validation, Playwright smoke).

**Versions locked:** Node 20 (CI) · pnpm 9.15.9 · turbo 2.10 · TypeScript 5.7–6.0 (per workspace) ·
Next.js 15.5.21 · React 19 · Expo SDK 57 / RN 0.86 · NativeWind 4.2.6 + Tailwind 3.4 (mobile) ·
Tailwind 4 (web) · ESLint 9 flat config · Vitest 3.2.7 · Playwright 1.5x.

**Decisions during build:**

- Expo SDK 57 (spec said 52+; generator default, keeps us current).
- Google-Fonts remote `@import` removed from `tokens.css` — fonts load per-app (next/font web,
  expo-font mobile) so builds are hermetic.
- `--max-warnings=0` and `--coverage` are baked into workspace scripts, NOT passed via
  `pnpm turbo X -- --flag` (pnpm swallows the `--`; the original ci.yml pattern breaks — fixed).
- `turbo.json` has `globalEnv` for the four public Supabase vars (turbo strict env filtering would
  otherwise strip them in CI).
- Security: pnpm overrides pin `sharp ^0.35` and `vite ^6.4.3` (audit highs via next/vitest chains).
- `react-native-css-interop` added as direct mobile dep (pnpm strict layout; Metro can't resolve it
  transitively).
- Mobile `test:e2e` is a stub until SETUP-02 wires Maestro against a real dev build in CI.

**For SETUP-02 / next session:**

- `supabase/` folder has only a README — the 5 migrations + 4 Edge Functions must be pulled from the
  live project via `supabase link && supabase db pull` (MCP account lacks access to this project).
- `deploy.yml` is a placeholder; Vercel Git integration + EAS wiring verified end-to-end in SETUP-02.
- `VERCEL_TOKEN` secret not yet set (needs a token from the Vercel account).
- `eas init --id 52149366-…` still needs an interactive `eas login` run once to confirm the link
  (projectId is already in app.config.ts).

### 2026-07 · DESIGN-01 — Patient app core screens (Claude Design)

Six core patient screens mocked, iterated, and approved in Claude Design, in the published InstaHealth
design system (teal/cream, Cairo/Atkinson), mobile, Arabic RTL:

1. Onboarding / auth (welcome, phone entry, OTP) — Arabic-only UI
2. Home / discovery (categories, provider cards, tab bar)
3. Branch / provider profile (multi-category grouping, selection, expandable prep note)
4. Booking flow (step 1 read-only review, slot picker, details, payment)
5. Booking confirmation
6. My Bookings (list + detail + cancel modal)

**Decisions captured during design review** (each would have been a costly rebuild if found in code):

- Preparation notes per-service, computed from selection, expandable inline → `DECISION-provider-data-model.md`
- Provider profiles multi-category, grouped, active-category-gated → `DECISION-provider-data-model.md`
- Booking step 1 = read-only review, not re-selection → `DECISION-booking-flow.md`
- Date picker = 7–14 day strip + calendar, capped at 30-day window → `DECISION-booking-flow.md`
- Tab bar hidden during booking flow + auth; safe-area rule for all sticky elements → `DECISION-navigation-safe-areas.md`
- My Bookings cards navigate to a detail screen (not expandable)

**Not yet designed (deliberately — follow design system directly or come later):** patient profile
screen, search results/filters detail, provider dashboard, admin panel. Built from the system + specs.

_Approved screens are now the visual contract. Feature specs reference them; Claude Code builds to them._

---

_Next entry after SETUP-02._

---

## Decisions log (cross-cutting choices worth remembering)

- **2026-07 · Slot model:** Dedicated allocation per branch, NOT CRM integration. Provider gives
  N slots/day ring-fenced for InstaHealth. Instant confirmation, zero integration. Grows with fill rate.
- **2026-07 · MVP scope:** Labs + Scans + Doctor appointments. Labs/scans first (shared slot
  mechanic), doctors after (needs practitioners table).
- **2026-07 · Architecture:** Mobile-first. Expo (React Native) patient app is the primary product;
  Next.js web is provider dashboard + admin (+ later patient PWA). Monorepo so both apps reuse
  `packages/core` (all types/schemas/business logic/API). Build order: core → mobile patient app →
  web dashboard (in parallel to close the loop) → admin.
- **2026-07 · Provider services & categories:** Branches can span multiple categories; branch profile
  renders services GROUPED BY category (Town Hospital = labs + scans + doctors on day one). Onboard the
  full menu into the DB; surface only categories with `is_active = true`; launching a category = flipping
  the flag. Full detail in `docs/DECISION-provider-data-model.md`.
- **2026-07 · Preparation notes:** Per-service, NOT per-branch. Computed from the patient's actual
  selection via a shared `computePreparationNotes()` in `packages/core/business` — longest fast wins,
  duplicates merged, shown only when a selected service needs it, reused at selection + confirmation +
  SMS. Displayed as an **expandable inline note** (collapsed summary → tap to reveal per-service detail
  in place; no modal, no "go review elsewhere" dead end). (Caught while reviewing the DESIGN-01
  provider profile mockup, then refined when the note pointed nowhere.)
- **2026-07 · Booking flow step 1:** Read-only REVIEW (services + total + prep note + "تعديل" back-link),
  NOT a re-selection — the patient already chose on the branch profile. Selection happens once. Branch
  profile = choose; booking flow = confirm & schedule. Detail in `docs/DECISION-booking-flow.md`.
- **2026-07 · Date picker:** Short horizontal strip (7–14 days) + a calendar affordance for going
  further, BOTH capped at the 30-day slot window (`generate_branch_slots` ceiling). Fully-booked and
  out-of-window days are disabled in both — no dead ends. (The mockup strip "not sliding" is a static-
  preview limitation, not a real bug.) Detail in `docs/DECISION-booking-flow.md`.
- **2026-07 · Tab bar:** Persistent on destinations (home, search, bookings, profile, branch profile);
  HIDDEN during the booking flow (all 4 steps) and auth — keeps the patient in the commitment funnel
  with the live slot hold; exit only via back/cancel. Detail in `docs/DECISION-navigation-safe-areas.md`.
- **2026-07 · Safe areas:** Every sticky/bottom element (CTAs, tab bar, countdown banner) must sit
  inside the safe-area inset — nothing under the iOS home indicator / Android gesture bar. Global rule,
  verified on real devices. (Caught in the step-1 review mockup where the CTA sat flush to the edge.)
- **2026-07 · Auth:** Patients phone OTP (Vonage). Providers email/password. Admin email + TOTP.
- **2026-07 · Booking integrity:** Atomic `confirm_booking()` Postgres function. 10-min slot holds,
  cron cleanup every 5 min.
- **2026-07 · CI/CD:** Full rigor — blocking gates on lint, typecheck, unit, E2E, security. No red merges.
- **2026-07 · Company/legal:** Running in parallel. Build + validate with TEST data now. Do NOT go
  live with real patient data / real payments until entity is registered and founder agreement signed.

---

## Known risks / open items

- **⚠ `generate-slots` nightly cron still not scheduled:** the capacity-model fix
  regenerated a full 30-day window (now through +30 days), but nothing extends it nightly —
  wire the Edge Function schedule before launch or the window shrinks day by day.
- **⚠ `create_slot_hold(p_slot_id, p_user_id)` doesn't verify `p_user_id = auth.uid()`**
  (SECURITY DEFINER, callable by any authenticated user) — a malicious client could hold
  slots as another user. Harden with an auth.uid() check in a follow-up migration.
- **⚠ All seeded prices are PLACEHOLDERS** (labs 150/250/400, scans 300–2500 EGP rounds) —
  replace with real Saridar/Town prices via the provider dashboard before real patients.
- **Saridar per-branch hours unconfirmed:** all 23 seeded branches use the standard schedule
  (Sat–Thu 08:00–22:00, Fri 09:00–17:00). Google shows different hours at Dokki/Manial/Faisal 2 —
  awaiting Saridar's answer to the template's question 4; update `operating_hours` per branch then.
- **7 Saridar branches not yet seeded** (Maadi, Giza, Faisal 3, El-Mahla, Benha, Zagazig,
  Mansoura) — pending confirmation/maps links; add via a data-only follow-up to seed 002.

- **Trademark:** "InstaHealth" name proximity to existing "InstaClinic" (home-visit app) and
  "Instapharm". Check trademark availability in Egypt before public launch / printing.
- **Doctor scheduling complexity:** doctor appointments differ from slot-based labs. Practitioners
  migration needed. Kept out of first milestone deliberately.
- **Legal not yet signed:** founder split (Mohamed 35 / Yazeed 33 / Tarek 28) agreed verbally only.
  Two-page agreement to be signed in parallel with build.
- **Provider onboarding at scale:** Town + Saridar solve launch supply. Post-launch expansion still
  needs a repeatable onboarding process (future).

---

_This file is the memory of the project. Keep it honest and current._
