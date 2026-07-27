# ENGINEERING-WORKFLOW.md — How every session ships

> Session-independent working agreements. CLAUDE.md defines WHAT we build;
> this file defines HOW a coding session operates — the habits and hard-won
> gotchas that don't live in any one chat's memory. Read it at session start
> alongside CLAUDE.md. When you learn a new trap the hard way, ADD IT HERE
> in the same PR.

---

## 1 · Session bootstrap (before writing any code)

1. Read `CLAUDE.md`, `PRODUCT.md`, `PROGRESS.md` (newest Shipped entry = where
   things stand + hand-off notes for you), every `docs/DECISION-*.md` the spec
   references, the spec itself, and the design handoff bundle if one exists
   (`design/<feature>/` — read the `.dc.html` source, don't screenshot it).
2. Check `git status` + `gh pr list` — know what's merged, what's open, and
   whether the working tree carries untracked files staged for you.
3. Verify spec claims against the LIVE database before building on them
   (specs have been wrong twice: a "users-row trigger" that didn't exist, a
   `full_name` column that was really `name_ar`). Query via the Supabase MCP;
   document any deviation in the PR **and** PROGRESS.
4. **Display state derives from the same predicate the DB enforces.** If the
   server rejects an action by some rule (capacity, expiry, status), the UI
   that showed it as possible must evaluate the SAME rule on the SAME data —
   expose what the client can't read (e.g. hold counts under RLS) via a
   SECURITY DEFINER read function rather than letting display drift.
   (Learned in F05: the picker showed "available" for a slot whose active
   holds only the DB could see.)

## 2 · Branch, commit, PR discipline

- One spec = one branch = one PR. Branch names: `feat/fNN-slug`,
  `fix/slug`, `core/NN-slug`.
- **Commit author MUST be `YazeedShaker <10588127+YazeedShaker@users.noreply.github.com>`**
  (repo-local git config already sets this — do not override it globally).
  Any other author email gets attributed to a different GitHub account and
  **Vercel BLOCKS the PR preview deploy**.
- Multi-line commit messages / PR bodies: write to a temp file and use
  `git commit -F` / `gh pr create --body-file` — inline here-strings with
  Arabic text or quotes break PowerShell argument parsing.
- PR body: acceptance-criteria checklist from the spec, judgment calls and
  spec deviations called out explicitly, manual founder steps listed.
- Merge only when ALL checks are green. Squash-merge. Update PROGRESS.md in
  the same PR (Shipped entry + risks + hand-off notes for the next feature).
- **Stacked PRs bite on merge**: a PR whose base is another feature branch
  only retargets to main if that base branch is DELETED when its PR merges.
  Otherwise "merging" the stacked PR merges it into the DEAD branch and the
  code silently never reaches main (happened with the realtime PR #13 —
  "merged" but absent from main). After merging a stack, verify with
  `git log origin/main` that every PR's changes actually landed. Prefer:
  merge base PR → delete its branch → confirm retarget → merge the stacked PR.

## 3 · Pre-push gate sequence (run ALL of it locally — never discover red in CI)

```
pnpm format               # ALWAYS FIRST — Prettier check is a separate CI gate
pnpm format:check
pnpm turbo lint typecheck test:unit --force
pnpm turbo build --force  # web build + mobile Metro export (iOS+Android)
pnpm audit --audit-level=high
```

- `--max-warnings=0` and `--coverage` are baked INTO workspace scripts.
  **Never** invoke `pnpm turbo X -- --flag` — pnpm swallows the `--` and turbo
  errors out (this broke CI on day one; the scripts pattern is the fix).
- Coverage thresholds are enforced in vitest configs (core: 95/95/95/90 on
  business + schemas + constants; currently at 100% lines). New core code
  needs tests that keep the bar — don't lower thresholds.
- **`beforeEach(() => spy.mockReset())` is a trap.** `mockReset()` RETURNS the
  mock, and vitest treats a function returned from `beforeEach` as the test's
  TEARDOWN — so it calls your mock after every test. With a mock that throws,
  the test fails with the mock's error while the assertion itself passed, and
  the reported line points at the mock setup. Always use a block body:
  `beforeEach(() => { spy.mockReset() })`.

## 4 · CI facts (so you don't re-debug them)

- Turbo strict env filtering: CI-provided env vars only reach tasks if listed
  in `turbo.json` `globalEnv`. Locally you won't notice (apps read
  `.env.local`) — CI will.
- Prettier ignores live in `.prettierignore` — design handoff bundles
  (`design/*/project`), `supabase/migrations|functions`, and the generated
  `database.ts` stay verbatim, never formatted.
- Gitleaks: `.env.example` is allowlisted via `.gitleaks.toml` (placeholder
  names only). Never commit a real key anywhere — `.env.local` files are
  gitignored at root, `apps/web/`, and `apps/mobile/`.
- CodeQL auto-skips while the repo is private (needs GHAS) — not a failure.
- New upstream advisories WILL land mid-PR and fail Dependency Audit (has
  happened three times: vitest/vite, postcss, brace-expansion). Fix order:
  ① bump the dep, ② pnpm override to the patched version — but TEST it
  (brace-expansion v5 broke minimatch), ③ if no viable patch path and the
  vulnerable code is build-tooling only, add the GHSA to
  `pnpm.auditConfig.ignoreGhsas` with a dated comment and a revisit note.

## 5 · Database changes (Supabase — live dev project `yesxxpkyelhyojkxgmcb`)

- DDL → MCP `apply_migration` (snake_case name), then save the SQL locally as
  `supabase/migrations/<returned-timestamp>_<name>.sql` (get the version from
  `list_migrations`). Data/seeds → `execute_sql`; seed files live in
  `supabase/seeds/`.
- Regenerate `database.ts` in the SAME PR as any migration (root
  `pnpm gen:types` or MCP `generate_typescript_types`). Note when the output
  is byte-identical (trigger functions don't surface in types).
- Seeds are IDEMPOTENT: fixed UUIDs + `ON CONFLICT` upserts. Prove it by
  running twice and comparing counts.
- **Bulk row generation must be SET-BASED SQL.** The per-row
  `generate_branch_slots()` loop exceeds the platform statement timeout at
  ~24 branches. One `INSERT … SELECT … generate_series` does 5k+ rows fine.
- Verify every applied change with a count/spot-check query before moving on.
- **Postgres grants EXECUTE on every new function to PUBLIC by default.** A
  SECURITY DEFINER function is therefore callable by any authenticated client
  the moment it exists — `confirm_booking()` was reachable straight from the
  app for four features (a patient could confirm their own pending booking
  without paying). If a function must be server-only, REVOKE it explicitly
  from PUBLIC/anon/authenticated and GRANT to service_role (migration
  20260727111326). Check with `pg_proc.proacl`, and assume nothing.
- **`pnpm gen:types` used to be `supabase gen types … > database.ts`.** The
  shell truncates the redirect target BEFORE running the command, so when the
  CLI is missing (it is not a repo dependency) the command fails and
  `database.ts` is left EMPTY — the whole workspace then fails to typecheck for
  a reason that looks nothing like the cause. It now runs
  `scripts/gen-types.mjs`, which generates to a buffer, sanity-checks it, and
  only then writes. The MCP `generate_typescript_types` tool is the fallback.
- **`instahealth_slot_allocation` = bookings per branch per DAY, not per
  slot.** Slots are generated as exactly `allocation` capacity-1 rows/day,
  evenly spread in opening hours (24/7 branches use a 09:00–21:00 daytime
  window). Enforced by `generate_branch_slots()` + the `slot_holds` capacity
  trigger (migration 20260726151039). Getting this backwards produced 240
  bookings/day at Town and let 5 patients hold the same slot.
- **Holds are created ONLY via the `create_slot_hold` RPC** — there is
  deliberately NO RLS INSERT policy on `slot_holds` (dropped in the same
  migration; the SECURITY DEFINER function bypasses RLS). Don't re-add one.
- **Realtime = DB-trigger broadcasts on private topics** (migration
  20260726205901): triggers call `realtime.send()` with MINIMAL payloads
  (ids only — postgres_changes would leak RLS-hidden rows or deliver
  nothing). Receive-side auth = SELECT policy on `realtime.messages` per
  topic prefix; no INSERT policy so clients can't spoof broadcasts. Gotcha:
  the FIRST realtime use on a project can fail with `MissingPartition` —
  the service creates its message partitions lazily (you CANNOT create them;
  schema is service-owned). Retry after a minute; it self-heals.

## 6 · Mobile (Expo) specifics

- **Pinned to Expo SDK 54 on purpose** — the App Store's Expo Go build is
  54-only and it's the founder's only test device path until the Apple
  Developer account lands. Re-upgrade path:
  `npx expo install expo@^57.0.0 --fix` (then re-run expo-doctor + gates).
  Don't "helpfully" upgrade before that unblocks.
- Add RN-adjacent deps with `npx expo install <pkg>` (version alignment),
  then fix stragglers per peer warnings. pnpm strict layout: some transitive
  runtime deps (e.g. `react-native-css-interop`) must be DIRECT mobile deps
  or Metro can't resolve them.
- The Supabase client is LAZY and SSR-safe (`lib/supabase.ts` Proxy) — don't
  reintroduce module-scope client creation; Expo web crashes on `window`.
- Auth E2E uses the static test number **+201000000001 / OTP 123456** (real
  session issued, no SMS). CI never sends real SMS.
- Every interactive element gets a `testID` — Maestro flows depend on them.
  Maestro yamls live in `apps/mobile/e2e/` (execution wiring is SETUP-02's
  remaining scope; keep flows correct regardless).
- App code never hardcodes hex — `colors.*` from `@instahealth/design-tokens`
  or NativeWind theme classes only.
- **LTR literals inside Arabic text get bidi-mangled** (found on device in the
  OTP screen): "+20 10 1234 5678" in an RTL sentence renders with its digit
  groups REVERSED. Any phone/code/latin ref rendered inside Arabic copy must
  go through core's `isolateLtr()` / `formatEgyptianPhoneDisplay()` (Unicode
  LRI…PDI isolates). Forcing `direction:'ltr'` on the container only works
  for standalone inputs, not inline text.
- **Device re-tests need: git pull + Metro restart + app reload.** A fix
  "still failing" 45 seconds after merge means the phone ran the OLD bundle
  (happened twice with the hold-release fixes — the merged code was fine).
  Before concluding a fix failed on device, confirm the test build actually
  contains it. And when a device symptom involves the DB, REPRODUCE THE EXACT
  CLIENT CALLS from Node with a real authenticated session (static test users
  - anon key) before touching more code — one script pinpointed in minutes
    what three blind iterations couldn't.
- **Client-side cleanup is an optimization, never a correctness requirement.**
  Anything that MUST happen (releasing holds, freeing resources) needs a
  server-side guarantee: one-hold-per-patient in `create_slot_hold`, row
  expiry, pg_cron sweeps. Navigation lifecycle events (`blur`, unmount) are
  unreliable on device — never hang correctness on them.
- **Keyboard handling** (per the Expo keyboard-handling guide, learned across
  two on-device rounds): the founder-approved behavior is the NATIVE one —
  keyboard slides OVER the app, no layout squeeze. For scrollable screens with
  inputs use `automaticallyAdjustKeyboardInsets` +
  `keyboardDismissMode="interactive"` + `keyboardShouldPersistTaps="handled"`
  on the ScrollView (see `booking/review.tsx`); a whole-screen
  `KeyboardAvoidingView` "pushes the button up" and was rejected. KAV remains
  OK only for small non-scroll screens where the CTA must stay visible while
  typing (`(auth)/otp.tsx`). The guide's full recommendation
  (`react-native-keyboard-controller` + KeyboardAwareScrollView) needs a DEV
  BUILD — it does NOT run in Expo Go, which is the founder's only device path
  until the Apple account lands. Adopt it together with the SDK re-upgrade.
- **Native modules must exist in Expo Go or they can't be tested at all.**
  F06's confirmation "Lottie moment" is built with RN `Animated` instead of
  `lottie-react-native` for this reason (the design bundle's own artifact is a
  CSS ring animation, so there was no Lottie file and no visual gain).
  `expo-calendar` WAS added — it ships inside Expo Go, so the founder can
  actually test it. Check that list before reaching for a native dep.
- **"Works on the phone, `Failed to fetch` on web" = a missing CORS preflight.**
  Expo's web target runs the SAME client code in a browser, so any Edge Function
  the app calls becomes cross-origin and gets an `OPTIONS` preflight first.
  `settle-payment` answered it with the `method !== 'POST'` guard — a bare 405
  with no `Access-Control-Allow-Origin` — and the browser surfaced
  `TypeError: Failed to fetch` from inside supabase-js, which looks like a
  network fault and reads nothing like CORS. Any function a CLIENT invokes needs
  an `OPTIONS` short-circuit + CORS headers on **every** response including
  errors. Cron/server-to-server functions (`send-sms`, `cleanup-holds`,
  `generate-slots`, `booking-reminder`) deliberately do NOT get them. Check the
  edge-function logs for `OPTIONS | 405` — it names the bug instantly.
- **Never clear a store that route guards read while navigating away from it.**
  On a confirmed booking, `reset()` cleared `selectedServices` too, so the flow
  layout rendered `<Redirect href="/home">` (empty selection) and the payment
  screen `<Redirect href="/slot">` (null hold) in the same commit as
  `router.replace('/confirmation')`. Three competing navigation intents wedged
  the navigator: the NEXT booking opened blank and unclickable, with no error to
  show for it. The fix is an explicit stand-down flag (`confirmedHandoff`) set in
  the SAME atomic update as the clear, lowered by the destination screen on
  mount. Do not rely on React's batching to win the race — make the guards
  suspend deliberately.
- **A native dep in `package.json` is only half-installed.** `expo-calendar` was
  added and used but never listed in `app.config.ts` `plugins`, so no
  `NSCalendars*UsageDescription` and no Android `READ/WRITE_CALENDAR` reached any
  real build. Expo Go hides this completely — it ships its own permission set, so
  the feature appears to work in the only environment we can currently test in.
  Adding a native module means: install it, add its config plugin WITH the Arabic
  permission copy, and note that Expo Go cannot verify the plugin.
- **A single `try/catch` around a multi-stage native call destroys the
  diagnosis.** `addBookingToCalendar` wrapped permission + calendar lookup +
  event creation in one `catch → 'error'`, so a device report of "تعذّرت
  الإضافة" was indistinguishable between three unrelated causes and cost a whole
  round-trip. Scope the handling per stage and log the real native error under
  `__DEV__` (same pattern as `settle.ts`).
- **A slot the patient just booked becomes invisible to them.** The `slots`
  SELECT policy is `booked_count < capacity`, so the moment `confirm_booking`
  increments a capacity-1 slot, its own booker can no longer read the row. Any
  post-confirmation screen must render from a SERVER-built payload (F06's
  `settle-payment` returns the whole confirmation DTO), never from a re-query.
  `get_branch_slots` is SECURITY DEFINER and still sees it — that is why the
  picker keeps working for everyone else.

## 7 · Core package discipline (quick reference)

- Platform imports (react / react-native / next / expo\*) are lint-ERRORS in
  core — the rule is enforced, don't fight it, move the code instead.
- Money math in integer piasters; missing/invalid commission rate THROWS.
- All date/time logic pinned to `Africa/Cairo` with `now` injected — tests
  use January dates (stable UTC+2, no DST ambiguity).
- Validation messages are stable KEYS resolved via
  `getErrorMessage(key, locale)` — one bilingual pattern everywhere.
- Arabic digit rendering (`toArabicDigits`, `formatTimeShortAr`,
  `formatDistanceAr`) lives in core — never re-implemented in an app.
- Type badge for providers is DERIVED from branch categories (scans →
  مستشفى, labs-only → معمل تحاليل) — there is no provider-type column yet.
- **Edge Functions CANNOT import `packages/core`** — they are standalone Deno
  modules deployed on their own. Anything they share with core is MIRRORED by
  hand (`send-sms` already did this for phone rules; `settle-payment` now
  mirrors the phone, date/time, preparation and SMS-template helpers). The
  rules that keep this honest: mark every copy `MIRRORS core <path> <name>`,
  keep the core original unit-tested so the copy has an authority to match,
  and change both sides in the SAME PR. Treat a growing mirror as a smell.
- **SMS copy must be measured against REAL data, not just the length cap.**
  The confirmation SMS composed fine and stayed under 140 chars — by silently
  dropping the fasting instruction, because the seeded service notes are
  written for a screen ("صيام من ٨ إلى ١٢ ساعة قبل التحليل. يُسمح بشرب الماء
  فقط.") and never fit. SMS now sends the CONSOLIDATED rule from
  `formatPrepSmsNoteAr` ("صيام ١٢ ساعة قبل الموعد") and the app holds the
  detail. Print the actual message in verification scripts and read it.

## 8 · When something isn't in this file

If you debug a toolchain/CI/platform trap that cost you more than one
attempt, append it to the relevant section here in the same PR. This file is
how sessions inherit each other's scars.

_Last updated: 2026-07-27 · Covers everything learned SETUP-01 → F06 (incl. the F06 device-test round)._
