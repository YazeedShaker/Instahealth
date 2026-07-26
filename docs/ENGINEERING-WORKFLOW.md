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
- **`instahealth_slot_allocation` = bookings per branch per DAY, not per
  slot.** Slots are generated as exactly `allocation` capacity-1 rows/day,
  evenly spread in opening hours (24/7 branches use a 09:00–21:00 daytime
  window). Enforced by `generate_branch_slots()` + the `slot_holds` capacity
  trigger (migration 20260726151039). Getting this backwards produced 240
  bookings/day at Town and let 5 patients hold the same slot.
- **Holds are created ONLY via the `create_slot_hold` RPC** — there is
  deliberately NO RLS INSERT policy on `slot_holds` (dropped in the same
  migration; the SECURITY DEFINER function bypasses RLS). Don't re-add one.

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

## 8 · When something isn't in this file

If you debug a toolchain/CI/platform trap that cost you more than one
attempt, append it to the relevant section here in the same PR. This file is
how sessions inherit each other's scars.

_Last updated: 2026-07-26 · Covers everything learned SETUP-01 → F04._
