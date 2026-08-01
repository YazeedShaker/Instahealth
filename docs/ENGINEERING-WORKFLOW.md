# ENGINEERING-WORKFLOW.md — How every session ships

> Session-independent working agreements. CLAUDE.md defines WHAT we build;
> this file defines HOW a coding session operates — the habits and hard-won
> gotchas that don't live in any one chat's memory. Read it at session start
> alongside CLAUDE.md. When you learn a new trap the hard way, ADD IT HERE
> in the same PR.

---

## 1 · Session bootstrap (before writing any code)

1. Read `CLAUDE.md`, `PRODUCT.md`, `PROGRESS.md` (newest Shipped entry = where
   things stand + hand-off notes for you), every `docs/decisions/DECISION-*.md` the spec
   references, the spec itself (`docs/specs/`), and the design handoff bundle if
   one exists (`design/<surface>/<feature>/` — read the `.dc.html` source, don't
   screenshot it). Layout and the two filing rules: CLAUDE.md §3a.
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

5. **`git status` for UNTRACKED spec/design files before you plan.** SPEC-F07
   was sitting untracked in the working tree and half of F07 got built from the
   design bundle alone — which turned out to carry OUTDATED cancellation copy
   the spec explicitly supersedes. §1.2 already says to check; the failure mode
   is that a design bundle looks authoritative on its own. **When a spec and a
   design bundle disagree, the spec wins and the bundle gets flagged for
   revision** — say so in the PR rather than silently picking one.

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
  (`design/*/*/project`), `supabase/migrations|functions`, and the generated
  `database.ts` stay verbatim, never formatted.
- Gitleaks: `.env.example` — and SPEC-SETUP-01, which embeds it — are
  allowlisted via `.gitleaks.toml` (placeholder names only). Never commit a real
  key anywhere. **`.env` files are ignored REPO-WIDE, not per app**: root
  `.gitignore`'s `.env` / `.env.*` carry no slash, so git applies them at every
  depth (`apps/mobile`, `packages/*`, `supabase/`, `scripts/` are all covered —
  the per-app rules are redundant, not load-bearing). `!.env.example` is the one
  negation. **Verify with `git check-ignore -v <path>`, never by reading the
  globs** — pathless-vs-anchored is the whole question and it is invisible on a
  read.
- **⚠ THE REPO IS PUBLIC (2026-07-29). History is world-readable, and removal
  is not rotation.** Going public retroactively changed what every past commit
  means: `git log -p` is now a public document, so a credential committed once
  and deleted in the next commit is still published forever — deleting it hides
  it from the working tree and from nobody else. Three standing consequences:
  ① **the only remedy for an exposed credential is ROTATION**, and a PR that
  "removes" one is not finished until the new value has been issued and the old
  one revoked; ② **seeds never contain literal credentials** — they read them
  from the environment with DOCUMENTED VARIABLE NAMES (`003_provider_users.sql`
  is the pattern: names in the header, values only in the founder's password
  manager, `.env.local` and GitHub secrets); ③ the same applies to PR bodies,
  commit messages and PROGRESS.md, which are just as public as the code.
  Rewriting history to purge something is a last resort, not a fix: it breaks
  every clone and fork, and anything already cloned or indexed is gone anyway.
- **"It's only a dev password" is not an exemption.** P01 committed a shared dev
  provider password into a seed header, a Playwright spec and PROGRESS because
  the spec said "document the dev credentials in the seed file header".
  **GitGuardian failed the PR, correctly** — gitleaks and Secret Scan both
  passed, so one green scanner proves nothing. Credentials belong in the
  environment: seeds take them as a psql `-v` variable, E2E reads
  `process.env`, and the suite SKIPS (never fails) when the vars are unset so a
  missing secret does not masquerade as a broken feature. Documenting an
  ACCOUNT is fine; documenting its password is not.
- **CodeQL RUNS and PASSES on every PR.** `security.yml`'s
  `if: ${{ !github.event.repository.private }}` self-adjusted the moment the
  repo went public (2026-07-29) — nothing was re-plumbed and nothing needs to
  be. The condition stays so the job would skip rather than fail if the repo
  ever went private again (CodeQL needs GHAS there). This line previously said
  CodeQL auto-skips; that has been false since the repo went public.
- **`pull_request` gitleaks scans only the PR's commits — a green PR check is
  NOT a clean history.** gitleaks-action picks its scope from the event: PR →
  that PR's commits; `schedule` / `workflow_dispatch` / `push` → `gitleaks
detect` over the entire history. The weekly Monday scan is the full one, and
  `workflow_dispatch` was added so it can be demanded on the spot.
- **A scheduled job that fails blocks nothing and is therefore invisible.** The
  ONE scheduled full-history run (2026-07-27) failed on two findings and nobody
  noticed for three days, because a `schedule` run gates no PR. Both were false
  positives — empty placeholders in SPEC-SETUP-01's embedded `.env.example`
  block — but a permanently red scanner would have hidden a real one just as
  well. Same family as the skipped suite in §9: **check the scanners nothing is
  waiting on.** Fixed by widening `.gitleaks.toml`'s placeholder allowlist.
- **Secret scanners have a MERGE-COMMIT blind spot.** gitleaks runs
  `git log -p -U0 --full-history --all`, and `git log -p` emits **no diff for a
  merge commit** — so conflict-resolution content, which can differ from BOTH
  parents, is never scanned. A secret pasted in while resolving a conflict is
  invisible to it. This repo has 2 merges and one (`f38c4e58`) carries 211 real
  resolution lines; scanned separately with `git show --cc` during the
  2026-08-01 audit, clean. **Any full-history claim must cover merges
  separately** — enumerate them with `git rev-list --all --merges` and diff each
  with `--cc`.
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
- **Holds are created ONLY via the `create_slot_hold(p_slot_id)` RPC** — there
  is deliberately NO RLS INSERT policy on `slot_holds` (dropped in the same
  migration; the SECURITY DEFINER function bypasses RLS). Don't re-add one, and
  don't re-add a user-id parameter: the holder comes from `auth.uid()` inside
  the function (20260801005955).
- **Every SECURITY DEFINER function needs its OWN authorization check — audit
  the ones that already exist.** `confirm_booking` was the first (F06);
  `cancel_booking` was the second and worse, because it stayed reachable: it
  matched on booking id ALONE, so any signed-in patient could cancel any other
  patient's booking by guessing a UUID. Proven from Node before fixing it
  (patient B cancelled patient A's confirmed booking and got
  `{"success": true}`), closed in 20260728120808. RLS does not protect these
  functions — the function body IS the boundary. When you touch a feature,
  re-read every SECURITY DEFINER function it calls and ask "what stops someone
  else's id being passed here?"
- **A read function must take NO user id — filter on `auth.uid()` inside.**
  `get_patient_bookings()` deliberately has zero parameters. A `p_user_id`
  argument on a SECURITY DEFINER reader is the cancel_booking hole again, just
  for reads.
- **`auth.uid() IS NULL` does NOT mean "service_role" — it also means ANON.**
  Four functions have now used that idiom to grant themselves a trusted
  bypass, and `cancel_booking` was the one that ALSO carried an anon/PUBLIC
  EXECUTE grant: an unauthenticated `fetch` with the public anon key (which
  ships in the Expo bundle and the web app) could cancel ANY booking by id.
  Proven on dev before the fix, non-destructively, by targeting an
  already-cancelled booking — the authorization guard returns
  `booking_not_found` and the status guard returns `cannot_cancel`, so the two
  are distinguishable without writing anything. Measured inside a SECURITY
  DEFINER body:

  | caller               | `auth.uid()` | `auth.role()` | `current_user` |
  | -------------------- | ------------ | ------------- | -------------- |
  | anon key, no session | NULL         | `anon`        | `postgres`     |
  | pg_cron / direct SQL | NULL         | NULL          | `postgres`     |

  **`current_user` inside a DEFINER function is the function OWNER, never the
  caller** — it can never be an authorization signal there. Use
  `is_internal_caller()` (migration 20260729021321), which keys off
  `auth.role()`. And check the GRANT as well as the body: the same idiom was
  harmless in three sibling functions purely because they had no anon grant.

- **⚠ THE GENERAL LAW, learned four times: any fact with MONEY, STATE or
  IDENTITY consequences is SERVER-DERIVED. Clients supply identities, never
  values.** The four instances, each found the same way:
  ① `confirm_booking` was PUBLIC-executable, so the client could declare a
  booking paid (F06). ② `cancel_booking` wrote `p_cancelled_by` verbatim, so
  the client could declare WHO cancelled (P02). ③ `bookings.total_amount` and
  `booking_services.price_at_booking` were plain client INSERTs, so the client
  could declare WHAT IT PAID — a 400 EGP service booked for 1 EGP, proven on
  dev (migration 20260729160519). ④ `create_slot_hold(p_slot_id, p_user_id)`
  took the HOLDER as an argument and never compared it to `auth.uid()`, while
  also carrying a PUBLIC + anon grant — so the anon key alone could delete a
  stranger's hold mid-checkout (the body's one-hold-per-patient self-heal is a
  `DELETE … WHERE user_id = p_user_id`) or attribute a hold to them. Closed in
  20260801005955 by DROPPING the parameter, not by checking it. **That was the
  last one open.**
  **Prefer deleting the parameter to validating it.** A `p_user_id = auth.uid()`
  guard leaves an argument whose only correct value is one the server already
  knows — every future edit has to keep remembering why it is there. With the
  parameter gone, impersonation is impossible BY CONSTRUCTION: there is no
  channel left to carry the lie. Note this CHANGES THE SIGNATURE, so drop the
  old function rather than leaving an overload beside the new one — an overload
  that still takes the id is the "RPC beside an open INSERT policy" mistake
  wearing a different hat.
  The pattern is always the same: a value the client had no business asserting
  travelled from the app to the database unchecked, and the guard that should
  have caught it was somewhere else entirely (a policy about ownership, a
  function about status). **Ownership is not authorization, and authorization
  is not validation.**
  So: **every new INSERT/UPDATE policy gets audited against this before merge.**
  Ask of each column the client can write — could a modified client set this to
  something that benefits it? If yes, the write belongs behind a SECURITY
  DEFINER function that derives the value from data the client cannot reach.
  And when you add that function, **close the old door in the same migration**:
  an RPC beside an open INSERT policy is decoration, not a fix.
- **A discriminator the CLIENT supplies is not a discriminator.**
  `cancel_booking` wrote `p_cancelled_by` verbatim, so a patient could record
  their own cancellation as `'provider'` — corrupting the field the dashboard
  reads to tell a desk cancellation from a patient one. Either DERIVE it from
  the caller (as `mark_booking_outcome` does for `closed_by`) or VERIFY the
  claim against what the caller is actually entitled to. Verifying is better
  when one person can legitimately act in two capacities: a receptionist who is
  also a patient at their own branch is then recorded correctly from either app,
  which a blind override gets wrong in one direction.
- **`x = ANY(get_provider_branch_ids())` is NULL-unsafe.** That function returns
  NULL (not `{}`) for a non-provider, `x = ANY(NULL)` is NULL, and an OR/NOT
  chain containing it evaluates to NULL — which an `IF NOT (...)` treats as
  false and FALLS THROUGH TO ALLOW. Always `COALESCE(..., FALSE)` around it.
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
- **`new Date(someDate.toLocaleString(...))` is a V8-only trick — it returns
  Invalid Date on Hermes.** The old `cairoWallClockToDate` derived Cairo's UTC
  offset by formatting to `"7/28/2026, 3:00:00 PM"` and parsing it back.
  **Hermes' `Date` parser accepts essentially only ISO 8601**, so on a real
  phone the parse failed, the offset became `NaN`, and the Date arrived at
  expo-calendar as Invalid — surfacing much later as
  `RangeError: Date value out of bounds` from `toISOString()` (Hermes' wording;
  V8 says "Invalid time value"). Every Node script and every unit test passed
  because they run on V8. **Read zoned wall clocks with
  `Intl.DateTimeFormat.formatToParts` and rebuild with `Date.UTC` — never format
  to a string and re-parse.** The conversion now lives in core as
  `cairoWallClockToInstant`, with a test asserting the result is a VALID date.
  Anything that must behave identically on device and in Node belongs in core
  with a test that asserts validity, not just the value.
- **`popToTopOnBlur` fires after the blur ANIMATION, not on blur.** On a
  confirmed booking the flow stack is already torn down by then, so bottom-tabs
  dispatched POP_TO_TOP at nothing and logged "The action 'POP_TO_TOP' was not
  handled by any navigator" on every successful payment. If a screen navigates
  away from a tab that owns a nested stack, don't also ask that stack to reset
  itself on blur — let the route guard handle re-entry.
- **Nested `Pressable`s are invalid HTML on web.** A card `Pressable` wrapping a
  button `Pressable` renders `<button>` inside `<button>`, which React reports
  as a hydration error on Expo web and which reads as two overlapping controls
  to a screen reader on native. If the inner control triggers the SAME action as
  the card, make it a plain `View` — the card already owns the press.
- **NativeWind on web needs `darkMode: 'class'`.** With Tailwind's `'media'`
  default, react-native-css-interop throws
  "Cannot manually set color scheme, as dark mode is type 'media'" at boot when
  its DOM observer tries to apply a scheme. Set it in `tailwind.config.ts` even
  for a light-only app.
- **An effect keyed on a TanStack `data` object never re-runs.** The branch
  screen registered the open branch via
  `useEffect(..., [branch, openBranch])`, where `branch` is `query.data`. That
  object is referentially STABLE from cache and the screen stays mounted under
  Tabs, so returning to the same branch never re-registered it — after a
  confirmed booking cleared the store, the slot picker got `branchId === null`,
  its query sat `enabled: false`, and step 1 showed its skeleton forever. It
  "worked" only after visiting a different branch, which is what made the
  report so odd. **Compare against the STORE and re-sync on drift**, don't wait
  for a reference to change that never will.
- **A slot the patient just booked becomes invisible to them.** The `slots`
  SELECT policy is `booked_count < capacity`, so the moment `confirm_booking`
  increments a capacity-1 slot, its own booker can no longer read the row. Any
  post-confirmation screen must render from a SERVER-built payload (F06's
  `settle-payment` returns the whole confirmation DTO), never from a re-query.
  `get_branch_slots` is SECURITY DEFINER and still sees it — that is why the
  picker keeps working for everyone else.

## 6a · Web (Next.js) specifics

- **`getUser()`, never `getSession()`, on the server.** `getSession` trusts the
  cookie as-is; `getUser` revalidates the JWT with the auth server. A forged
  cookie is otherwise a provider session.
- **Nothing may sit between `createServerClient` and `getUser()` in middleware.**
  A stray `await` there is the documented cause of random logouts — the cookie
  refresh has to be the first thing that touches the response.
- **Middleware answers "signed in?", the layout answers "allowed in?"** Role
  gating needs a `provider_users` lookup, which is too expensive to run on every
  request (middleware matches nearly everything) and is needed in the layout
  anyway. Splitting them keeps one DB round-trip per page, not per asset.
- **A valid login is not an authorized one.** Patient credentials work fine
  against a staff portal — the auth server has no idea it is one. The login
  action checks membership and signs a non-provider back OUT, rather than
  leaving a half-authenticated session on a shared front desk.
- **Never derive scope from the URL.** The branch id comes from
  `provider_users`, server-side. The RPCs re-check membership regardless, but
  the UI should never even form the wrong request.
- **Anon key only in `apps/web`.** The service-role key bypasses RLS and every
  SECURITY DEFINER membership check the provider features rely on; it belongs in
  Edge Function secrets, not in a Next.js app (CLAUDE.md §8).
- **A shared exhaustive `Record` is a free cross-app safety net.** Adding
  `arrived` to core's `BOOKING_STATUSES` made `tsc` fail the MOBILE status badge
  until it was handled — the patient app would otherwise have rendered a blank
  chip for a state only the dashboard writes. Prefer exhaustive Records over
  `switch` with a default for exactly this.

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

## 9 · UI fidelity — prove it, don't assert it

**Any PR claiming design fidelity ships comparison screenshots in its body:
your build beside the design bundle's screen.** No screenshots, no fidelity
claim. `apps/web/e2e/fidelity.spec.ts` is the capture harness — it writes to
`docs/design-briefs/<feature>-fidelity/` at **1366×768**, the desktop floor from
the DESIGN-02 brief, because that is where layouts break.

Why this is a rule: P01's first dashboard build was written from the `.dc.html`
by eye, looked plausible in an accessibility tree, and was visibly wrong the
moment the founder opened it. Reading markup is not seeing a screen.

Two failure modes it catches, both from that build:

- **Hand-copied values drift.** Implement design-system components from the
  shared contract (`packages/design-tokens/src/components.ts`), never by
  measuring a prototype. See CLAUDE.md §3a.
- **Utilities can be silently dead.** In Tailwind v4, `@import 'tailwindcss'`
  puts utilities in `@layer utilities`, and **unlayered CSS beats layered CSS
  regardless of specificity**. `tokens.css` carries a
  `*, *::before, *::after { margin: 0; padding: 0 }` reset — imported unlayered
  it deleted EVERY `p-*` and `m-*` in the whole web app, while `gap-*` kept
  working, so the breakage read as "the design is just wrong" instead of "the
  CSS is broken". Import shared CSS with `layer(base)`. When spacing looks
  uniformly wrong, probe a utility in the browser
  (`getComputedStyle`) before touching markup.

Two more, both found while capturing P02's screenshots:

- **Playwright does NOT load `.env.local`.** Next loads it for the app, but the
  test runner is a separate process — so the "Local: set PROVIDER_TEST_* in
  apps/web/.env.local" instruction in the E2E header did nothing for two
  features, and the dashboard suite skipped locally while passing in CI. The
  config now loads it explicitly, with CI values winning. **A suite that skips
  looks the same as a suite that passes in a summary line** — check the count.
- **`next dev` paints a dev-tools button in the bottom-left corner.** It landed
  in the first fidelity capture looking like a stray black disc over the drawer
  footer. Hide it in captures (`nextjs-portal` display:none) rather than
  explaining it away in the PR.
- **`waitForURL` resolves BEFORE the page paints.** Nine P02 tests guarded on
  `test.skip((await rows.count()) === 0)` and quietly began skipping themselves
  once the page got a little heavier — the count ran before the RSC payload
  landed. They had been passing on timing luck. Wait for the CONTENT
  (`expect(list.or(empty)).toBeVisible()`), and give it a real budget when it
  waits on a server-rendered fetch against the remote dev DB with several
  workers contending. Same family as the credentials skip in §4: **a skipped
  suite and a passing suite look identical in the summary line** — read the
  counts, and if a number moved, find out why.
- **A fixed `waitForTimeout` after a debounced action is a coin flip.** The
  server-side search check raced its own 300ms debounce plus a round trip and
  reported a false failure at 1200ms. Use a web-first assertion that describes
  the END STATE and retries — for a filter, assert that no NON-matching row
  remains rather than sampling the rows once.
- **An out-of-order REFETCH can paint over a newer state.** The outcome E2E
  failed in CI while passing locally: marking a booking arrived fires a realtime
  broadcast, and its debounced refetch was still in flight when the next action
  (completed) was saved — so the older response returned `arrived` and painted
  over the newer row. It looked un-saved while the database had taken the write.
  Local latency hid the window; a runner reaching Frankfurt did not. Any
  component that refetches from more than one trigger (realtime + poll + focus +
  post-mutation) needs a **monotonic request sequence** so only the newest
  response is allowed to paint, and its post-mutation refetch must be AWAITED
  rather than fire-and-forget. **A CI-only failure is usually a latency window,
  not a flake — find the window.**
- **Fidelity captures do NOT belong in CI.** They are a local authoring tool:
  run them, commit the images, put them in the PR body. They assert almost
  nothing, they were the slowest thing in the E2E job (a login and a navigation
  each), they competed for the single dev server, and they wrote screenshots into
  a container nobody would ever open — while being the only thing turning the
  job red. `testIgnore` them under `process.env.CI`; locally they all still run,
  so §9's discipline is unchanged.
- **An E2E suite that MUTATES shared data consumes its own fixtures.** The
  outcome test marks a booking completed, which also flips a cash booking to
  paid, starving the cash-row and cancel-on-behalf tests after it. Six tests had
  quietly skipped themselves with plausible messages. `supabase/seeds/004_dashboard_e2e_fixtures.sql`
  RESETS the day rather than appending, and seeds a SPARE so tests do not starve
  each other within one run. Residual: three workers share one mutable dev
  database, so a data-dependent skip can still race — the durable fixes are
  per-worker fixtures or `workers: 1`.
- **Read the screenshot you just captured.** The first P02 drawer capture looked
  fine in the accessibility tree but showed the scrim confined to `<main>`, with
  the sidebar and header undimmed — the design anchors both to the root shell.
  §9 exists because markup review does not catch this class of thing; the
  capture only helps if someone actually looks at it.

## 8 · When something isn't in this file

If you debug a toolchain/CI/platform trap that cost you more than one
attempt, append it to the relevant section here in the same PR. This file is
how sessions inherit each other's scars.

_Last updated: 2026-08-01 · Covers everything learned SETUP-01 → P03 plus the
public-repo security pass (`create_slot_hold`, full-history secret audit)._
