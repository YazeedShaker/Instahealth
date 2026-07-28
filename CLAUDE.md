# CLAUDE.md — InstaHealth Platform

> This is the master context file for Claude Code. Read this fully before writing any code.
> It defines the architecture, conventions, and non-negotiable rules for the entire platform.
> When in doubt, follow this document over any other instinct.

> **Also read `docs/ENGINEERING-WORKFLOW.md` before writing code** — it defines
> HOW sessions operate: gate sequence, commit/PR rules, DB-change procedure,
> and the accumulated toolchain gotchas. CLAUDE.md is the what; that file is the how.

---

## 1. What we are building

InstaHealth is a **healthcare booking marketplace for Egypt** — the "Talabat for healthcare."
Patients open the app, find a nearby medical service (lab test, scan, or doctor appointment),
book a real time slot, pay digitally, and get a confirmed booking. The platform earns commission
per booking.

**Launch partners (already committed):**

- **Town Hospital** — full hospital in New Cairo / Fifth Settlement (104+ consultants, 30+ specialties, 24/7 labs & radiology). Doctor appointments + scans + labs.
- **Saridar Labs** — lab chain. Lab tests.

**MVP scope:** Labs + Scans + Doctor appointments. Greater Cairo only. Arabic-first.

**The model that makes this work:** We do NOT integrate with provider CRMs. At onboarding, each
provider gives InstaHealth a **dedicated allocation of time slots** (e.g. 5 per day per branch) that
are ring-fenced for InstaHealth patients. The provider keeps taking phone/walk-in bookings in their
other slots. Our calendar only shows OUR allocated slots. This means instant confirmation with zero
integration. The allocation grows as we prove we can fill it.

---

## 2. Tech stack (do not deviate without updating this file)

**We are mobile-first.** The patient app is a native mobile app (React Native + Expo) — that is THE
product. The web app is the provider dashboard + admin panel (desktop tools) plus, later, a public
patient PWA for SEO/discovery. Build order reflects this — see §11.

| Layer                     | Choice                                                                  | Notes                                                                |
| ------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **Patient app**           | **React Native + Expo (SDK 52+)**                                       | THE main product. Expo Router, EAS Build                             |
| **Web (dashboard/admin)** | **Next.js 15** (App Router)                                             | Provider dashboard, admin panel, later patient PWA                   |
| Language                  | **TypeScript** (strict mode)                                            | No `any`. Ever.                                                      |
| Monorepo                  | **Turborepo + pnpm workspaces**                                         | Shared core between mobile and web                                   |
| Database                  | **Supabase** (PostgreSQL 15)                                            | Already provisioned — see §6                                         |
| Auth                      | **Supabase Auth**                                                       | Patients: phone OTP. Providers: email/password. Admin: email + TOTP  |
| Styling (mobile)          | **NativeWind v4** (Tailwind for RN) + design tokens                     | RTL via `I18nManager`. Same tokens as web                            |
| Styling (web)             | **Tailwind CSS v4** + design tokens                                     | RTL-first. Tokens from `packages/design-tokens`                      |
| State (server)            | **TanStack Query v5**                                                   | All server data — works in both RN and web                           |
| State (client)            | **Zustand**                                                             | Booking flow, UI state only — works in both                          |
| Forms                     | **React Hook Form + Zod**                                               | Zod schemas live in shared core                                      |
| Payments                  | **PayTabs**                                                             | Hosted payment page + IPN. NOT INTEGRATED — mock provider ships (§8) |
| SMS                       | **Vonage**                                                              | Arabic Unicode, via Supabase Edge Function                           |
| Maps                      | **react-native-maps** (mobile) / **Google Maps JS** (web)               | Branch discovery                                                     |
| Push (mobile)             | **Expo Notifications**                                                  | Booking updates, reminders (complements SMS)                         |
| Hosting (web)             | **Vercel**                                                              | Dashboard/admin + preview deploys                                    |
| Distribution (mobile)     | **EAS Build + App Store + Play Store**                                  | Apple $99/yr, Google $25 one-time                                    |
| Analytics                 | **PostHog**                                                             | RN + web SDKs. Product analytics, funnels                            |
| Testing                   | **Vitest** (unit) · **Playwright** (web E2E) · **Maestro** (mobile E2E) | See §9                                                               |
| CI/CD                     | **GitHub Actions → Vercel + EAS**                                       | Blocking gates — see §9                                              |

---

## 3. Monorepo structure

```
instahealth/
├── apps/
│   ├── mobile/                 # ⭐ React Native + Expo — THE patient app (primary product)
│   │   ├── app/                # Expo Router (file-based routing)
│   │   │   ├── (auth)/         # Phone OTP onboarding
│   │   │   ├── (tabs)/         # Home, Search, Bookings, Profile (bottom tabs)
│   │   │   ├── branch/[id].tsx # Branch profile
│   │   │   ├── booking/        # Booking flow screens
│   │   │   └── _layout.tsx     # Root — RTL via I18nManager, fonts, providers
│   │   ├── components/         # RN components (using NativeWind + tokens)
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── app.config.ts       # Expo config
│   │   └── eas.json            # EAS Build profiles (dev, preview, production)
│   └── web/                    # Next.js — provider dashboard + admin (+ later patient PWA)
│       ├── app/
│       │   ├── (provider)/     # Provider dashboard (Town Hospital, Saridar staff)
│       │   ├── (admin)/        # Admin panel (you + Mohamed)
│       │   ├── (patient-web)/  # Public patient PWA — LATER (SEO/discovery surface)
│       │   ├── api/            # Route handlers (webhooks, server-only)
│       │   └── layout.tsx
│       ├── components/
│       │   ├── ui/             # Web primitives — from design system
│       │   ├── provider/
│       │   └── admin/
│       ├── hooks/
│       └── lib/
├── packages/
│   ├── core/                   # ⭐ SHARED — imported by BOTH mobile and web
│   │   ├── types/              # DB types, domain types
│   │   ├── schemas/            # Zod validation schemas
│   │   ├── api/                # Supabase client factory, typed queries
│   │   ├── business/           # Pure business logic (slot math, commission, booking rules)
│   │   └── constants/          # Shared constants (governorates, categories…)
│   ├── design-tokens/          # Colors, typography, spacing (CSS + TS + RN)
│   └── config/                 # Shared tsconfig, eslint, prettier
├── supabase/                   # Migrations + edge functions (already built)
├── docs/                       # Specs, decisions, briefs — see §3a
├── design/                     # Claude Design handoff bundles — see §3a
├── CLAUDE.md                   # This file — at the ROOT, not in docs/
├── PRODUCT.md                  # Design decisions, contrast rules, UX guidelines
├── PROGRESS.md                 # Living log — update after every feature
└── turbo.json
```

**The golden rule of the monorepo:** Any logic that both apps need goes in `packages/core`, NOT in
`apps/mobile` or `apps/web`. Types, validation, API calls, business rules — all shared. The mobile
app and web app are just different _presentation shells_ over the same core. If you write a Zod
schema, a type, or a booking calculation inside an app instead of core, you have made a mistake.

**Mobile vs web split of responsibilities:**

- `apps/mobile` — the patient experience. Discovery, booking, confirmation, history, profile. Native.
- `apps/web` — provider dashboard (receptionists confirming bookings) + admin panel. Desktop tools.
  The patient PWA on web comes much later as an SEO/discovery surface, not the primary experience.

---

## 3a. Repository structure — `docs/` and `design/`

Written artifacts are filed **by type**, and design bundles **by surface**. Numbered as `3a` on
purpose: cross-references across the repo cite `CLAUDE.md §8`, `§11`… and renumbering would break
every one of them.

```
docs/
├── ENGINEERING-WORKFLOW.md   # stays at docs/ ROOT — the one file everything reads
├── specs/                    # SPEC-SETUP-*, SPEC-CORE-*, SPEC-F*, SPEC-P*
├── decisions/                # DECISION-*
├── design-briefs/            # DESIGN-01, DESIGN-02
└── data/                     # seed-source tables (saridar branches…)

design/                       # Claude Design handoff bundles, one folder per handoff
├── mobile/                   # onboarding · home · branch-profile · booking · confirmation · bookings
├── dashboard/                # DESIGN-02 handoff; P02+ screens
├── admin/                    # A-series (empty)
└── brand/                    # logo set once approved (empty)

CLAUDE.md · PRODUCT.md · PROGRESS.md    # repo ROOT
```

**Two rules:**

1. **The three root docs never move.** `CLAUDE.md`, `PRODUCT.md` and `PROGRESS.md` live at the
   repository root, and `docs/ENGINEERING-WORKFLOW.md` stays at the root of `docs/`. Every session
   and every spec opens these by path; moving them breaks the bootstrap in §1 of the workflow doc.
2. **New artifacts land in their typed folder** — a new spec goes to `docs/specs/`, a new decision
   to `docs/decisions/`, a new design brief to `docs/design-briefs/`, seed-source data to
   `docs/data/`. New handoff bundles go under the surface they belong to: dashboard screens to
   `design/dashboard/`, admin to `design/admin/`. Never at the root of `docs/` or `design/`.

Note for tooling: handoff bundles are Prettier-ignored via `design/*/*/project` — the glob has one
segment per level, so it only works while bundles sit at `design/<surface>/<handoff>/project`.

## 4. The shared-core discipline (critical — two apps, one core)

We build the mobile patient app AND the web dashboard/admin. They share one core to avoid duplicating
logic. This discipline is what makes two apps sustainable.

**Goes in `packages/core` (platform-agnostic — no DOM, no React Native, no React DOM):**

- All TypeScript types and interfaces
- All Zod schemas (validation)
- Supabase client creation + all typed database queries
- Business logic: slot availability math, commission calc, booking state machine, price totals
- Constants: service categories, governorates, Egyptian phone validation, SMS templates
- Pure formatting helpers (Arabic date formatting, EGP currency, phone normalization)

**Stays in `apps/mobile` (React Native only):**

- RN screens and components (Expo Router, `<View>`, `<Text>`, NativeWind)
- Native APIs (location, push notifications, secure storage, camera)
- Mobile navigation

**Stays in `apps/web` (web only):**

- React DOM components (`.tsx` with DOM), Next.js routing, server actions
- Tailwind styling, browser APIs

**Test:** before writing a function, ask "will both apps need this exact logic?" If yes → `core`.
Business logic and data access must be identical between a patient booking on mobile and an admin
viewing that booking on web — so it lives in core, written once.

**Design tokens are shared too:** `packages/design-tokens` exports values consumable by NativeWind
(mobile), Tailwind (web), and raw TS. One palette, one type scale, both apps.

---

## 5. Naming & code conventions

Follow these exactly. They match our `coding-standards`.

- **Components:** PascalCase — `BookingCard.tsx`, `SlotPicker.tsx`
- **Hooks:** camelCase with `use` — `useBookingFlow.ts`, `useSlotAvailability.ts`
- **Utils:** camelCase — `formatArabicDate.ts`, `normalizeEgyptianPhone.ts`
- **Types:** camelCase file with `.types.ts` — `booking.types.ts`
- **Schemas:** camelCase with `.schema.ts` — `booking.schema.ts`
- **Variables:** descriptive — `selectedSlotId` not `s`. `isBookingConfirmed` not `flag`.
- **Functions:** verb-noun — `fetchBranchSlots()`, `calculateCommission()`, `isValidEgyptianPhone()`
- **No `any`.** Use `unknown` and narrow, or define the type. `any` fails CI.
- **Immutability:** always spread, never mutate. `{...booking, status}` not `booking.status =`.
- **Early returns** over deep nesting (max 3 levels).
- **Named constants** over magic numbers. `const SLOT_HOLD_MINUTES = 10`.
- **Error handling:** every async fn that can fail has try/catch. Never swallow errors silently.
- **`Promise.all`** for independent async calls, never sequential awaits.

---

## 6. Database (Supabase — already built)

The database is LIVE on Supabase project `instahealth-dev` (Frankfurt, eu-central-1).
**Do not recreate it.** Migrations are in `/supabase/migrations`. 15 tables, RLS enabled.

Key tables: `users`, `providers`, `branches`, `service_categories`, `services`,
`branch_services`, `slots`, `slot_holds`, `bookings`, `booking_services`, `payments`,
`reviews`, `provider_users`, `admin_users`, `notifications`.

**Critical database rules:**

- **Never bypass RLS from the client.** The anon key respects RLS. The service role key
  (server-only, never in client bundle) bypasses it — use only in API routes / server actions.
- **Booking confirmation is atomic** — always via the `confirm_booking()` Postgres function.
  Never confirm a booking by updating rows individually from the app. The function does:
  validate → increment slot → confirm booking → insert payment → delete hold, in ONE transaction.
- **Slot holds** — creating a hold uses `create_slot_hold()` (10-min expiry). A cron Edge Function
  (`cleanup-holds`) releases expired holds every 5 minutes.
- **Slots are generated** by `generate_branch_slots()` using each branch's
  `instahealth_slot_allocation` as capacity. Nightly cron keeps a 30-day window.
- **Booking refs** auto-generate as `IH-2026-XXXXX` via trigger.
- **Always regenerate types after a migration:** `supabase gen types typescript` → `packages/core/types/database.ts`

**Provider services, categories & preparation notes:** How branches expose services across
categories, how we surface only active categories, and how per-service preparation notes are computed
from the patient's selection are all defined in **`docs/decisions/DECISION-provider-data-model.md`**. Read it
before building F04, F05, P04, A02, or A03. Summary: branch profile renders services **grouped by
category** (multi-category from day one — Town Hospital has labs + scans + doctors); only categories
with `is_active = true` are shown/bookable (launch a category by flipping the flag); preparation notes
are **per-service, computed from the current selection** via a shared `computePreparationNotes()`
function in `packages/core/business` (longest fast wins, duplicates merged, shown only when relevant,
reused at selection + confirmation + SMS).

**The doctor-appointment layer (NEW — needs a migration):** The current schema handles slot-based
labs/scans well. Doctor appointments need a `practitioners` table (doctor profiles, specialty,
consultation types/fees) and doctor-specific slots keyed to a practitioner, not just a branch.
Spec this as migration `006_practitioners.sql` before building doctor booking. Until that migration
exists, build labs + scans first (they share one mechanic).

---

## 7. Arabic / RTL rules (non-negotiable)

This is an Arabic-first product. Get this wrong and the whole app feels broken to users.

**Mobile (React Native) — RTL via `I18nManager`:**

- RN handles RTL at the layout engine level. Force it on with `I18nManager.forceRTL(true)` and
  `allowRTL(true)` at app startup so the patient app is always RTL regardless of device locale.
- Use **logical layout props** — `start`/`end`, `marginStart`/`marginEnd`, NOT `left`/`right`.
  RN flips these automatically under RTL. Hardcoded `left`/`right` break RTL.
- **Cairo** is the patient app font. Load via `expo-font`. Atkinson Hyperlegible for English strings.
- Test on a real device — the simulator sometimes lies about RTL. Icons that imply direction
  (back arrows, chevrons) must flip; use RN's built-in flipping or check `I18nManager.isRTL`.
- Changing `forceRTL` requires an app reload — set it once, early, before first render.

**Web (dashboard/admin) — RTL via `dir`:**

- Provider/admin surfaces may be LTR (staff are comfortable with standard layout). The future
  patient PWA on web is RTL via `dir="rtl"` and Tailwind logical properties (`ms-*`/`me-*`).

**Both platforms:**

- Phone input accepts both Arabic (٠١٢) and Western (012) numerals.
- All SMS in Arabic Unicode. Egyptian format `01X XXXX XXXX` → normalize to `201XXXXXXXXX` (in core).
- Arabic dates via the shared `formatArabicDate()` helper (in core), never raw locale formatting.
- Currency always shows "EGP" / "ج.م" explicitly, never a bare number.

---

## 8. Security rules (enforced by CI + review)

- **Secrets:** never in code. `.env.local` for dev (gitignored), Vercel env vars for prod,
  Supabase secrets for Edge Functions. CI secret-scanning blocks commits containing keys.
- **Service role key** never ships to the client. It lives only in server code (route handlers,
  server actions, Edge Functions). If it appears in a client component, CI fails.
- **All input validated with Zod** at the boundary — API routes and server actions parse with a
  schema before touching the DB. Never trust client input.
- **PayTabs IPN callbacks** must verify the signature before acting. No exceptions.
  (Provider decision CHANGED from Paymob to PayTabs. **No PayTabs account or
  credentials exist yet** — the legal entity is pending — so payments are
  currently SIMULATED by `MockPaymentProvider`. The real integration plugs into
  `packages/core/src/business/payment-paytabs.ts`, which documents exactly what
  is needed. PayTabs Egypt's method lineup differs from the approved design's:
  it has no Fawry and no Vodafone Cash — final lineup is an open product
  decision.) The **PayTabs Server Key is server-only** — it lives in Supabase
  Edge Function secrets and must never reach the Expo bundle.
- **Booking confirmation is server-only.** `confirm_booking()` is executable by
  `service_role` alone (migration 20260727111326); the ONLY caller is the
  `settle-payment` Edge Function. Clients have no grant on it and no INSERT
  policy on `payments` — a booking cannot be confirmed from the app.
- **RLS is the security backbone** — every table has policies. Test them. A patient must never be
  able to read another patient's bookings.
- **Rate limit** OTP requests (3/phone/hour) and booking creation.
- **PII discipline:** patient phone numbers and names are sensitive. Never log them in plaintext,
  never put them in URLs or query strings, never send to analytics.

---

## 9. Testing & CI/CD (full rigor — blocking gates)

Every PR must pass ALL of these before merge to `main`. Red = no merge.

**Pipeline (GitHub Actions):**

1. **Install & cache** (pnpm)
2. **Lint** — ESLint, fails on warnings (mobile + web + core)
3. **Typecheck** — `tsc --noEmit`, strict, no `any`
4. **Unit tests** — Vitest, business logic in `packages/core` must have coverage
5. **Build** — web builds clean; mobile type-checks + Expo prebuild succeeds
6. **E2E tests** — Playwright (web dashboard/admin flows) + Maestro (mobile patient flows)
7. **Security scan** — `pnpm audit` (deps) + secret scanning (gitleaks) + CodeQL
8. **Preview deploy** — Vercel preview per PR (web); EAS preview build on demand (mobile)
9. **Production gate** — merge to `main` → web to Vercel, mobile via EAS Build to stores

**Mobile-specific CI notes:**

- Mobile E2E uses **Maestro** (simpler than Detox for RN flows) against an Expo dev build.
- EAS builds are heavier — don't run a full store build on every PR. Run type/lint/unit + a Maestro
  smoke on PRs; trigger EAS `preview` builds on demand and `production` builds on release tags.
- App store submission is gated and manual-approved — never auto-submit to Apple/Google from CI
  without a human release step.

**Testing discipline:**

- **Business logic** (`packages/core/business`) — unit tested thoroughly. Slot math, commission,
  booking state transitions, price totals. This is where bugs cost money. AAA pattern. Shared by both apps.
- **Components** — test behavior, not implementation. React Testing Library (web) / RN Testing Library (mobile).
- **E2E — the money paths:** full booking flow, payment success, payment failure, slot conflict,
  cancellation. Mobile E2E in Arabic RTL is the primary; web E2E covers provider confirm + admin.
- **Test names describe behavior:** `test('releases slot hold when payment times out')` not `test('works')`.

---

## 10. How we work together (Yazeed + Claude + Claude Code)

- **I (architect)** write feature spec files. Each spec is self-contained: what to build, files to
  create, acceptance criteria, edge cases, test requirements.
- **You (Yazeed)** hand specs to Claude Code, which implements.
- **After each feature ships:** update `PROGRESS.md` (what shipped, decisions made, what's next).
  This lets any session resume anywhere.
- **One feature = one PR = one spec.** Keep PRs reviewable. No 40-file mega-merges.
- **Specs reference this file.** Claude Code should read `CLAUDE.md` + `PRODUCT.md` before each feature.

---

## 11. Build order (the critical path — mobile-first)

**Design step (before coding the patient app):** Do a **Claude Design** pass on the core patient
screens (home/discovery, branch profile, 4-step booking flow, confirmation) — mobile frames, Arabic
RTL, using our exact palette and fonts. Get co-founder sign-off. Approved designs become the visual
contract the specs reference. Mock only the ~6 core patient screens; provider/admin follow the design
system directly.

1. **Scaffold** — monorepo, Turborepo, pnpm, tsconfig, ESLint, Prettier, tokens, CI skeleton.
   Sets up BOTH `apps/mobile` (Expo) and `apps/web` (Next.js) shells + `packages/*`.
2. **Core package** — types (from DB), Zod schemas, Supabase client, business logic, constants.
   Built and unit-tested first because both apps depend on it.
3. **Mobile: Auth (F01)** — phone OTP onboarding in the Expo app (everything depends on identity).
4. **Mobile: Discovery (F02–F04)** — home, map/list, search, branch profile.
5. **Mobile: Booking (F05–F06)** — service select, slot picker + 10-min hold, payment, confirmation.
   This is the money path and the core milestone: a real patient booking a real slot at Town/Saridar.
6. **Web: Provider dashboard (P01–P06)** — MUST land around the same time as mobile booking, because a
   patient booking is useless until a Town/Saridar receptionist can see and confirm it. Build the
   live-bookings + management screens in parallel with F05–F06.
7. **Mobile: History & profile (F07–F09)** — bookings list, cancel, reviews, profile.
8. **Web: Admin (A01–A06)** — overview, provider onboarding, catalog, oversight (you + Mohamed).
9. **Doctor appointments** — `006_practitioners.sql` + doctor booking (after labs/scans proven).
10. **Polish** — error/empty/loading states, Arabic QA, performance, push notifications, PWA (web patient).

**First real milestone:** a patient installs the app, books a lab test at Saridar or a scan at Town
Hospital, pays, gets an SMS + confirmation — and the receptionist sees it on the web dashboard and
confirms. That closed loop (mobile patient ↔ web provider) is the proof the whole model works.

Do not build ahead of the current step. The mobile patient app is the product; the web dashboard is
the minimum needed to close the loop. Everything else follows.

---

## 12. Definition of done (per feature)

A feature is DONE when:

- [ ] All acceptance criteria in its spec pass
- [ ] (Mobile) Works on a real device — iOS and Android — not just the simulator
- [ ] (Mobile) Works in forced RTL via `I18nManager`; direction-implying icons flip correctly
- [ ] (Web) Works on a real desktop viewport; patient-web (when built) tested RTL
- [ ] Shared logic is in `packages/core`, not in an app
- [ ] Zod validation on all inputs
- [ ] Unit tests for business logic, E2E for user flows (Maestro mobile / Playwright web)
- [ ] No `any`, no console errors, no secrets in code
- [ ] All CI gates green
- [ ] `PROGRESS.md` updated

---

_Last updated: July 2026 · Keep this file current — it is the single source of truth for how we build._
