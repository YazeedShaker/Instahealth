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

**Phase:** Mobile auth done (F01) → Discovery (F02 next)
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
- [ ] **SETUP-02** — CI/CD pipeline (GitHub Actions: lint, typecheck, test, build, security, Vercel + EAS)
- [x] **CORE-01** — ✅ DONE. Core package: DB types, Zod schemas, Supabase client, business logic,
      constants (see Shipped)
- [x] **F01** — ✅ DONE. Mobile: patient auth (phone OTP via Vonage) — see Shipped
- [ ] **F02–F04** — Mobile: home, map/list discovery, search, branch profile
- [ ] **F05–F06** — Mobile: booking flow (select → slot/hold → details → Paymob) + confirmation
- [ ] **P01–P06** — Web: provider dashboard (build alongside F05–F06 to close the loop)
- [ ] **F07–F09** — Mobile: bookings history, cancel, reviews, profile
- [ ] **A01–A06** — Web: admin panel
- [ ] **006_practitioners.sql + doctor booking** — after labs/scans proven

**First milestone:** patient books on mobile at Town/Saridar → pays → gets SMS + confirmation →
receptionist sees it on web dashboard and confirms. Closed loop = model proven.

---

## Shipped

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
