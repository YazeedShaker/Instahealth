# SPEC · F01 — Patient Phone-OTP Authentication (Mobile)

> Hand this to Claude Code. Read `CLAUDE.md`, `PRODUCT.md`, `PROGRESS.md` (F01 hand-off notes),
> `DECISION-navigation-safe-areas.md`, and the design handoff bundle first.
> Requires: SETUP-01 + CORE-01 merged. One PR. The SETUP-02 deploy-wiring verification may ride
> alongside in this cycle but in its own commits.

---

## Goal

The first real feature: a patient opens the app, sees the welcome screen, enters their Egyptian
phone number, receives an Arabic OTP SMS via Vonage, verifies, and lands on Home — with a session
that survives app restarts. First-time users add their name before Home. This is P0/MVP and the
front door for everything after it.

**This PR builds the auth flow only.** "Home" is a placeholder destination screen (F02 replaces it).

---

## Manual prerequisites (HUMAN steps — Claude Code: verify, do not attempt)

These are Supabase Dashboard settings the founder does before/while this PR runs:

1. **Auth → Providers → Phone:** enabled, SMS provider = **Vonage**, with Vonage API key/secret
   and sender ID configured. Sender displays as "InstaHealth".
2. **SMS template (Arabic):** `كود التحقق الخاص بك هو: {{ .Code }}`
3. **Test phone numbers with static OTPs** added in Auth settings (e.g. `+201000000001` → `123456`)
   — this is what unit-adjacent integration tests and Maestro E2E use. **CI never sends real SMS.**
4. **OTP settings:** 6-digit code, 60s minimum resend interval, rate limits tightened toward
   3 OTP requests / phone / hour (use the closest Supabase-supported configuration; document
   the actual configured values in the PR description).

If any of these are missing at runtime, the app must fail with the mapped Arabic error —
never a raw Supabase error string on screen.

---

## Design contract

The three onboarding screens (welcome, phone entry, OTP) were approved in DESIGN-01 and arrive
via the Claude Design → Claude Code handoff bundle. Build to them exactly:

- **RTL, Arabic-only UI** on all auth screens. Cairo font. Palette per design system
  (CTA `#02C39A`, cream `#F0F3BD`, etc. — tokens already in the SETUP-01 theme).
- **No tab bar on any auth screen** (`DECISION-navigation-safe-areas.md` Decision 1).
- **Every sticky/bottom CTA respects safe areas** (Decision 2) — insets via
  `useSafeAreaInsets`, never flush to the device edge.
- States per the approved mockups: empty, filled, error ("رقم غير صحيح"), loading.
- The name-entry screen (first-time users) was NOT mocked — build it from the design system:
  same layout skeleton as phone entry (one field, one sticky CTA "متابعة"), nothing inventive.

## Routes (Expo Router)

```
app/
├── (auth)/
│   ├── _layout.tsx        # no tab bar; redirects to (app) if session exists
│   ├── welcome.tsx
│   ├── phone.tsx
│   ├── otp.tsx            # receives phone as param
│   └── name.tsx           # first-time only
├── (app)/
│   ├── _layout.tsx        # tab bar shell; redirects to (auth)/welcome if no session
│   └── home.tsx           # PLACEHOLDER — greeting with user's name, logout button
└── index.tsx              # session check → route to (auth) or (app)
```

Route protection lives in the group layouts (session from the auth store), not per-screen.

## Flow logic

1. **Phone entry** — input accepts Arabic-Indic and Western numerals; validated and transformed
   with `phoneSchema` / `normalizeEgyptianPhone` from `@instahealth/core` (NO local validation
   logic). Inline error before submit. On submit → `supabase.auth.signInWithOtp({ phone })`.
2. **OTP screen** — 6 boxes (`OTP_LENGTH`), auto-advance, paste support, Arabic digits accepted
   and normalized (core `auth.schema`). 60s resend countdown (`OTP_RESEND_SECONDS`) — resend
   disabled until it hits 0. "Edit number" link returns to phone entry.
   Verify via `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`.
3. **Attempts** — after 3 failed verifications, lock the form client-side for 5 minutes with a
   calm Arabic message and countdown ("محاولات كثيرة — حاول مرة أخرى بعد ٥ دقائق"). Server-side
   limits remain whatever Supabase enforces; the client lockout is UX, not security.
4. **First-time vs returning** — after verify, read the patient's row in `users` (created by
   the existing DB trigger on first sign-in; do NOT insert from the client). If `full_name`
   is empty → name screen (updates the row via RLS-scoped update) → Home. Else → Home directly.
5. **Session** — client from core `createClient()` with AsyncStorage injected as the storage
   adapter (this is the F01 hand-off note from CORE-01); `autoRefreshToken` on. Kill/reopen
   the app → still signed in, straight to Home.
6. **Logout** — placeholder Home has a logout action: `signOut()`, clear state, → welcome.
7. **State** — one Zustand auth store: `{ session, profile, status }` + actions. TanStack Query
   for the profile fetch. No auth state duplicated in component state.

## Error mapping (Arabic, in one module `features/auth/errors.ts`)

Map every Supabase auth error path to a human Arabic message: invalid phone, OTP expired,
OTP wrong, rate-limited, network failure (with retry action). Unknown errors get a generic
"حدث خطأ — حاول مرة أخرى". Raw error strings never render. Log the raw error to console in
dev builds only.

## Analytics

None in this PR. PostHog wiring is its own later task — leave clearly named hook points
(`onOtpRequested`, `onSignupCompleted` comments) but add no dependency.

## Tests

**Unit (Vitest, `apps/mobile`):** error mapping table; lockout timer logic (3 fails → locked,
unlock at 5:00, `now` injected); resend countdown gating; routing decision (session × full_name
→ destination) as a pure function.

**E2E (Maestro, using the static test number):**

- [ ] Fresh install → welcome → phone → OTP `123456` → name entry → Home shows the name
- [ ] Relaunch app → lands on Home without re-auth
- [ ] Logout → welcome; sign in again → skips name entry (returning user)
- [ ] Wrong OTP ×3 → locked state visible
- [ ] Invalid phone (e.g. `013…`) → inline error, no request sent

## Acceptance criteria

- [ ] All 7 original F01 criteria pass: Egyptian number entry, Arabic OTP SMS (manual check on a
      real device with a real number), 60s resend countdown, first-time name screen, returning
      user straight to Home, session persists across restarts, logout returns to start
- [ ] Phone/OTP validation comes exclusively from `@instahealth/core` — zero local re-implementation
- [ ] RTL verified on device: layout mirrors correctly, no LTR leakage on any auth screen
- [ ] No tab bar on auth screens; sticky CTAs inside safe areas (screenshots in PR on a
      notched device)
- [ ] Session expiry mid-flow → redirected to auth with a message (booking-flow restore is F05's
      job — just don't crash)
- [ ] CI fully green including Maestro job with test phone numbers

## What NOT to do

- No real SMS from CI or tests — static test numbers only.
- No custom OTP tables/functions — Supabase Auth's phone flow is the mechanism.
- No email, no social logins, no password anything for patients.
- No Home/discovery content — placeholder only; F02 owns that screen.
- No English UI on auth screens — Arabic-only per the approved designs.

## When done

Update `PROGRESS.md` (Shipped entry + notes for F02: the auth store shape, how to read the
current profile, the route-group pattern). F02 (Home & Discovery) is next and consumes the
approved Home mockup via its own design handoff.
