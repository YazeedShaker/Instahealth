# SPEC · CORE-01 — Shared Core Package (`packages/core`)

> Hand this to Claude Code. Read `CLAUDE.md` and `PRODUCT.md` first. SETUP-01 must be merged.
> One PR. All CI gates must pass before merge. Pure logic only — NO UI, NO screens, NO React.

---

## Goal

Fill `packages/core` (scaffolded empty in SETUP-01) with everything both apps share:
database types, Zod validation schemas, the Supabase client factory, business logic,
and constants. This package is the single source of truth for all domain logic.
`apps/mobile` and `apps/web` import from it and never re-implement any of it.

**The test for every line of code in this PR:** "Would both apps need this?"
If yes → it belongs here. If it renders anything or touches a platform API → it does not.

---

## Hard rules (from CLAUDE.md — enforced in review)

- **No React, React Native, Next.js, or DOM imports anywhere in `packages/core`.**
  Core must compile and run in Node (Vitest), Metro (Expo), and Next.js server unchanged.
- **No `any`.** `unknown` + narrowing, or a real type. `any` fails CI.
- **No env access inside core.** The client factory takes config as arguments;
  the apps read their own env and inject it. Core never reads `process.env` directly.
- **The service role key never appears in this package** — not as a default, not in tests,
  not in comments with real values. Server-only code paths receive it by injection only.
- **Core never bypasses RLS and never mutates booking state directly.** All state-changing
  booking operations go through the Postgres functions (`confirm_booking()`,
  `create_slot_hold()`, `cancel_booking()`) via RPC. Core wraps the RPC calls; it does not
  reimplement their logic in TypeScript.
- Immutability, early returns, named constants, verb-noun function names, try/catch on every
  async function that can fail — per CLAUDE.md §5.

---

## Package structure to build

```
packages/core/
├── src/
│   ├── types/
│   │   ├── database.ts          # GENERATED — supabase gen types (do not hand-edit)
│   │   ├── helpers.types.ts     # Tables<'bookings'>, TablesInsert<...>, Enums<...> helpers
│   │   └── domain.types.ts      # Domain types built on top of DB rows (see §2)
│   ├── schemas/
│   │   ├── phone.schema.ts
│   │   ├── auth.schema.ts       # OTP request / verify
│   │   ├── booking.schema.ts    # service selection, slot choice, booking creation
│   │   ├── review.schema.ts
│   │   └── common.schema.ts     # pagination, ids, coordinates
│   ├── client/
│   │   ├── createClient.ts      # factory — anon-key client (both apps)
│   │   └── createServiceClient.ts  # factory — service-role client (server only; see §3)
│   ├── business/
│   │   ├── preparation.ts       # computePreparationNotes() — see §4.1
│   │   ├── slots.ts             # slot availability + hold display math — see §4.2
│   │   ├── pricing.ts           # booking total + commission — see §4.3
│   │   ├── phone.ts             # normalizeEgyptianPhone, isValidEgyptianPhone — see §4.4
│   │   └── format.ts            # formatEGP, formatArabicDate, formatSlotTime — see §4.5
│   ├── constants/
│   │   └── index.ts             # see §5
│   └── index.ts                 # barrel export — everything public goes through here
├── package.json                 # name: @instahealth/core — TS source, no build step
├── tsconfig.json                # extends root strict config
└── vitest.config.ts
```

Consumed as TypeScript source via the workspace (Next.js `transpilePackages`, Metro monorepo
config from SETUP-01). No tsup/build step — keep it simple.

---

## 1 · Database types (generated)

- Run against the live dev project:
  `supabase gen types typescript --project-id <ref> > packages/core/src/types/database.ts`
  (or `--local` if working from the migrations — the result must match the live schema).
- Add `helpers.types.ts` with the standard convenience aliases:
  `Tables<'bookings'>`, `TablesInsert<'bookings'>`, `TablesUpdate<'bookings'>`, `Enums<...>`.
- Add a `pnpm gen:types` script at the repo root that regenerates the file.
  **Rule (already in CLAUDE.md): every migration is followed by regeneration in the same PR.**

## 2 · Domain types

Thin, readable types the apps actually use, composed from DB rows — e.g.:

- `SelectedService` — the shape the booking flow passes around:
  `{ id, nameAr, nameEn, priceEgp, preparationNotesAr, preparationNotesEn, fastingHours }`
  (`fastingHours: number | null` — parsed once from the service row, not re-parsed in UI).
- `PreparationNote` — output of `computePreparationNotes()` (see §4.1).
- `SlotView` — what the slot picker renders: `{ id, startsAt, endsAt, status }` where
  `status: 'available' | 'full'` is computed, never guessed in the UI.
- `BookingSummary` — what confirmation + history screens show.

Do NOT duplicate DB row shapes wholesale — domain types exist where the app shape
legitimately differs from the row shape (parsed, joined, or narrowed).

## 3 · Supabase client factory

- `createClient(config)` — takes `{ url, anonKey, storage? }`. The optional `storage`
  adapter is how React Native injects AsyncStorage for session persistence while web
  uses its default. This is the ONLY platform variance allowed, and it's injected —
  core imports neither AsyncStorage nor anything from RN.
- `createServiceClient(config)` — takes `{ url, serviceRoleKey }`. JSDoc must state:
  **server-only (API routes / server actions / Edge Functions), never imported by
  mobile code or client components.** The `security.yml` client-secret-guard enforces
  this in CI; the import boundary is the convention it checks.
- Both return typed clients: `SupabaseClient<Database>`.

## 4 · Business logic (the heart of this PR — all pure, all unit-tested)

### 4.1 `computePreparationNotes(selectedServices: SelectedService[]): PreparationResult`

Implements the locked Decision 3/3a (see `docs/DECISION-provider-data-model.md`):

- Considers ONLY the selected services. No branch-level blanket notes.
- Returns `{ summaryAr, summaryEn, details, requiresFasting, fastingHours }` where
  `details` is one entry per selected service that has a preparation note.
- **Fasting consolidation: longest fast wins.** If selections require 8h and 12h fasting,
  `fastingHours` is `12` and the summary mentions fasting ONCE. Per-service details still
  list each service's own instruction.
- Duplicate/equivalent notes are merged (same normalized text appears once in details).
- If NO selected service has preparation requirements, return a result whose
  `details` is empty and summaries are `null` — the UI shows nothing.
- Summary copy follows the locked pattern — it invites the expand action, never a dead end:
  `"بعض الخدمات المختارة تتطلب صياماً — اضغط لعرض التفاصيل"` (fasting variant) /
  a non-fasting variant when only non-fasting prep exists. Copy strings live here in core
  (one source of truth for selection screen, confirmation screen, and reminder SMS).

### 4.2 `slots.ts` — display/selection math only (authority stays in Postgres)

- `getSlotStatus(slot): 'available' | 'full'` — from capacity vs booked + active holds
  as returned by the query. Core does not count holds itself; it interprets the row.
- `holdExpiresAt(createdAt: Date): Date` — `createdAt + SLOT_HOLD_MINUTES`.
- `getRemainingHoldSeconds(expiresAt: Date, now: Date): number` — clamped at 0.
  Takes `now` as a parameter (testable, no hidden `Date.now()`).
- `isHoldExpiringSoon(remainingSeconds): boolean` — under `HOLD_WARNING_SECONDS`
  (drives the calm→amber timer state from the approved designs).
- Explicit comment block: **the DB functions are authoritative.** These helpers exist for
  rendering and optimistic UX only. A hold that looks valid client-side can still be
  rejected by `confirm_booking()` — the apps must handle that RPC error path.

### 4.3 `pricing.ts`

- `calculateBookingTotal(selectedServices): number` — sum of `priceEgp`. Prices are
  EGP integers per the schema; if any decimal amounts exist, work in piasters
  internally and round half-up at the boundary. No floating-point drift.
- `calculateCommission(totalEgp: number, commissionPercent: number): number` —
  pure math, 2-decimal-safe. **The rate is data, not code**: it comes from the
  provider/branch row in the DB (per-partner negotiated, 10–15% band). No default
  rate constant baked into logic — a missing rate is an error, not a silent fallback.
- `calculateProviderPayout(totalEgp, commissionPercent)` — total minus commission;
  the provider dashboard and future commission reports use the same function.

### 4.4 `phone.ts`

- `normalizeEgyptianPhone(input: string): string | null` — accepts the messy real-world
  forms: `01012345678`, `+201012345678`, `00201012345678`, `201012345678`, Arabic-Indic
  digits (`٠١٠١٢٣٤٥٦٧٨`), stray spaces/dashes. Returns E.164 (`+201012345678`) or `null`.
- `isValidEgyptianPhone(input: string): boolean` — valid Egyptian mobile prefixes
  (010/011/012/015) after normalization.
- This mirrors the normalization already living in the `send-sms` Edge Function — port the
  same rules so client validation and server SMS agree. If they diverge, the Edge Function
  should be updated to import/copy from this implementation in a follow-up.

### 4.5 `format.ts`

- `formatEGP(amount: number, locale: 'ar' | 'en'): string` — `ar-EG` / `en-EG` via `Intl`,
  currency EGP. Note from PRODUCT.md: currency codes/refs render in Latin
  (Atkinson Hyperlegible is applied by the UI — core just returns the string).
- `formatArabicDate(date: Date): string` — Arabic weekday + day + month (booking cards).
- `formatSlotTime(startsAt: Date, locale): string` — the time-strip label format from
  the approved designs.

## 5 · Constants (`constants/index.ts`)

```ts
export const SLOT_HOLD_MINUTES = 10
export const HOLD_WARNING_SECONDS = 120 // timer turns amber
export const SLOT_WINDOW_DAYS = 30 // generation lookahead (matches Edge Function)
export const DEFAULT_SLOT_ALLOCATION = 5 // informational — DB column is authoritative
export const BOOKING_REF_PREFIX = 'IH' // refs generated by DB trigger, never in TS
export const SMS_MAX_LENGTH = 140
export const CURRENCY = 'EGP'
export const EGYPT_DIAL_CODE = '+20'
export const OTP_LENGTH = 6
export const OTP_RESEND_SECONDS = 60
```

Every magic number in later feature code must trace back to a constant here.

## 6 · Zod schemas

All user input crosses a Zod schema before it touches the client SDK. Schemas carry
bilingual error messages: each schema exports `{ schema, messages: { ar, en } }` or uses
a shared `errorMap` — pick ONE pattern and use it everywhere (document the choice in code).

- `phone.schema.ts` — refines via `isValidEgyptianPhone`; transforms to E.164.
- `auth.schema.ts` — OTP request (phone) and verify (phone + 6-digit code; accepts
  Arabic-Indic digits and transforms to Western before validation).
- `booking.schema.ts` — service selection (min 1, all from the same branch),
  slot choice (uuid), booking creation payload matching the `create_slot_hold` /
  `confirm_booking` RPC inputs.
- `review.schema.ts` — rating int 1–5, comment optional with max length.
- `common.schema.ts` — uuid, pagination (limit/offset with sane caps), lat/lng bounds.

## 7 · Tests (Vitest — this is where the rigor lives)

`packages/core` target: **≥95% line coverage on `business/` and `schemas/`**. Required cases:

**preparation.ts**

- [ ] No selected services → empty result, null summaries
- [ ] Selections with no prep notes → empty result
- [ ] One fasting service → its hours, its detail, fasting summary
- [ ] 8h + 12h fasting selected → `fastingHours === 12`, fasting mentioned once, 2 details
- [ ] Fasting + non-fasting prep mixed → both represented, summary correct
- [ ] Duplicate notes across services → merged in details
- [ ] Arabic strings preserved exactly (no encoding mangling)

**slots.ts**

- [ ] Hold expiry math exact at boundaries (0 remaining, negative clamps to 0)
- [ ] Warning threshold flips at exactly `HOLD_WARNING_SECONDS`
- [ ] Status full when booked + holds reach capacity

**pricing.ts**

- [ ] Total sums correctly; empty selection → 0
- [ ] Commission at 10/12/15% on odd amounts — no floating point drift (e.g. 333 EGP @ 12%)
- [ ] Payout + commission === total for all tested cases
- [ ] Missing/invalid rate throws — never silently applies a default

**phone.ts**

- [ ] All accepted input forms above normalize to the same E.164
- [ ] Arabic-Indic digits normalize correctly
- [ ] 010/011/012/015 valid; 013, landlines, short/long strings → invalid
- [ ] Garbage input → null, never a throw

**schemas**

- [ ] Valid payloads pass and transform (phone → E.164, Arabic OTP digits → Western)
- [ ] Each invalid case yields the right bilingual message key

---

## Acceptance criteria

- [ ] `pnpm --filter @instahealth/core test` green with the coverage bar met
- [ ] `pnpm typecheck` green across the workspace — both apps compile importing core
- [ ] `database.ts` matches the LIVE dev schema (spot-check: `bookings`, `slots`,
      `branches.instahealth_slot_allocation` present)
- [ ] Zero React/RN/Next imports in core (add an ESLint `no-restricted-imports` rule
      for `react`, `react-native`, `next` scoped to `packages/core` — enforced, not hoped)
- [ ] `pnpm gen:types` script works and is documented in the package README
- [ ] Barrel export exposes the public surface; nothing imported from deep paths in apps
- [ ] CI fully green (lint zero warnings, typecheck, unit, build, security)

## What NOT to do

- No UI components, no hooks, no screens — that starts at F01.
- No API routes or server actions — those live in `apps/web` when features need them.
- Do not touch the database or migrations. (The `006_practitioners.sql` doctor layer is
  a separate spec — not this PR.)
- Do not reimplement `confirm_booking()` / hold logic in TypeScript.
- Do not add speculative helpers "we might need" (YAGNI) — this spec's list is the scope.

## When done

Update `PROGRESS.md`: move CORE-01 to Shipped with date, note the coverage number,
the bilingual-error pattern chosen (§6), and anything F01 needs to know.
Flag: F01 (phone OTP auth) is next — it consumes `auth.schema.ts`, `phone.ts`,
and `createClient()` from this package.
