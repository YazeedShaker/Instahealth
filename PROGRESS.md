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

**Phase:** 🎉 **MILESTONE ONE — the loop is closed.** Patient books on mobile (F01→F07) → the branch desk sees it, records the outcome, opens the detail drawer, cancels on the patient's behalf, manages its own prices, reads its slot picture and maintains its own contact details (P01–P05 — every sidebar surface is live). The four shipped identity/money holes are all closed and the repo passed a full-history secret audit (2026-08-01). Next: F08–F09 reviews & profile (needs the review writer function), F03 search, A-series admin; PayTabs test credentials now exist
⚠ **Two founder decisions are open and blocking nothing yet: the LICENSE / IP posture and whether vulnerability detail belongs in a public PROGRESS.** Both in Known risks.
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
- [x] **F06** — ✅ DONE. Mobile: payment (mock provider) + settle-payment + confirmation + SMS (see Shipped)
- [x] **P01** — ✅ DONE. Web: provider auth, shell & Today view — **MILESTONE ONE, loop closed** (see Shipped)
- [x] **P02** — ✅ DONE. Web: booking detail drawer + cancel-on-behalf + upcoming days (see Shipped)
- [x] **P03** — ✅ DONE. Web: services & prices editor with audit trail (see Shipped)
- [x] **P04** — ✅ DONE. Web: slot allocation view, read-only (see Shipped)
- [x] **P05** — ✅ DONE. Web: branch profile «بيانات الفرع» (see Shipped). Every sidebar
      surface is now live; P06 has no defined scope left — new dashboard asks go through
      a fresh spec.
- [x] **F07** — ✅ DONE. Mobile: My Bookings list, detail & cancel (see Shipped)
- [ ] **F08–F09** — Mobile: reviews, profile
- [ ] **A01–A06** — Web: admin panel
- [ ] **006_practitioners.sql + doctor booking** — after labs/scans proven

**First milestone:** patient books on mobile at Town/Saridar → pays → gets SMS + confirmation →
receptionist sees it on web dashboard and confirms. Closed loop = model proven.

---

## Shipped

### 2026-08-04 · P05 — Branch profile «بيانات الفرع» (web)

The last dashboard surface: the desk can now SEE the branch's own record and
fix the half of it a branch legitimately maintains — contact and address —
through the first writer function built after REFACTOR 2/N closed the client
write surface.

**The field split is the decision in SPEC-P05.** Editable via
`update_branch_profile` (migration `20260804121655`): `phone`, `whatsapp`,
`address_ar`, `address_en`. Everything else renders read-only under the P04
gated treatment: name and pin are marketplace identity, **operating hours are a
commercial term** (the working window drives slot generation —
DECISION-slot-allocation-ownership), and **`holiday_mode` is deliberately NOT a
desk toggle** — today the flag only gates nightly generation, so flipping it on
would leave ~30 days of already-materialised slots bookable. A toggle claiming
«الفرع في إجازة» while patients keep booking is a lie; an honest holiday
feature (blocking existing slots, handling their bookings) is its own spec.

**The writer takes NO branch id** — the branch derives from the caller's
membership, the `create_slot_hold` law applied at birth instead of retrofitted.
Audit trail `branch_profile_history` records a jsonb diff of ONLY the changed
keys (changes, not clicks), append-only, readable by the owning branch's staff.
**No new UPDATE policy on `branches`** — the surface diff in
`authorization-surface.json` is +1 function, +1 SELECT-only table, nothing else.

**⚠ Verification caught the validation being wrong about Egypt.** The first
phone rule accepted only 0-leading landlines/mobiles — and Town's REAL seeded
number is `15276`, a short-code hotline (same shape as the design's own «دعم
الشركاء ١٦٧٢٣»). The Node run failed against live data and the rule now
accepts 4–5-digit 1-leading short codes, server and core mirror both. Verify
against the live DB before shipping is the whole lesson of §1.3, again.

**⚠ Found stale: the checked-in `database.ts` was MISSING P03's types**
(`branch_service_price_history`, `update_branch_service`,
`get_branch_services_for_editor`) — the 2026-08-01 "one-line diff" regeneration
was evidently hand-edited, and the gap passed CI because
`apps/web/lib/services/branch-services.ts` types its client
`SupabaseClient<any, any, any>`. The file is now the generator's full output
again; re-typing that client is queued as a follow-up.

**No design-bundle screen exists for this surface** — the bundle's "Provider
Profile" is the PATIENT branch screen (F04) despite its name, and the DESIGN-02
brief ends at screen 6. Built from the design-system contract and the P01–P04
idiom; captures in `docs/design-briefs/p05-fidelity/` document the built
screen. Flagged for a future design pass.

**Verified: 24 Node checks against the LIVE dev DB (anon key), all passing** —
anon refused by the grant (42501) · a patient gets `branch_not_found` and reads
zero history rows · seven server-side validation refusals incl. both 501-char
addresses · refusals write no history · probe save stores phone as entered and
whatsapp normalized to local `01X` form · the audit row carries ONLY the
changed keys with `changed_by` = the caller · identical save is `unchanged`
with no audit row · **a raw `branches` UPDATE still returns 0 rows** ·
restore leaves the dev DB as found. Playwright: 4 new profile tests green
against a PRODUCTION build (`E2E_PROD=1`), incl. a save→reload→restore
round-trip; fixture tripwire count unchanged (no booking fixtures consumed).
Core 370 tests, coverage bar held.

**For P06/A-series:** `update_branch_profile` + `branch_profile_history` are
the second instance of the writer-function pattern; the jsonb-diff audit shape
is the one to reuse for multi-field editors. Governorates are seeded in English
(«Cairo») and render as-is in the gated card — a data-cleanup nit for A-series
onboarding.

### 2026-08-03 · REFACTOR 4/4 — `useBranchBookings` reads move to TanStack Query

The last refactor item, and the only one that touches app code.

**Three bugs shipped from this one file, all in hand-rolled read orchestration:**
an out-of-order refetch painting over a newer state (P02 follow-up); a read that
started BEFORE a write still counting as "newest" by sequence number, so its
pre-write answer painted, the action button reverted, and the desk's next click
sent the wrong outcome — **a cash completion silently lost** (#27); and a cached
RSC payload repainting the pre-action snapshot on back-navigation (#28).

Each was fixed with more bookkeeping: a monotonic `requestSeq`, an
invalidate-reads-on-write bump, a mount revalidation. **That bookkeeping is a
cache library, written badly** — and TanStack Query was already a dependency and
already provider-mounted in `app/providers.tsx`, simply unused. So the sequence
counter, the manual poll, the focus listener and the mount revalidation are gone,
replaced by a query key and four options. The file went 442 → ~400 lines, most of
the remainder being the reasoning.

**⚠ THE TRAP, caught before it shipped:** `providers.tsx` sets a global
`staleTime: 60_000`. Inheriting that would let a mount reuse a cached page
without refetching — **reinstating #28 exactly**. The query sets `staleTime: 0`
and `refetchOnMount: 'always'`, and says why in both places.

**What deliberately did NOT move:**

- **Pending spans the write AND its confirming refetch.** `useMutation`'s
  `isPending` covers only the mutationFn, so the button would re-enable while the
  confirming read was still in flight — precisely the window #27 closed. Still an
  explicit set, still lowered only after the refetch paints.
- **No optimistic status.** An optimistic outcome is indistinguishable on screen
  from a saved one, which is what made #27 invisible.
- **The realtime broadcast → debounced invalidation**, because the payload
  carries no date.

**What got structurally better rather than just moved:** the server payload can
no longer seed the wrong question. `initialData` applies only to the unfiltered
first page of the rendered day — the query KEY encodes the question, so the old
`seededDate` guard against "filtered view resets to the unfiltered payload" is
not merely fixed but unrepresentable.

**Verified: 42/42 Playwright against a PRODUCTION build**, which is where the #27
and #28 regression guards actually have teeth. Core 341, mobile 88, tokens 25.

**⚠ Unrelated but blocking: a new `brace-expansion` advisory
(GHSA-rgw5-rvv9-x895) landed mid-PR** and was failing `pnpm audit` on any branch.
Per §4's fix order, resolved by pnpm overrides rather than an ignore — and these
are PATCH bumps within each major, not the v5 jump that broke minimatch before.
⚠ The advisory has **three** affected ranges (`<1.1.18`, `>=2.0.0 <2.1.4`,
`>=4.0.0 <5.0.9`); the first attempt read only the first table and fixed two of
them, leaving the audit red. Read every range.

### 2026-08-03 · REFACTOR 3/N — CI and test infrastructure

Four changes that between them remove the recurring taxes of the last few days.

**1 · Fixture seeding blocks again.** It was `continue-on-error` while
`SUPABASE_DB_URL` pointed at the direct (IPv6-only) host and could never connect
— correct then, because an unreachable database must not turn every PR red for a
reason unrelated to the change under review. The secret is now the Session pooler
URL and seeding works, so the tolerance is gone: a seed that silently fails is a
scanner nobody is waiting on, and the FIXTURE TRIPWIRE would report the drained
day pointing at the wrong cause. The error message still names the IPv6 trap,
because that is the failure that will recur if the secret is ever re-pasted.

**2 · One E2E run at a time, repo-wide.** Workflow-level `concurrency` is keyed
on `github.ref` — it cancels superseded runs of the SAME branch and does nothing
across branches. But this job seeds and then CONSUMES a shared dev database, so a
push to main and a PR run overlapped and ate each other's fixtures: measured
2026-08-01, main's E2E ran 13:32:59–13:36:29 while a PR's started 13:37:50 and
found ONE actionable booking where four had just been seeded. The job now carries
`concurrency: e2e-web-shared-dev-database` with **`cancel-in-progress: false`** so
runs QUEUE — cancelling main's verification because a PR arrived would be exactly
backwards — plus `timeout-minutes: 30` so a wedged run cannot hold the queue.
⚠ The durable fix is a per-run database; this is the cheap version that removes
the collisions.

**3 · CI runs the E2E against a PRODUCTION build.** `next dev` cannot show the
Router-Cache class of bug this dashboard has shipped twice — the navigation
regression test passed with AND without its fix under `pnpm dev`. Cost is
negative: the suite is FASTER against the build (1.1m vs 1.8m, no on-demand
compilation) plus ~40s to build. Locally the default stays `pnpm dev`; opt in
with `E2E_PROD=1`. One constant now drives both the command and its timeout, so
they cannot disagree — a dev-length budget against a cold `next build` would read
as a hung server rather than a short budget.

**4 · Tiered gates (§3).** The full sequence is the MERGE gate, not the EDIT
gate. Running all of it after every small edit measured ~40 minutes of pure
ceremony across three PRs in one day. Iterate with the filtered subset, then one
complete pass before pushing — "never discover red in CI" is satisfied by one
pass, not twenty.

**⚠ Node: the toolchain does not agree with itself, and it is now written down.**

| consumer                | wants                    |
| ----------------------- | ------------------------ |
| Expo CLI 54             | **breaks on 24**         |
| `@supabase/supabase-js` | declares `node >=22.0.0` |
| CI                      | runs 20, all green       |

`.nvmrc` stays **20** because that is the version proven to work for Expo and CI.
`engines` is now `>=20 <23` but **deliberately NOT enforced** — turning on
`engine-strict` would fail `pnpm install` outright, because supabase-js declares
`>=22` while CI and Expo both need 20. Node 22 is the likely single answer and is
worth testing when the SDK upgrade lands. Verification scripts that construct a
Supabase client need 22+ and are run with an explicit binary rather than by
switching the shell. Also recorded: switching Node invalidates Metro's
`v8.serialize()` cache, so expect one noisy "falling back to a full crawl" start.

### 2026-08-03 · REFACTOR 2/N — the client write surface is closed

The sweep found seven client-reachable write policies across five tables, every
one column-blind. All seven are now dealt with, and the surface the tool records
shrank accordingly: **25 standing review items → 16, with zero COLUMN-BLIND
WRITE warnings left.**

**Five had no consumer at all.** Searching every write call in `apps/`,
`packages/` and `supabase/functions/` turned up nothing writing `bookings`,
`slots`, `branches` or `reviews` from a client — every real write already goes
through a SECURITY DEFINER function (`mark_booking_outcome`, `cancel_booking`,
`confirm_booking`, `create_pending_booking`, `update_branch_service`,
`generate_branch_slots`) or through an Edge Function on the service role, which
bypasses RLS entirely. So they were dropped outright rather than replaced. When
P05 needs to edit a branch profile and F09 needs to write a review, each gets a
writer function in the `update_branch_service` shape.

**Two are load-bearing and were narrowed instead.** `users` INSERT/UPDATE back
`ensureProfile` (which creates the patient row on first sign-in — there is
deliberately no trigger for phone signups) and `updateProfileName`. RLS cannot
restrict columns, so the fix is column GRANTs: a patient may INSERT `id, phone`
and UPDATE `name_ar, name_en, date_of_birth, gender, preferred_language,
sms_reminders` — and nothing else. **`phone` is deliberately INSERT-only**: it is
the OTP identity, so changing it is an auth operation, not a profile edit. `anon`
lost its write grants on `users` entirely.

**⚠ A near-miss worth recording.** The first search for consumers grepped for
`.from('users')` and `.update(` on the SAME line, found nothing, and would have
concluded "drop everything" — which would have broken sign-in. The calls are
chained across lines. **Verify a consumer before removing its door**, and use a
multiline search when the codebase chains.

**Verified against the LIVE dev DB — 9 Node checks, all with the anon key:**
a partner can no longer rewrite its own branch (rating, allocation) · nor mark
its own booking paid or zero the commission · nor inflate its own slot capacity ·
a patient can no longer insert a review directly (`42501`) nor un-flag/self-verify
one · **a patient CAN still set their own name** · but not their phone (`42501`) ·
never another patient's row · and the first-sign-in INSERT grant survives, refused
only by the primary key (`23505`) rather than by permission.

**Two bugs in the checker itself, both found by using it:**

- The inventory OR'd INSERT and UPDATE grants, so `users.phone` read as
  _writable_ when it is INSERT-only. On a security baseline that distinction is
  the entire point, so the two are now recorded separately.
- Separating them then broke the COLUMN-BLIND warning **silently** — `review()`
  expected a flat array and the new shape is `{insert, update}`, so the warning
  stopped firing for every table at once. Exactly the failure mode the tool
  exists to prevent, in the tool. Fixed, plus a `columnCount` per table so it can
  distinguish a BLANKET grant (every column — the dangerous shape) from a SCOPED
  one, and re-proved by simulating the closed `branches` hole coming back:
  `COLUMN-BLIND WRITE branches · authenticated · UPDATE — 23/23 columns`, exit 1.

### 2026-08-02 · REFACTOR 1/N — the authorization surface is enumerated and asserted

**Six security holes had shipped, all the same shape**, and the law against them
was already written down. That is the interesting part: §5 has said
"any fact with money, state or identity consequences is SERVER-DERIVED" since
instance three, and instances four, five and six shipped anyway.

Not for lack of knowing it. Answering _"can a client write this column?"_ means
cross-referencing **three disconnected mechanisms** — RLS policies, function
`GRANT`s and function bodies — and **Postgres defaults to open on the first
two**: `EXECUTE` goes to PUBLIC automatically, and an UPDATE policy is
COLUMN-BLIND unless you say otherwise. Nobody holds three mechanisms in their
head, so nobody checked. Detection was per-feature and post-hoc: each hole was
found by whoever happened to be building the feature that touched it.

**So the surface is now enumerated, checked in and asserted.**
`scripts/authorization-surface.sql` reads the catalog; `pnpm authz:check` diffs
it against `supabase/authorization-surface.json`; the **Authorization Surface**
CI job fails on drift. A new policy or grant cannot land without appearing as a
reviewable diff — which turns "audit every policy before merge" from something a
reviewer must remember into something they cannot miss.

Design notes worth keeping:

- **The comparison is SEMANTIC, over parsed JSON** — psql formatting differences
  between machines never surface as false drift.
- **Arrays are keyed by IDENTITY, not index.** Indexing by position meant
  inserting one function shifted every later entry and produced a wall of false
  drift that buried the real change. Now it reads
  `functions[confirm_booking(…)].executeGrants  from: postgres,service_role  to: PUBLIC,anon,…`.
- **`--from-file` runs the whole pipeline without a database**, because `psql` is
  not on every dev machine and shipping unrunnable logic to CI is how you find
  red there instead of here. Verified both ways: clean against the baseline, and
  red against three simulated regressions (a new INSERT policy on `payments`, a
  PUBLIC grant regained by `confirm_booking`, a new function taking an identity
  parameter).
- **An identity-parameter flag** on SECURITY DEFINER functions — the cheap
  partial defence for the one thing a catalog query cannot see. ⚠ First version
  reported `get_branch_bookings_for_date` as taking one; `proargnames` also holds
  the OUTPUT column names of a RETURNS TABLE function, and those legitimately
  include `cancelled_by`. Restricted to the first `pronargs` entries.
- **The admin-only exclusion matches EXACTLY.** A first attempt used
  `NOT LIKE '%admin%'`, which silently dropped every provider policy — they all
  carry `OR get_user_role() = 'admin'` as an escape hatch — and reported the
  schema as far safer than it is. That near-miss is the argument for the tool:
  the same eyeballing error is what let six holes through.

**⚠ WHAT THE SWEEP FOUND — it is worse than assumed.** Not one bad table but
**seven client-reachable write policies across five tables, every one
column-blind**: a partner can mark their own bookings `paid` or zero the
commission, raise their own slot `capacity`, or set their own `rating`; a patient
can clear `is_flagged` on their own moderated review. Full table in Known risks.
**This PR fixes none of them** — it is a drift detector, not a judge, and its
baseline records reality as found. Closing them is the next PR, by the
writer-function route.

### 2026-08-01 · P04 — Slot allocation view (web, read-only)

The desk can now see the branch's daily slot picture: every generated time, what
state it is in, and how full the day is — without being able to change the
number that governs it.

**The decision P03 left open is closed:** allocation editing ships to **no**
provider role. `instahealth_slot_allocation` and the working window are
COMMERCIAL TERMS of the partner agreement — changing them is a conversation then
an InstaHealth-admin action, not a dashboard toggle. So `provider_users.role`
still needs no tiers, and the A-series inherits that question for onboarding,
where it is genuinely needed. Full reasoning:
`docs/decisions/DECISION-slot-allocation-ownership.md`.

**Slot states come from ONE predicate.** `getSlotAllocationState` in core is
derived from the existing `getSlotStatus` rather than re-deciding fullness — the
picker, `create_slot_hold` and the capacity trigger all already agree that full
means `booked + active holds >= capacity`. The grid only splits the REASONS
apart: booked · **قيد الحجز (held)** · متاح · مضى · موقوف. The held state matters
— it is the one thing the desk cannot see in the raw table, because holds are
invisible under RLS, and it is the F05 lesson applied to a new screen.
Precedence puts `booked` above `past`: a slot that has happened AND has a
patient is that patient's appointment, not dead time.

**No new RPC and no migration.** It reads the SAME `get_branch_slots` the
patient picker uses (which already returns `active_hold_count`), plus
`get_branch_bookings_for_date` for the names. A second reader would have been a
second definition of "is this slot free", which is what the spec forbids.

**Two deliberate deviations from the design bundle** (§1.5 — spec wins, bundle
gets flagged):

- **The owner screen is NOT built.** The bundle ships a second screen with
  working +/− controls, a window picker and a save button. The decision above
  deletes it.
- **The gate copy is the SPEC's, not the design's.** The bundle says «تعديل عدد
  المواعيد ونافذة العمل يتم من حساب الإدارة» — which presumes exactly the branch
  owner account we just decided not to create. It now reads «لتعديل عدد المواعيد
  تواصل مع إنستاهيلث» with a support address.
- Also: the bundle has no HOLD state; added. And the duration line is worded as
  «مدة الزيارة» and disappears when NULL — since the capacity rewrite,
  `slot_duration_minutes` no longer describes the grid spacing (Known risks), so
  «كل ٣٠ دقيقة» over a 120-minute grid would have been a confident lie.

**⚠ Reading the fidelity capture caught a real defect** that the accessibility
tree did not: the lock overlay printed on top of the ghosted controls, because
the card was shorter than the design's. §9 exists for exactly this. Fixed by
restoring the ghosted working-window row and raising the mask.

**Verified against the LIVE dev DB (5 Node checks + 5 Playwright, all passing):**
the desk reads its own branch's slots with hold counts · patient NAMES for
another branch return zero rows · anon can read slots (by design — the patient
picker) but gets `42501` on names · every grid cell resolves to one of the five
shared states · the summary's booked count equals the cells the grid painted
booked · the gate is present with the support address and contains **zero**
operable controls · the explainer states the 30-day window and that slots do not
roll over. Capture: `docs/design-briefs/p04-fidelity/`.

**⚠ AND IT TURNED UP A REAL HOLE — see Known risks.** SPEC-P04 said "RLS already
scopes reads to the member's branch — verify, don't assume." Verifying found the
reads are fine but the WRITES are not: `branches` has a column-blind UPDATE
policy, so any provider staff member can PATCH any column of their own branch —
`instahealth_slot_allocation` included. Proven by moving Town 5 → 99 and
restoring it. P04 does not close it; a read-only screen over an open endpoint is
decoration.

### 2026-08-01 · FIX — the desk saw stale actions after navigating back (founder report)

**Take an action, go to another page, come back — and the action was offered
again**, on a booking the database had already moved on. A hard refresh cleared
it. Founder-reported after testing the pending spinners.

**Root cause: `force-dynamic` only stops SERVER caching.** Next serves
back/forward — and, in a PRODUCTION build, ordinary in-app navigation — from the
**client Router Cache**. So the page remounted with the PRE-ACTION payload, and
`useBranchBookings` deliberately skipped its first refetch (an optimisation that
assumed the server payload was rendered just now). Nothing then corrected it:
the realtime broadcast had already fired before navigating away, and the poll is
60 seconds.

**⚠ `next dev` cannot show this bug, which is the important part.** Measured
before/after, sampling for 10 seconds after coming back:

| build               | after coming back                                                           |
| ------------------- | --------------------------------------------------------------------------- |
| production, unfixed | **stale for the whole sample, 0 refetches** — only a hard reload cleared it |
| production, fixed   | corrects in ~280ms                                                          |
| `next dev`, either  | corrects in ~295ms — **the bug cannot occur**                               |

Dev refetches the RSC payload on navigation, so the regression test passed with
AND without the fix there. `E2E_PROD=1 pnpm test:e2e` runs the suite against a
production build — proven to have teeth: with the fix reverted it fails
`Expected "completed", Received "confirmed"` after 62 retries, while the same
run under `pnpm dev` passes. The suite is also FASTER that way (1.1m vs 1.8m —
no on-demand compilation) plus ~40s to build. Full suite green both ways:
**37 passed, 0 skipped**.

⚠ **CI still runs `pnpm dev`.** Switching it over is queued for the refactor
branch (below) rather than bolted onto a bug fix — one piece of test
infrastructure at a time. Until then those assertions are documentation plus a
local guard, stated as such in the test.

⚠ The production-build path also makes the long-standing **connection-dot**
report (P01 follow-up) reproducible at last — it has been waiting on exactly
this check. Not investigated here.

**Also found: the CI fixture-seeding step never worked.** `SUPABASE_DB_URL` was
set to the DIRECT host (`db.<ref>.supabase.co`), which now resolves to IPv6
only, and GitHub runners have no IPv6 route — `psql` failed with «Network is
unreachable» and took the whole E2E job with it. The step is now
`continue-on-error` (seeding is an optimisation; the FIXTURE TRIPWIRE is the
guard) and prints the diagnosis. **Founder action: change the secret to the
Session pooler URL** (`aws-0-<region>.pooler.supabase.com`), which is IPv4.

**The fix:** the client revalidates on mount. The server payload is still the
instant first paint; it is simply no longer the final word — a payload is only
trustworthy if it was rendered _just now_, and after a cached restore it was
not. One query per page mount. Same law as the two bugs before it: the screen
may not assert a state the server does not hold.

The regression rides the booking the outcome test already consumes, so the
FIXTURE TRIPWIRE count stays at 3 — no new fixture pressure.

### 2026-08-01 · SEC — `create_slot_hold` derives its caller + public-repo hygiene audit

**The last open instance of the general law is closed.** `create_slot_hold`
took the holder's identity as an ARGUMENT — `create_slot_hold(p_slot_id,
p_user_id)`, SECURITY DEFINER, never comparing `p_user_id` to `auth.uid()` —
and, like `cancel_booking` before it, additionally carried a PUBLIC + anon
EXECUTE grant. Both consequences were reachable with nothing but the public
anon key that ships in the Expo bundle:

- **Hold destruction.** The body ends every call with
  `DELETE FROM slot_holds WHERE user_id = p_user_id` — the one-hold-per-patient
  self-heal. Passing a VICTIM's id deletes the hold they are checking out
  against, freeing their slot mid-payment. In a loop it denies that patient any
  hold at all.
- **Hold forgery.** The INSERT wrote `p_user_id` verbatim, so a hold could be
  attributed to someone who never took it, consuming a slot's capacity in a
  third party's name.

**The fix DROPS the parameter rather than checking it** (migration
`20260801005955`). A `p_user_id = auth.uid()` guard would leave an argument
whose only correct value is one the server already knows — the same shape §5
rejects for readers (`get_patient_bookings()` deliberately takes none). With
the parameter gone, impersonation is impossible **by construction**: there is
no channel left to carry the lie. The signature therefore CHANGES, so the
two-argument function is DROPPED, not left as an overload beside the new one.

Two things fixed in passing, in the function being rewritten anyway: it was the
last SECURITY DEFINER function without a pinned `search_path`, and its capacity
check was NULL-unsafe (`capacity`/`booked_count`/`is_blocked` are all nullable;
a NULL `IF` is FALSE in plpgsql and **falls through to ALLOW** an unbounded
hold — latent, 0 of 5,134 slot rows carry a NULL, but it is exactly the shape
§5 names).

**Verified against the LIVE dev DB (8 Node checks, all passing), anon key only:**
the two-argument signature is gone (`PGRST202 Could not find the function
public.create_slot_hold(p_slot_id, p_user_id)`) · anon with no session is
refused by the GRANT (`42501`) · a raw `fetch` with the public key gets HTTP
401 · happy path green · **the hold row belongs to the caller, never the id
supplied** · the attacker cannot destroy the victim's hold · one-hold-per-
patient still self-heals · **and a REJECTED re-pick leaves the existing hold
intact** (the behaviour `slot.tsx` promises the patient).

`database.ts` regenerated in the same PR — a one-line diff,
`create_slot_hold: { Args: { p_slot_id: string }; Returns: Json }`. Core's
`createSlotHoldSchema` (which carried a `userId`) is DELETED; the payload is
now `slotChoiceSchema`, with a test asserting its shape is exactly `['slotId']`
so a user id cannot creep back in. Maestro flows are unchanged — they drive the
UI by `testID` and never call the RPC directly.

**A new client-visible outcome: `not_authenticated`.** An expired session now
fails at the hold rather than holding for nobody, and the picker says «انتهت
الجلسة — سجّل الدخول مرة أخرى» instead of claiming the slot was just taken. A
race and an expired session are different facts and must not share a message.

---

**FULL-HISTORY SECRET AUDIT — the rotation list is EMPTY.** All 76 commits on
all refs, checked two independent ways (see the PR body for the full report):

- **Zero credentials found.** Real gitleaks over the full history
  (`workflow_dispatch` run 30677734584, 19.19 MB, **«no leaks found»**) plus an
  independent sweep self-tested against synthetic positives first — a scanner
  with a dead regex looks exactly like a clean repo. No JWT of any kind has
  ever appeared in any commit, which is the history-wide answer the earlier
  `git grep` at HEAD could not give. No GitHub/AWS/OpenAI/Slack/Google keys, no
  private-key blocks, no connection string carrying a password, no
  `crypt('literal')`.
- **The merge-commit blind spot was covered separately.** `git log -p` emits no
  diff for a merge, so conflict-resolution content is invisible to gitleaks;
  `f38c4e58` carries 211 such lines. Scanned with `git show --cc` — clean.
- **The Supabase project ref and anon key are PUBLIC BY DESIGN** — the ref is
  in every URL the app calls and the anon key ships in the Expo bundle. They
  are not secrets and are not rotation candidates. RLS is what protects the
  data behind them.
- **⚠ The ONE scheduled full-history scan (2026-07-27) had FAILED and nobody
  saw it**, because a `schedule` run gates no PR. Its two findings were false
  positives — `PAYMOB_HMAC_SECRET=` and `VONAGE_API_SECRET=` at commit
  `39de2d88`, both EMPTY placeholders in SPEC-SETUP-01's embedded
  `.env.example` block. The allowlist covered `.env.example` itself but not a
  doc quoting it. Widened in `.gitleaks.toml`, matched without a directory
  prefix so it survives the `docs/` → `docs/specs/` move already in history.
  **A permanently red scanner hides a real finding exactly as well as a green
  one** — same family as the skipped suite in §9.
- **`pull_request` gitleaks scans only the PR's commits.** A green PR check has
  never said anything about history; only the `schedule` and (new)
  `workflow_dispatch` runs do. `workflow_dispatch` added so a full-history scan
  can be demanded on the spot.

**Seed credential hygiene.** `003_provider_users.sql` already used the psql
variable form and contained no literal — the history check confirms it never
did. It now documents the ENV VARIABLE NAMES (`PROVIDER_TEST_EMAIL` /
`PROVIDER_TEST_PASSWORD`) with bash and PowerShell invocations, and says why:
the repo is public, so removal would not be rotation. No literal credential
exists in any tracked doc or seed.

**`.env*` ignore coverage verified with `git check-ignore`, not by reading
globs** — root `.gitignore`'s `.env` / `.env.*` are pathless patterns and so
apply at EVERY depth. `apps/mobile`, `packages/core`, `packages/design-tokens`,
`packages/config`, `supabase/`, `supabase/functions/` and `scripts/` are all
covered; `.env.example` correctly stays tracked. **No change was needed** — the
per-package `.gitignore` files some of this would have added are redundant.

**CodeQL needed no work** — `security.yml`'s
`if: ${{ !github.event.repository.private }}` self-adjusted when the repo went
public and CodeQL has run and passed on every PR since (verified on the last
three Security runs). Only the stale ENGINEERING-WORKFLOW §4 line claiming it
auto-skips was wrong; corrected.

**⚠ FOR THE FOUNDERS — two decisions this PR deliberately does NOT make:** the
LICENSE placeholder and the vulnerability-disclosure question, both in
Known risks below.

### 2026-08-01 · FIX — the swallowed «تمت الخدمة» click (a cash payment that was never recorded)

**A receptionist could mark a cash booking completed and the money would never
be recorded.** The click produced no error, no toast and no visible change —
the row simply stayed on «وصل». For a cash booking, the desk marking it
completed IS the payment event (`DECISION-commission-attachment`), so a
swallowed click is an uncollected payment with no trace that anything was
attempted.

**Root cause — proven with a network timeline, not argued.** The monotonic
sequence added in P02 ordered reads against each other, but **a read that
started BEFORE a write was still the newest request by sequence number**, so its
pre-write answer was allowed to paint:

```
4139  refetch START                      → the DB still says 'confirmed'
4341  RPC mark_booking_outcome 'arrived'
5327  refetch END → ['confirmed', …]     ← STALE response PAINTS
5454  RPC END     → 'arrived'            ← the database HAD taken the write
5784  RPC mark_booking_outcome 'arrived' ← the desk's next click, wrong outcome
```

The row regressed to `confirmed`. The action button's identity — both its
`data-testid` and the outcome its `onClick` sends — is derived from
`booking.status`, so «تمت الخدمة» silently became «وصل» again and the click sent
`arrived` a second time. The server answered `unchanged: true`, which is a
SUCCESS, so nothing surfaced anywhere.

**Ruled OUT with evidence, not by reasoning:** the debounced realtime refetch
cancelling the handler (the handler fired — it sent the wrong outcome); a stale
`React.memo` closure (there is no `memo` on the row); the `pendingIds`
early-return (an RPC was sent). Each was checked before being discarded.

**The fix, to contract:**

- **A write now invalidates reads in flight**, not merely orders itself after
  them — `invalidateInFlightReads()` bumps the sequence when the mutation starts.
- **No optimistic status.** The row shows an outcome only once the server has
  agreed to it. An optimistic status is indistinguishable on screen from a saved
  one, which is precisely what made the loss invisible. **The desk now sees a
  spinner on the button instead** (§ device/desk re-test below).
- **Pending is held across the write AND its confirming refetch**, so the button
  never re-enables during the window where it would offer an action the next
  response is about to contradict.
- **Re-entry is guarded by a REF, not state** — a second click arriving before
  React re-renders reads the stale set and sails through. Rapid double-click now
  produces exactly ONE write and no error toast (`unchanged: true` is success).

**Proof — the window is now reproducible on a laptop.** Rather than widen a
timeout to suit a slower machine (§9: budgets tuned to one machine are the
disease), the tests `page.route()` the RPC and delay it. Two new Playwright
tests: _a completion survives a SLOW round trip_ asserts the second call
actually carries `completed`, and _a rapid double-click writes ONCE_. Node (7/7)
proves the server half: the write lands, is durable through the RLS-scoped read,
and **a cash completion flips `payment_status` cash → paid and its `payments`
row pending → completed** — the money this bug was losing.

**⚠ THE BUG SURVIVED BECAUSE THE TESTS HAD STOPPED RUNNING.** The suite mutates
the data it tests and nothing reseeded it, so the day drained and nine tests
skipped themselves — CI reported "24 passed, 9 skipped" for two days while the
outcome workflow was not being exercised at all. Three fixes: the E2E job now
**seeds 004 before the suite** (needs a `SUPABASE_DB_URL` repo secret — founder
action below); `dashboard.spec.ts` opens with a **FIXTURE TRIPWIRE** that does
not skip, naming the seed in its failure message; and 004 seeds **three** cash
bookings today instead of two, because the two new tests each consume one.
**Adding a test that consumes a fixture means adding a fixture.**

Two order-dependent tests were also de-coupled from row order: cancel-on-behalf
now selects a _cancellable_ row rather than blindly the first, which is what had
it skipping once the outcome tests consumed the earliest rows.

**Suite: 35 passed, 0 skipped** (was 32 passed + 2 skipped locally, and 24
passed + 9 skipped in CI).

**Founder actions:**

- **Add `SUPABASE_DB_URL` as a repo secret** so CI reseeds the fixtures itself.
  Until then the step is skipped and the tripwire fails loudly instead — which
  is correct behaviour, just noisier.
- **⚠ Desk re-test — a receptionist-visible behaviour changed.** «وصل» /
  «تمت الخدمة» / «لم يحضر» now show a spinner and stay disabled for roughly a
  second while the server confirms, and the status chip no longer flips
  instantly. This is deliberate: the chip is now server-confirmed truth. Worth
  one pass on a real desk to confirm the wait reads as "saving" and not as
  "nothing happened" — that is the one judgement a test cannot make.

### 2026-07-29 · P03 — Services & prices editor (web)

The branch's price list becomes provider-managed. The launch blocker stops
being a code task and becomes a data-entry task for partners.

**⚠ PRE-WORK FIRST, because it protects money.** SPEC-P03 gates on proving that
a price edit can never touch an existing booking. Verified before writing a
line of the feature, and it HOLDS on every path:
`booking_services.price_at_booking` snapshots at booking time · both
`get_patient_bookings` and `get_branch_bookings_for_date` read that snapshot,
never `branch_services.price` · `settle-payment` joins `branch_services` only
for names and preparation notes · `booking-reminder` reads no price at all.
Then proven end-to-end from Node: the price of a service moved 150 → 175 while
an existing booking kept its 400 total and its 150 line price. The design says
as much to the user — «الحجوزات القائمة تحتفظ بسعرها القديم» — and the screen
now shows that sentence above the table, because the person changing a price is
exactly who needs to know it.

**The write path** (migration `20260729175927`): `update_branch_service` owns
validation. Bounds are 1–100,000 EGP; **zero is out of bounds on purpose** — a
free service is modelled by making it unavailable, not by pricing it at nothing.
The absurd-jump guard is a symmetric 10× ratio, deliberately far WIDER than the
UI's confirm threshold: the server is catching a fat-fingered extra digit, not
second-guessing a partner's pricing. Re-saving identical values succeeds
without writing history, so the trail records CHANGES rather than clicks.

**The audit trail:** `branch_service_price_history` — old/new price, old/new
availability, `changed_by`, `changed_at`. Append-only by construction: there is
no INSERT/UPDATE/DELETE policy for anyone, and the SECURITY DEFINER function is
the only writer. It is dispute insurance now and the data behind «آخر تحديث»
today. **The direct-write door is closed in the same migration** — same
discipline as the booking-money fix.

**Two confirm thresholds, on purpose.** The design's type-to-confirm fires at

> 50% or >200 EGP absolute (the absolute arm matters: 10% of a 2,500 EGP scan is
> real money, while 50% of a 45 EGP test is pocket change). The server's guard is
> 10×. They are different numbers because they answer different questions — "did
> you mean this?" versus "is this even possible?".

**«آخر تحديث» is honest.** NULL when a price has never been edited, rendered as
«لم يُحدَّث بعد» in a warning tone. A placeholder price that no partner has
confirmed must not look maintained.

**Verified against the LIVE dev DB (14 Node checks, all passing):** zero,
negative and over-ceiling prices refused · >10× jump AND >10× drop both refused
· another branch's service refused as `service_not_found` · a patient can
neither read the editor nor edit a price · the happy path writes the audit row
and populates «آخر تحديث» · re-saving is an idempotent no-op · **and the money
contract: the existing booking's total and line price are untouched.**

**43 Playwright tests pass** (6 new). Core at **328 tests, 100% lines**.
Fidelity captures in `docs/design-briefs/p03-fidelity/`.

**Decisions / deviations:**

- **«+ إضافة خدمة» renders DISABLED**, per SPEC-P03 §A.3 — the catalogue is
  admin-owned (A-series). A branch sets prices and availability for services it
  already has; it does not invent new ones.
- **Prices are integers.** "150.5" typed on a shared desk is far likelier a slip
  than intent, and a price list has no need of piaster precision.
- **The Playwright test timeout was raised to 90s.** A 30s inner assertion
  inside Playwright's 30s default can never pass — the test dies first and it
  reads as a missing element rather than a budget problem. Every dashboard test
  signs in and then waits on a server-rendered fetch to the remote dev DB with
  three workers contending.

**For P04 (slot allocation) — hand-off:**

- `update_branch_service` is the template for any provider-facing write:
  membership check first, validation server-side, audit row, no client policy.
- **⚠ THE ROLE QUESTION P04 MUST RESOLVE OR EXPLICITLY DEFER:** the design gates
  slot-allocation editing to branch OWNERS, but `provider_users.role` exists
  with no tiers defined and nothing reads it. Every P01–P03 surface treats any
  member of `provider_users` as equally privileged. P04 either introduces the
  tier (and back-fills existing rows) or ships read-only and says so.
- `branch_service_price_history` is the pattern for auditing any other
  provider-editable value.

### 2026-07-29 · FIX — booking money is server-derived (money integrity, no feature work)

**A patient could book a 400 EGP service for 1 EGP.** Booking creation was a
raw client INSERT into `bookings` + `booking_services`, and the only INSERT
policy on either table checked that the booking belonged to the caller — never
what the caller was claiming to PAY. Both `total_amount` and `price_at_booking`
were client-supplied and unvalidated. Proven on dev before the fix, probe rows
deleted afterwards:

```
booking insert: CREATED IH-2026-21236   total_amount = 1
line insert   : ACCEPTED at 1 EGP       real branch_services.price = 400
```

**⚠ Why no real harm occurred: payments are still SIMULATED.** Nothing settles
against a gateway — `MockPaymentProvider` fakes the money and `settle-payment`
records the outcome. This hole is therefore closed **before** live money, not
after. Had PayTabs already been integrated, every one of those 1 EGP bookings
would have been a real underpayment we had no record of disputing. The
launch-blocker ordering matters: **PayTabs must not go live on a booking path
that lets the client price itself.**

Two more gaps in the same missing guard: an `is_available = false` service
could still be booked (mobile filtered it in JavaScript only), and nothing tied
a `booking_service` to the booking's own BRANCH — the FK references
`branch_services(id)` with no branch correlation, so branch A's service could
be attached to a booking at branch B.

**The fix** (migration `20260729160519`): `create_pending_booking` owns every
money fact. The client sends IDENTITIES — slot id, service ids, notes — and the
server derives the per-line price and the total from `branch_services`, rejects
inactive services, inactive branches and inactive providers, requires an active
hold on the slot, and refuses any service that does not belong to the slot's
branch. Duplicate ids collapse so a repeated id cannot inflate a total. **The
old INSERT policies are DROPPED in the same migration** — an RPC beside an open
INSERT is decoration.

The client's displayed total is now advisory: the RPC returns the authoritative
total and the payment screen renders THAT, so a price that moved mid-session is
ordinary staleness rather than an error.

**Regression evidence (10 Node checks, all passing):** the raw INSERT is
refused by RLS · the happy path derives 300 EGP from `branch_services` · the
line price is the real price · another branch's service refused · a mixed
basket refused WHOLESALE · an inactive service refused server-side · a
duplicated id cannot inflate the total · an empty basket refused.

**Recorded as the general law in ENGINEERING-WORKFLOW §5** — third instance
after `confirm_booking`'s grants and `cancelled_by`: any fact with money, state
or identity consequences is server-derived; clients supply identities, never
values; every new INSERT/UPDATE policy is audited against that before merge.

⚠ **Device re-test required before P03 stacks on top** — this changes the
shipped patient booking path.

### 2026-07-29 · CHORE — retire the SETUP-01 root placeholder

`/` served SETUP-01's scaffold proof: an Arabic heading, a cream block and a
line printing `CURRENCY` and a resolved token, all there to show that fonts,
RTL, `packages/core` and the token pipeline worked on web. Every one of those
is proven by a real screen the desk uses daily, so it was just a demo page
greeting staff at the domain root.

The root is now a server-side signpost using the SAME `getProviderContext()`
the dashboard layout uses: staff → Today, signed-in non-staff → the portal
rejected, signed out → the portal. Nothing else referenced the placeholder —
`layout.tsx`'s Arabic description is real app metadata and stays; SETUP-01's
spec mentions it historically and stays. The Playwright smoke test now asserts
the SIGNPOST (redirect + no content of its own) instead of the heading.

**⚠ Fixed a pre-existing infinite redirect loop while pointing the root at the
rejection path.** The dashboard layout sends a non-staff session to
`/login?rejected=1`; middleware saw a session on `/login` and sent it back to
`/dashboard/today`; the layout rejected it again. Reachable whenever a session
exists that is not provider staff — a provider deactivated mid-session, which
is exactly the case the layout calls its backstop. Middleware now exempts
`rejected=1`. The flag was also never READ: the visitor landed on a plain login
form with no idea why, so the login page now shows a warning.

### 2026-07-29 · P02 FOLLOW-UP — founder review: strip scrolling, loading states, prep detail, server-side tables

Four items from the founder's review of the merged P02.

**1 · The day strip could not be scrolled with a mouse.** It worked under
touch emulation, which is what made it look like a mobile-only feature. The
cause is a design decision taken literally: the bundle hides the scrollbar
(`.ih-daystrip::-webkit-scrollbar { display: none }`) and the prototype is only
ever dragged by hand. On a real desk that left NO affordance — a vertical wheel
over a horizontally-overflowing box scrolls the PAGE, and with the scrollbar
hidden there is nothing to drag. Now: wheel is translated to horizontal, ‹ ›
arrows appear only when the strip actually overflows, and the selected day is
scrolled into view. ⚠ `scrollLeft` is NEGATIVE in an RTL container, so the
arrow logic compares absolute distance — reading it as a positive offset is the
classic RTL scrolling bug.

**2 · Navigation felt stuck.** Both dashboard routes are `force-dynamic` and
fetch server-side BEFORE first paint, so a click left the OLD screen on display
with no feedback. Added route-level `loading.tsx` for both, with skeletons that
mirror the real layout (same grid, same row height) so nothing jumps when data
lands. The shimmer respects `prefers-reduced-motion`.

**3 · The drawer's preparation note pointed at nothing.** It rendered only
`computePreparationNotes`' SUMMARY — whose copy is "بعض الخدمات المختارة تتطلب
تحضيراً — اضغط لعرض التفاصيل", an instruction to press something that was not
there. The summary is written to be a HANDLE for the detail. Now the web has a
`PreparationStrip` mirroring mobile's: collapsed summary, click to reveal the
per-service detail in place, from the same core result
(DECISION-provider-data-model §3 — expandable inline, no modal). The desk now
reads «موجات صوتية على البطن: صيام من ٦ إلى ٨ ساعات قبل الفحص», the same words
the patient got.

**4 · Server-side search, filter and pagination** (migration `20260729130341`).
`get_branch_bookings_for_date` gained `p_search`, `p_status`, `p_limit`,
`p_offset` and a `total_count` window — all DEFAULTED, so every existing caller
keeps working. Search matches patient name, phone and booking ref, **folding
Arabic-Indic digits to Western** so a receptionist typing ٠١٠ finds a phone
stored as 010, and escaping `%`/`_` so a stray wildcard cannot widen the match
(verified: searching `%` returns 0 rows, not all of them). Ordering is
`slot_time, id` — an unstable sort silently repeats or drops rows across pages.
The toolbar renders even when the result set is EMPTY, because a filter that
matches nothing must still offer the way back out.

**Verified in a real browser** at a narrow desktop width: search 6 → 1 rows,
status filter leaves only matching chips, no-match state keeps the search box
reachable, prep detail expands with real text, strip `scrollLeft` 0 → 380 on an
arrow click. Two new fidelity captures in `docs/design-briefs/p02-fidelity/`.

**⚠ A latent test race, exposed and fixed.** Nine P02 tests began SKIPPING
themselves: `test.skip((await rows.count()) === 0)` runs before the RSC payload
paints, so the guard read 0 rows and skipped. They had been passing by luck of
timing. **A skipped suite looks exactly like a passing one in the summary
line** — the same lesson as the credentials skip in §4. Every `beforeEach` now
waits for the table, with a 30s budget because it waits on a server-rendered
fetch against the remote dev DB while three workers contend.

**Note for whoever runs the suite:** the outcome-workflow E2E CONSUMES its
fixture — it marks a booking completed on every run — so a second same-day run
skips with "no actionable booking today". That is honest, not broken; reseed a
confirmed booking for today to exercise it again.

### 2026-07-29 · P02 — Booking detail drawer, cancel-on-behalf & upcoming days (web)

The desk can now open any booking, read its whole story, cancel it on the
patient's behalf when they phone in, and look past today.

**⚠ FOURTH SECURITY HOLE — and the first one reachable WITHOUT LOGGING IN.**
`cancel_booking` decided "is this caller privileged?" with `auth.uid() IS NULL`,
treating _no session_ as _the server_. But an **anonymous caller holding only
the public anon key also has `auth.uid() = NULL`** — and `cancel_booking` was
the one provider RPC that additionally granted EXECUTE to `anon`/`PUBLIC`.
Proven on dev BEFORE the fix, non-destructively (target: an already-cancelled
booking, where the authorization guard and the status guard return different
errors): a plain `fetch` with the public key came back `cannot_cancel` — the
STATUS guard — instead of `booking_not_found`. It had passed authorization.
**Any booking, cancellable by anyone with the anon key, no account required.**

The discriminator that actually works inside a SECURITY DEFINER body is
`auth.role()`. `current_user` there is the function OWNER, not the caller, so it
can NEVER serve as an authorization signal — measured, not assumed:

| caller               | `auth.uid()` | `auth.role()` | `current_user` |
| -------------------- | ------------ | ------------- | -------------- |
| anon key, no session | NULL         | `anon`        | `postgres`     |
| pg_cron / direct SQL | NULL         | NULL          | `postgres`     |

New `is_internal_caller()` keys off that. Both layers were then verified
independently: the grant rejects anon with HTTP 401, and with the grant
temporarily restored the **body itself** returns `booking_not_found`.

**`cancelled_by` was written verbatim from the client.** Nothing checked the
caller was entitled to the label it claimed, so a patient could record their own
cancellation as `'provider'` — corrupting the exact discriminator the dashboard
reads to tell a desk cancellation from a patient one, and that
`DECISION-booking-outcome-lifecycle` requires to stay honest forever. The claim
is now VERIFIED against the caller's real capacity rather than overridden, so a
receptionist who is also a patient at their own branch is recorded correctly
from either app — which a blind override would get wrong in one direction.

**The future-day rule did not exist server-side.** SPEC-P02 §B asked for it to be
verified; it wasn't there. `mark_booking_outcome` checked only the status
transition, never the date, so nothing stopped the desk marking tomorrow's
patient arrived. It now returns `slot_in_future`, and core's
`getPrimaryOutcomeAction`/`canMarkNoShow` take `cairoTodayIso` as a **required**
argument — optional would be forgotten, and forgetting it offers «وصل» on
tomorrow's rows.

**Migration `20260729021321`** carries all three plus the columns the drawer
needs (`slot_date`, `confirmed_at`, `cancelled_by`, `cancellation_reason`,
`closed_by` — the drawer's «أُغلق تلقائياً» was impossible without the last one),
and revokes two maintenance functions (`cleanup_expired_holds`,
`generate_branch_slots`) that were needlessly anon-callable.

**`database.ts` was stale well beyond this migration** — `bookings` was missing
`closed_by`/`arrived_at`/`no_show_at`, and `get_branch_bookings_for_date` and
`mark_booking_outcome` were absent entirely. That is what the `any` escape hatch
in `branch-bookings.ts` was working around. **P01 shipped without a type regen**
(ENGINEERING-WORKFLOW §5 requires it in the same PR).

**ONE implementation serves both screens.** The spec's consistency rule only
holds if the realtime and mutation plumbing is shared too, not just the row — so
`useBranchBookings` (data, realtime, mark, cancel) and `BookingsPanel` (list,
drawer, confirm) are shared verbatim; Today and Upcoming differ in their header
and their date, nothing else. The row renders two column layouts (Today keeps
الإجراء; Upcoming drops it for a ‹ chevron) but behaviour is governed by the date
predicate, not by which grid was chosen.

**Realtime: refetch-on-event, debounced — founder-ratified.** The broadcast
payload is `{booking_id, op, status}` and carries **no date**, so the spec's
"filter client-side by the viewed date" is not possible. Instead any branch
event refetches the VIEWED date through the RLS-scoped function and the database
answers — display predicate = enforcement predicate by construction. Debounced at
400ms so a burst (the nightly auto-close touching a dozen bookings) collapses
into one query. **Upgrade path if volume ever makes this heavy: add the date to
the broadcast payload** — a note for then, not work for now.

**The duration line is real data, not decoration** — `branches.slot_duration_minutes`,
and the line DISAPPEARS for a branch with NULL/0 rather than falling back to a
number. ⚠ Honesty check requested by the founder, and it contradicted the
premise: the column survived the capacity rewrite cleanly (24/24 branches, no
NULLs, Town included) but **no longer describes the slot grid** — spacing is now
`opening window ÷ allocation` (Saridar 150 min, Town 120 min, both declaring 30),
and there is exactly ONE distinct value across all 24 branches. It is a fair
statement of how long a visit TAKES, which is what the line claims, but treat it
as a placeholder like the seeded prices until a partner confirms it.

**Verified against the LIVE dev DB (19 Node checks, all passing):**

- Patient session (7): a patient claiming `'provider'` or `'admin'` is refused
  `invalid_canceller` · the owner's own `'patient'` claim still passes · a
  patient reading a branch day gets zero rows · cannot mark an outcome · both
  maintenance functions refused.
- Provider session (12): the branch read exposes all five new columns and the
  patient name/phone · `slot_in_future` for a real staff caller · cancel-on-behalf
  succeeds and the server ECHOES `cancelled_by: 'provider'` · another branch's
  booking refused indistinguishably from a missing row · another branch's day
  returns zero rows.
- Capacity release confirmed: the cancelled booking's slot went `booked_count`
  1 → 0 and is bookable again.

**Fidelity proven, not asserted** (ENGINEERING-WORKFLOW §9) —
`docs/design-briefs/p02-fidelity/`, captured at 1366×768. **26 Playwright tests
pass**, including 9 new P02 ones.

**Decisions / deviations:**

- **The design's «أُرسل تنبيه التجهيزات — رسالة نصية» history row is deliberately
  ABSENT.** `notifications` is not exposed to the dashboard and the read function
  does not return it, so rendering it would be decoration claiming to be a
  record. Every timeline entry comes from a populated timestamp. 🎨 Either widen
  the function in a later P-feature or drop the row from the design.
- **Drawer and confirm are screen-level compositions, not DS components** — the
  `_ds` bundle ships Button/Card/Alert/Chip/PreparationNote/StatusBadge/Input/
  Select/Textarea and the nav patterns, but **no modal**. `PreparationNote` WAS
  added to the shared contract, transcribed from the bundle source.
- **Scrim and drawer are `fixed`, not `absolute`** — the design anchors them to
  the ROOT shell so they cover the sidebar and header; the shell is `h-screen`,
  which makes viewport-fixed exactly equivalent. A scrim confined to `<main>`
  leaves the nav looking live when it is not (caught in the first capture).
- **Playwright never loaded `.env.local`.** The E2E header has said "Local: set
  PROVIDER_TEST_EMAIL / PROVIDER_TEST_PASSWORD in apps/web/.env.local" since P01,
  but nothing loaded that file into the runner's process — so the dashboard suite
  skipped locally while passing in CI. Fixed in `playwright.config.ts`; CI values
  always win over a local file.
- **The sidebar still rendered a `⚕` emoji** although `Logo` with the real mark
  existed and the P01 follow-up reported it restored — a leftover, corrected here.
- **`today-list` → `bookings-list`**: Today and Upcoming render the same panel
  now, so a Today-specific test id would have been a lie.

**Still true from P01:** the connection-dot issue (dot flips to «غير متصل» after
marking an outcome) was NOT investigated here — it is untouched by P02 and still
wants a production-build check.

**For P03 (services & prices editor) — hand-off:**

- `useBranchBookings` + `BookingsPanel` + `BookingRow` are the reusable set. The
  row takes `showActions`; anything read-only passes `false`.
- **The realtime payload carries no date — do not try to filter on it.** Refetch
  the viewed scope and let the database answer. Enriching the payload is the
  upgrade path if event volume grows.
- The transition table in `provider-bookings.ts` mirrors `mark_booking_outcome`
  INCLUDING the future-day rule — change one, change both, same PR.
- `branch_services` is the P03 table: `price`, `is_available`, `custom_tat_hours`,
  `home_collection`/`_fee` per branch, joined to `services` for names and
  preparation notes. Prices are all PLACEHOLDERS today (Known risks).
- Dev fixtures left in place on purpose: two confirmed bookings TOMORROW at Town
  (one cash with preparation, one prepaid) so Upcoming Days has rows, plus one
  provider-cancelled booking today showing the `cancelled_by='provider'` trail.

### 2026-07-28 · P01 FOLLOW-UP — shared design-system contract, design restructure, outcome lifecycle

The founder's review of the first P01 build: "the UI has nothing to do with the
design that was handed off" and "why do I feel we are re-inventing the wheel in
the design aspect — this should be a shared resource, not per project." Both
correct, and the second one found a real architectural hole.

**⚠ ROOT CAUSE OF THE UI DRIFT: every padding utility in the web app was
silently dead.** `tokens.css` carries a `*, *::before, *::after { margin: 0;
padding: 0 }` reset. Imported unlayered AFTER `@import 'tailwindcss'`, it landed
outside Tailwind v4's cascade layers — and **unlayered CSS beats layered CSS
regardless of specificity** — so it deleted every `p-*` and `m-*` in
`apps/web`. `gap-*` survived (the reset does not touch `gap`), which is exactly
why the breakage read as "the design is wrong" rather than "the CSS is broken".
Proved it in the browser: `getComputedStyle` returned `padding: 0px` on an
element with `p-11`, and the `.p-11` rule was never generated at all. Fixed with
`@import '…/tokens.css' layer(base)`. **No amount of correct markup could have
rendered correctly before this.**

**The shared component contract (the architectural fix).** The design system
defines 13 components; neither app implemented any of them as a system.
`packages/design-tokens` shared VALUES but there was no contract for what
"Button, size=lg, variant=outline" MEANS — so mobile hardcoded `h-[52px]`, the
dashboard hardcoded `h-9`, and both were wrong. New
`packages/design-tokens/src/components.ts` encodes Button/Card/Alert/Chip/
StatusBadge/Input sizes + variants → token mappings, transcribed from the `_ds`
bundle source. A `resolve.ts` turns refs into CSS vars (web) or literals (RN),
so ONE spec serves both platforms and each app writes a thin shell. 17 new
tests, including one asserting every ref in the contract resolves on both
platforms, and one pinning `confirmed` to the design system's **#028090
cerulean** — not the green I had invented a `successText` token for.

**Mobile keeps its current components for now**; retrofitting them onto the
contract happens opportunistically as screens are touched — **the i18n pass is
the natural moment**, since it rewrites the same JSX anyway.

**design/ restructured to ONE bundle.** Claude Design exports the whole project
every time, so per-surface folders were self-deceiving duplicates:
`design/mobile/` was a stale 6-screen subset sitting beside the 12-screen
`design/dashboard/`, with a byte-identical `_ds` in both (verified by hash). Now
`design/handoff/` — latest export only, replaced wholesale, with `EXPORT.md`
logging each export; `design/brand/` keeps our extracted assets. CLAUDE.md §3a
rewritten, all path references swept, `.prettierignore` glob updated.

**Dashboard Login + Today rebuilt on the contract**, including everything the
first build dropped: the real logo SVGs (I had substituted a ⚕ emoji), the
"هل نسيتها؟" link, the remember-me checkbox, the sound toggle, the print button,
the new-arrival banner, and the row overflow affordance.

**Fidelity is now proven, not asserted.** `apps/web/e2e/fidelity.spec.ts`
captures at 1366×768 (the DESIGN-02 desktop floor) into
`docs/design-briefs/p01-fidelity/`. New ENGINEERING-WORKFLOW §9: **any PR
claiming design fidelity ships comparison screenshots in its body.**

**Both open business decisions ratified** — see `docs/decisions/`:

- **`DECISION-booking-outcome-lifecycle.md`** — the desk marks outcomes; a
  nightly job (02:30 Cairo) closes anything still open >24h after its slot, as
  `no_show` with `closed_by = 'system'`. The 24h grace exists so the desk can
  fix yesterday honestly before the system guesses; system guesses stay
  distinguishable from human judgements **forever** so future reputation logic
  excludes them; and an auto-closed CASH booking does NOT flip to paid — nobody
  collected anything. Verified on dev against a seeded stale cash booking:
  `no_show` + `payment_status` still `cash` + `payments` still `pending`.
- **`DECISION-commission-attachment.md`** — at payment for prepaid, at
  completion for cash. We only bill a partner for a visit that happened and
  money that moved. `confirmed_at` / `completed_at` / `no_show_at` / `closed_by`
  are the data trail; nothing computes commission yet, and auto-closed bookings
  never attach any.

**Slot-horizon sanity check — both pass, nothing was broken.** All 24 branches
hold slots to 2026-08-27 (exactly the 30-day rolling window), and
`generate-slot-window` ran at 00:10 UTC with status `succeeded`
(`cleanup-expired-holds` healthy too). The founder could not book at 10 PM
because only Today is visible on the dashboard — expected, and resolved by P02's
date switcher.

### 2026-07-28 · P01 — Provider Dashboard: auth, shell & Today view (web) — 🎉 MILESTONE ONE

**The loop is closed.** A patient books on a phone → the branch's desk sees it →
the desk records what happened. `apps/web` is a real product for the first time.

**⚠ THIRD SECURITY-SHAPED DECISION, made BEFORE writing the function this time.**
F06 and F07 each shipped a SECURITY DEFINER function that trusted an id
(`confirm_booking`, then `cancel_booking`). P01 adds two more —
`mark_booking_outcome` and `get_branch_bookings_for_date` — and both open with
the branch-membership check, return `booking_not_found` to non-staff (never
confirming an id exists), and were granted explicitly to `authenticated` +
`service_role` only. The NULL-safety trap is handled too: `get_provider_branch_ids()`
returns NULL for a non-provider, so every membership test is wrapped in
`COALESCE(..., FALSE)` — without it the OR-chain evaluates to NULL and an
`IF NOT (...)` falls through to ALLOW.

**The Today view cannot be built from table queries — and that shaped the whole
feature.** `users` has no provider SELECT policy (only `id = auth.uid()` or
admin), so a receptionist cannot read the patient name and phone the desk exists
to use. Widening a PII table's RLS for every provider would have been a far
worse trade than one scoped function, so reads go through
`get_branch_bookings_for_date` — same shape as F07's `get_patient_bookings`.
This is the pattern for every provider-facing read: add columns to the function,
don't join from the client.

**The outcome workflow** (answering F07's open decision #1 — _who marks the
outcome_): `arrived` was added to the status constraint, plus `arrived_at` and
`no_show_at` timestamps. `mark_booking_outcome` enforces
`confirmed|pending_payment → arrived|no_show` and `arrived → completed|no_show`
and nothing else; completed/cancelled are terminal. Re-marking a state a booking
is already in is an idempotent no-op success, so a double-clicked وصل cannot
raise a second error toast.

**Cash completion IS the payment event — the DB-contract interpretation, made
explicit.** `confirm_booking` writes a cash booking as
`bookings.payment_status='cash'` + `payments.status='pending'` (read from
20260616164733, not assumed). Marking it completed flips both to `paid` /
`completed`. Prepaid bookings are already settled and are left untouched; a
no-show never becomes paid.

**Realtime is the BROADCAST pattern, NOT postgres_changes — a deliberate
deviation from the spec.** SPEC-P01 §C asks for a postgres_changes subscription.
ENGINEERING-WORKFLOW §5 records why this repo rejected exactly that
("postgres_changes would leak RLS-hidden rows or deliver nothing"), and
`supabase_realtime` publishes **zero tables** today — verified. So P01 follows
migration 20260726205901: a trigger broadcasts `{booking_id, op, status}` to the
private topic `branch-bookings:{branch_id}`, and the dashboard refetches through
the RLS-scoped function. Receive-side auth is stricter than the hold topics:
those are open to any patient, this one requires the topic's branch to be one
the caller actually works at. **Founder call if you want the spec's version
instead** — it would mean publishing `bookings` and accepting per-subscriber RLS
filtering on every row.

**Web foundation (the choices that carry):** `@supabase/ssr` with `getUser()`
everywhere — never `getSession()`, which trusts an unverified cookie. Middleware
answers "signed in?" and refreshes the token on every request; the dashboard
layout answers "staff?" once, server-side, where the answer is needed anyway —
a provider_users lookup is too expensive to run in middleware. The login action
signs a non-provider straight back OUT rather than leaving a half-authenticated
session on a shared front desk. Branch id is derived server-side from
provider_users and never read from a URL. Anon key only — the service-role key
would bypass every check the feature relies on.

**Verified against the LIVE dev DB and in a REAL BROWSER:**

- Node, 24 checks: provider login works (the seeded auth rows are hand-written —
  see below) · `get_user_role` resolves to `provider` by TABLE LOOKUP, not a JWT
  claim · a Saridar receptionist gets **zero rows** for a Town branch · a patient
  gets zero rows and cannot mark an outcome · every legal and illegal transition
  · double-click idempotency · cash completion flips `payment_status` AND
  `payments.status` · terminal states refuse further transitions.
- Realtime, 3 checks: a new booking INSERT, its confirmation, and an outcome
  change all reach a subscribed desk.
- Browser: signed in as the Town receptionist → Today view rendered the branch,
  the Cairo date, `٣/٥ محجوز اليوم`, and rows with patient/phone/services/prep/
  payment/chip/actions → clicked وصل → chip flipped and the action became
  تمت الخدمة → clicked it → DB confirmed `completed`, `payment_status=paid`,
  both timestamps stamped.

**Dev provider accounts** (`supabase/seeds/003_provider_users.sql`):
`reception@townhospital.eg`, `reception2@townhospital.eg`,
`reception@saridarlabs.com`. The password is **deliberately not committed** —
it is supplied to the seed as `:provider_password` at run time and to Playwright
via `PROVIDER_TEST_PASSWORD`. A dev password in the repo is still a hardcoded
credential (CLAUDE.md §8); GitGuardian caught exactly that on the first push of
this PR and was right to.
⚠ The `auth.users` rows are hand-written SQL because **no service-role key was
available to the session**; the Admin API is the normal path. Both `auth.users`
AND `auth.identities` rows are required (an identity-less user cannot sign in),
and login was PROVEN from Node afterwards. If these are ever regenerated, prove
it again rather than assuming.

**Decisions / deviations:**

- **Realtime broadcast instead of postgres_changes** — see above. Flagged.
- **Multi-branch is out of scope and FLAGGED**: `provider_users.branch_ids` is an
  ARRAY, so a user can legitimately have several. P01 takes the first. A branch
  switcher is P03+ work.
- **Sidebar items for P02+ render DISABLED, not hidden** — the receptionist sees
  where the product is going without hitting dead links.
- **`arrived` reaches the PATIENT app too.** `BOOKING_STATUSES` is shared, and
  TypeScript's exhaustive `Record` caught the missing mobile chip immediately —
  a patient checking حجوزاتي while standing at the desk now sees «وصل» rather
  than a blank chip. A new `info` tone was added for it.
- **`@supabase/supabase-js` bumped to ^2.111.0 across the workspace** —
  `@supabase/ssr` requires it. One version for all three packages beats two
  copies. Mobile Metro export and all mobile tests pass on it, but this is the
  one change in this PR that touches the shipped mobile app.
- **`getBookingStatusChip` / `getBookingPaymentLabelAr` now take the
  status/payment-bearing SHAPE**, not a whole `PatientBooking`, so the dashboard
  reuses them without a cast. One source, two surfaces, no drift.

**Known issue — not blocking, needs one look:** after marking an outcome in the
browser the connection dot flipped from «التحديث فوري» to «غير متصل», with no
console errors. Realtime delivery itself is PROVEN at the channel level (3/3
Node checks) and the fallbacks (focus refetch + 60s poll) keep the list correct
either way, so this is likely the status callback of a torn-down channel under
React StrictMode's double-effect in dev — but it is user-visible and should be
confirmed against a production build before P02.

**For P02 (booking detail drawer + cancel-on-behalf) and P03 (upcoming days) —
hand-off:**

- `BookingRow`, `StatusChip` and core's `getPrimaryOutcomeAction` /
  `canMarkNoShow` / `getBranchPaymentLabelAr` are the row APIs to reuse. The
  transition table in `provider-bookings.ts` mirrors `mark_booking_outcome`
  exactly — change one, change both, in the same PR.
- P03 needs `get_branch_bookings_for_date` with a different date, nothing more —
  it already takes the date as a parameter.
- P02's cancel-on-behalf calls `cancel_booking`, which since F07 requires the
  caller to be branch staff and **exempts provider/admin from the slot-start
  boundary** — reception can cancel a past booking, a patient cannot.
- Open business decision #2 (commission attachment) is now _computable_:
  `arrived_at` / `completed_at` / `no_show_at` are populated. Still unratified.

### 2026-07-28 · F07 — My Bookings: list, detail & cancel (mobile)

حجوزاتي is real. A patient can see every booking they have made, split into
القادمة / السابقة, open one, and cancel it — which gives the slot back to the
branch immediately.

**⚠ SECOND SECURITY HOLE FOUND AND CLOSED — worse than F06's.**
`cancel_booking()` is SECURITY DEFINER, granted to `authenticated`, and matched
on booking id ALONE. SECURITY DEFINER bypasses RLS, so **any signed-in patient
could cancel any other patient's booking by guessing a UUID** — and unlike the
F06 hole this one was reachable from shipped code. Proven from Node against dev
BEFORE fixing: patient B called it with patient A's booking id and got
`{"success": true}`; A's confirmed booking was cancelled and the slot
decremented. Migration `20260728120808` adds the authorization the function
never had (owner · branch staff · admin · service_role) and re-verified: B now
gets `booking_not_found`, deliberately indistinguishable from a missing row so
the function never confirms a stranger's booking id exists. **Lesson recorded in
ENGINEERING-WORKFLOW §5: audit every EXISTING SECURITY DEFINER function when you
touch a feature — the function body is the boundary, not RLS.**

**The read path had to be a function too.** The `slots` SELECT policy is
`booked_count < capacity`, so a patient cannot read the slot of their own
fully-booked booking — `bookings → slots` returns NULL for exactly the rows this
screen exists to show (verified against dev; it was flagged in F06's hand-off
and turned out to be true). New SECURITY DEFINER `get_patient_bookings()`
returns each booking denormalised with `slot_date`/`slot_time`, branch fields,
the derived `is_hospital` badge and services as JSONB. It takes **no user id** —
the filter is `auth.uid()` inside — because a `p_user_id` parameter would be the
cancel_booking hole again for reads. It also drops `pending_payment` rows, which
are flow debris and never a "booking" to the patient.

**The cancellation policy is the spec's, NOT the design's.** SPEC-F07 ratifies:
cancellable **any time before the slot starts, free, no fees, every payment
method**. The design bundle's "الإلغاء مجاني قبل الموعد بـ ٤ ساعات" is OUTDATED
copy — the app now says «يمكنك إلغاء الحجز مجاناً في أي وقت قبل الموعد» and there
is deliberately **no cancellation-fee logic anywhere in the stack**. Migration
`20260728125850` adds the slot-start boundary to `cancel_booking` so display and
enforcement are the same predicate: the button hides at slot start and the
server returns `slot_started` there. The boundary applies to the PATIENT only —
provider staff, admins and service_role keep cancelling past bookings, because
reception must be able to close out a no-show and the abandoned-booking cleanup
path calls the same function. 🎨 **The design bundle needs a copy revision on
that one line** (dialog layout unchanged).

**Core** gained `business/bookings.ts` with the three functions the spec names:
`partitionBookings` (a booking is upcoming only while it is BOTH live and yet to
happen, so a cancelled future appointment sits under السابقة exactly as the
design draws it), `getBookingStatusChip` for all six `bookings.status` values
with a tone that always travels with its label, and `isCancellable` — plus
`getBookingPaymentLabelAr`, the single source for the F06 cash-vs-paid line that
now renders on BOTH the card and the detail screen. Upcoming sorts soonest-first
and past most-recent-first — different on purpose, and both match the mockup.
29 new tests; core is at **249 tests, 100% lines**.

**Screens:** `(app)/bookings/` became a nested stack — `index.tsx` (the list)
and `[id].tsx` (detail), per the spec's route. Nesting is also what keeps the
tab bar visible on both, which `DECISION-navigation-safe-areas` §1 requires for
"My Bookings (list + detail)". The list has the title, two tabs, cards
(icon/provider/services/status/date/payment line/ref), pull-to-refresh,
**refetch-on-focus**, and TWO empty states — the warm first-run moment for a
patient with nothing, and a quieter per-tab empty that does not nag. Detail
renders the provider gradient card, services + total, preparation strip, payment
card, patient notes, and **F04's اتصال / الاتجاهات actions plus add-to-calendar
reused, not rebuilt**; an unknown or foreign id gets a friendly "لم نجد هذا
الحجز" with a way back rather than a silent redirect. The cancel bottom sheet
(`CancelBookingSheet`) makes the SAFE action the primary button.

**Refetch-on-focus, not just on mount.** Both screens stay MOUNTED under Tabs,
so `refetchOnMount` alone would leave a stale status sitting there for as long
as the app is open — a booking confirmed or cancelled elsewhere must never still
read "مؤكد". Both use `useFocusEffect`.

**Verified against the LIVE dev DB from Node (three scripts, 33 checks, all
passing):** cross-patient cancel refused · owner cancel succeeds and
`booked_count` is decremented · double-cancel refused with `cannot_cancel` ·
**a patient cancelling after the slot start refused with `slot_started`, and
core's `isCancellable` agrees on the same row (display ≡ enforcement)** ·
`get_patient_bookings` returns slot data the direct read still cannot see ·
patient B's list never contains patient A's booking · every row survives the
core helpers with a valid instant · `branch_phone` reaches the اتصال action ·
the cash payment line resolves · a cancelled booking moves tabs and stops
offering cancel. All probe rows cleaned up afterwards; dev holds only the
founder's own device-test bookings.

**Decisions / deviations:**

- **Tab bar stays VISIBLE on the booking detail screen.**
  `DECISION-navigation-safe-areas` §1 explicitly names "My Bookings (list +
  detail)" as a destination; the approved mock draws no bottom nav there. The
  decision doc is the normative global rule and wins, so the sticky cancel bar
  sits above the tab bar. **Flagged for founder review** — if the mock was the
  intent, this is a one-line change.
- **Cancelling does NOT emit a realtime broadcast — verified, not assumed.** The
  only broadcast trigger is `trg_slot_holds_broadcast` on `slot_holds`
  INSERT/DELETE (migration 20260726205901). Cancelling touches `bookings` and
  `slots`; the hold was already deleted at confirm time, so nothing fires. Other
  patients get the freed slot on their next refetch — focus, or the picker's
  60-second poll — not instantly. **Per the spec this is acceptable and is
  recorded here rather than papered over.** Making cancels live would mean a
  broadcast trigger on `slots`, which is a separate change.
- **`booking-reminder` already excludes cancelled bookings — proved, not
  assumed.** It filters `.eq('status', 'confirmed')`
  (`supabase/functions/booking-reminder/index.ts:41`), and a cancelled row can
  never match. No change needed.
- **`successText` added to design tokens** (`#01705A` on `#E5F7F4`, ~5.5:1). The
  mint `success` on its own tint is ~1.9:1 and unreadable at the badge's 11.5px
  — the same pairing warningText/errorText already had.
- **The detail screen reads from the LIST's cache, not its own query.** The row
  already carries everything it renders, so there is one source of truth and
  cancelling invalidates exactly one key.
- The empty-state illustration slot ships as the design's cream disc with an
  emoji — no artwork was in the handoff bundle, and blocking on an asset was not
  worth it.

**Also fixed here (device report):** starting a SECOND booking at the same
provider left step 1 blank and stuck. The branch screen registered the branch in
`useEffect(..., [branch, openBranch])` where `branch` is TanStack's `data` — a
referentially stable cached object — and the screen stays mounted under Tabs, so
returning never re-ran it. `completeBooking()` had nulled `branchId`, so the slot
query sat `enabled: false` behind its skeleton. Two-sided fix: `completeBooking`
now KEEPS the branch (it is where the patient is, not part of the booking), and
the branch screen re-registers whenever the store drifts from the branch on
screen instead of waiting for a reference change that never comes.

**⚠ TWO OPEN BUSINESS DECISIONS FOR THE FOUNDERS (raised by SPEC-F07, needed
before P-series reporting is designed):**

1. **Who marks a booking's outcome, and when?** Nothing in the system ever sets
   `completed` or `no_show` today — so the السابقة tab currently fills only with
   `cancelled` rows and past-dated `confirmed` ones, and F09 reviews (which hang
   off a completed booking) have nothing to attach to. **The status enum already
   supports both** (`bookings_status_check` allows `pending`, `pending_payment`,
   `confirmed`, `completed`, `cancelled`, `no_show`) — **no migration needed**,
   only a decision about who writes it: a receptionist action in the P-series, a
   cron that completes past confirmed bookings, or both.
2. **When does commission attach?** At payment for prepaid, at completion for
   cash is the **recommended** split (you only bill a partner for a visit that
   happened), but it is unratified. This shapes P-series reporting and partner
   invoicing, and `bookings.commission_amount` / `commission_rate` are still
   unwritten either way.

**For F08–F09 / P01–P06 — hand-off:**

- `get_patient_bookings()` is the pattern for any patient-facing read that
  touches `slots`. Add columns to it rather than joining from the client.
- **Statuses and payment semantics the dashboard MUST mirror:** a `confirmed`
  booking is either `payment_status = 'paid'` (prepaid, money simulated) or
  `'cash'`/`'pending'` with `payment_method = 'cash'` — the receptionist has to
  see that difference, because a cash patient still owes money at the counter.
  `cancelled` rows keep `cancelled_by` (`patient` / `provider` / `admin`) and
  `cancelled_at`, so the dashboard can tell a patient cancellation from its own.
  The patient app renders that distinction through core's
  `getBookingPaymentLabelAr` and `getBookingStatusChip` — reuse them rather than
  re-deriving, or the two surfaces will drift.
- `cancel_booking` now refuses a caller it does not recognise. When the provider
  dashboard cancels on a patient's behalf, the staff account must be in
  `provider_users` with the branch in `branch_ids`, or it will look like a bug.
  Provider/admin callers are deliberately exempt from the slot-start boundary.
- `cancelled_at` is populated on every cancellation, so late-cancel patterns are
  measurable whenever v2 wants them. No user-facing consequence in MVP.

### 2026-07-27 · F06 — Payment (mock provider), settlement, confirmation & SMS (mobile)

Step 4 closes the booking loop. A patient can now go discover → select → hold →
review → pay → **confirmed booking with a payments row and a confirmation SMS**.

**The architecture (what makes PayTabs a drop-in later):** the client asks a
`PaymentProvider` for an outcome, then posts that outcome to the new
`settle-payment` Edge Function — which is the ONLY caller of
`confirm_booking()`. Swapping the mock for PayTabs changes the provider module
and adds an IPN handler that posts the SAME shape; the settlement path does not
move. Core gained `business/payment.ts` (the `PaymentProvider` interface,
`createMockPaymentProvider`, the method catalogue + Arabic labels, the
confirmation DTO), `business/payment-paytabs.ts` (a stub that REJECTS rather
than silently succeeding, documenting credentials, hosted-page flow, IPN
signature verification and the method-lineup mismatch), `business/sms.ts`, and
`schemas/payment.schema.ts`.

**⚠ SECURITY HOLE FOUND AND CLOSED.** `confirm_booking()` is SECURITY DEFINER
and Postgres grants EXECUTE to PUBLIC by default — so since the schema was
written, **any authenticated patient could confirm their own pending booking
straight from the client, skipping payment entirely**. Migration
`20260727111326_settlement_boundary_and_notification_skipped` revokes it from
PUBLIC/anon/authenticated and grants service_role only. Verified from Node with
a real patient session: `permission denied for function confirm_booking`.
(`cancel_booking` deliberately keeps its client grant — the app needs it and it
moves no money.) The same migration adds `'skipped'` to `notifications.status`
so suppressed test-number SMS is audited honestly instead of as `'failed'`.

**`settle-payment` (Edge Function, verify_jwt + in-function ownership check):**
validates the request, refuses another patient's booking, **re-checks the hold
is still live** (confirm_booking does NOT check holds — without this an expired
hold could still consume capacity), calls `confirm_booking()`, builds the
confirmation DTO, and fires the SMS. **Idempotent**: a second settle returns the
confirmed state with `alreadyConfirmed: true`, no second payments row, no second
increment, no second SMS — PayTabs retries IPNs, so this was built and tested
now, not later.

**Screens:** `booking/payment.tsx` replaces the F05 stub — recap, the design's
three method rows (بطاقة / فوري / نقداً) with a visible **"وضع تجريبي"** badge, a
DEV-only failure toggle, and the design's full payment-failure state (red row,
Arabic alert, "حاول مرة أخرى", "موعدك ما زال محجوزاً"). New
`app/(app)/confirmation.tsx` per the newly approved confirmation design: success
moment, DB-issued `IH-2026-XXXXX` ref, branch/slot/services recap, "الإجمالي
المدفوع" with the method line, the consolidated preparation notes,
add-to-calendar (`expo-calendar`), and عرض حجوزاتي.

**The F05→F06 landmine, handled:** payment.tsx calls `useBookingStore.reset()`
BEFORE `router.replace('/(app)/confirmation')`. Otherwise the segments watcher
in `(app)/_layout` sees lingering flow state the moment the route leaves
`/booking` and `cancel_booking`s the booking that was just confirmed. There is
now a unit test asserting `reset()` leaves nothing behind, and the Maestro flow
asserts back-navigation cannot re-enter the flow.

**Hold expiry is now ONE path.** Added `holdExpired` to the booking store and
`features/booking/expiry.ts`: both the flow timer hitting zero AND the server
answering `hold_expired` run the same teardown and raise the same modal —
display state derives from the predicate the server enforces.

**Verified against the LIVE dev DB from Node (both static test users, 60 checks,
all passing):** hold → pending booking → settle for **card, fawry and cash**;
booked_count incremented exactly once; payments row with the right
amount/status/gateway_txn_id; hold deleted; **user B sees the slot as full
immediately via `get_branch_slots` and is refused `slot_full`**; double-settle
idempotent; failed payment leaves the booking payable with its hold intact, and
a cash retry then succeeds; settlement without a live hold rejected
(`hold_expired`) with the slot NOT consumed; B refused on A's booking; the
client denied `confirm_booking` outright; bad input rejected. All test rows
purged afterwards.

**Core: 214 tests, 100% lines** (was 172). Mobile: 81 unit tests.

**Decisions / deviations (all deliberate):**

- **Payment provider is PayTabs, not Paymob** — CLAUDE.md §2/§8, PRODUCT.md §7,
  `.env.example` and `.gitleaks.toml` updated. **We have NO PayTabs account and
  no credentials (not even test ones) — the legal entity is pending — so the
  mock ships** and every payment screen carries the test-mode badge.
- **Method lineup follows the DESIGN, not the spec prose.** The spec said
  بطاقة / فوري / محفظة فودافون; the approved design renders بطاقة / فوري /
  **الدفع نقداً عند الوصول**. Design wins (it is the visual contract and cash is
  a real Egyptian need). Noted in code: PayTabs Egypt has neither Fawry nor
  Vodafone Cash — its methods are aman/meezaqr/valu/creditcard — so the final
  lineup is an OPEN PRODUCT DECISION needing a design revision and a migration.
- **The confirmation "Lottie moment" is RN `Animated`, not Lottie.** The design
  bundle shipped no Lottie file — its own artifact is the CSS ring animation,
  reproduced exactly (incl. reduced-motion). `lottie-react-native` is a native
  module and Expo Go is the founder's only device path; adding one would risk
  the only way this gets tested for zero visual gain. `ConfirmationSuccessMoment`
  is the seam to swap when dev builds unblock.
- **The confirmation screen lives OUTSIDE `app/(app)/booking/`** — the design
  has no step header and no hold timer, and the flow layout renders both.
- **The confirmation renders a SERVER-built DTO, never a re-query.** The `slots`
  SELECT policy hides a slot once `booked_count = capacity`, so a patient
  cannot read back the slot they just booked.
- **A failed payment writes NOTHING.** No `payments` row on decline (the table
  is UNIQUE on booking_id and confirm_booking upserts it; a stale failed row
  would carry the wrong method/amount forward). No receipts/refunds in MVP.
- **SMS carries the CONSOLIDATED prep rule, not the service note.** Measured
  against real seed data the full note never fit in 140 chars and was silently
  dropped — the single most important line in the message. Now
  "تجهيز: صيام ١٢ ساعة قبل الموعد" (longest fast wins), app holds the detail.
- `bookings.paymob_order_id` is now a dead column (we use
  `payments.gateway_order_id`). Left in place — renaming needs a migration + type
  regen for zero functional gain; fold it into the PayTabs integration PR.

**For F07 (Bookings list) — hand-off:**

- Confirmed bookings with `payments` rows and `notifications` audit rows exist in
  dev now. `bookings` has no patient UPDATE policy; cancellation goes through the
  `cancel_booking` RPC (still client-callable) which decrements `booked_count`
  for confirmed rows.
- `confirmation.tsx`'s recap card is the shape the booking-detail screen wants;
  `BookingSummary` in core `domain.types` is the type to grow.
- **Reading a booking's slot needs care**: joining `bookings → slots` as the
  patient returns nothing for a fully-booked slot (RLS). Either denormalise via a
  SECURITY DEFINER read function (like `get_branch_slots`) or return slot fields
  from a server function — do NOT assume the join works.
- `useConfirmationStore` is in-memory only; a cold start lands on `/(app)/bookings`.

**For P01–P06 (provider dashboard) — hand-off, this is now the critical path:**

- **There are real bookings to display and nobody to display them to.** The
  closed loop in CLAUDE.md §11 is one step away.
- Provider staff read via `provider_users.branch_ids` + `get_provider_branch_ids()`;
  the `bookings`/`slots`/`branches` policies already grant provider access by
  branch. **No provider_users rows exist yet** — onboarding Town/Saridar staff
  accounts is a prerequisite (A02) or a manual seed.
- A booking the dashboard sees as `confirmed` has `payment_status` `paid`
  (prepaid) or `cash` (collect at branch) — the receptionist MUST see that
  distinction, and `payments.status` is `pending` for cash.
- Payments are SIMULATED. The dashboard must not imply money was received; show
  the test-mode state until PayTabs is live.

**Device-test round (same PR #15 — six symptoms reported, four root causes):**

- **`settle-payment` had no CORS.** Expo's WEB target runs the same client code
  in a browser, so every call is preflighted; the `method !== 'POST'` guard
  answered `OPTIONS` with a bare 405 and the browser reported
  `TypeError: Failed to fetch`. Edge-function logs showed it exactly:
  `OPTIONS | 405` ×11 next to `POST | 200` from the phone. Added an OPTIONS
  short-circuit + CORS headers on every response. `*` is safe here because auth
  is an explicit bearer token, never an ambient cookie. The other four functions
  are cron/server-to-server and stay CORS-free deliberately.
- **The confirm → confirmation hand-off wedged the navigator.** `reset()` before
  `router.replace` also emptied `selectedServices`, so the flow layout wanted
  `/home` (empty selection) and the payment screen wanted `/slot` (null hold)
  in the same commit as the replace to `/confirmation`. Three navigation intents,
  navigator loses — the NEXT booking opened blank and unclickable. Fixed with
  `completeBooking()`, which clears the store and raises `confirmedHandoff` in
  ONE update; both guards stand down while it is up, and `confirmation.tsx`
  lowers it on mount. The landmine protection is unchanged — clearing still
  happens before navigating.
- **`expo-calendar` was never added to `app.config.ts` `plugins`.** Expo Go
  carries its own permission strings so this hid in dev, but a dev/store build
  would ship no `NSCalendars*UsageDescription` and no Android calendar
  permissions. Added with an Arabic `calendarPermission`.
- **OTP to the founder's real number: NOT our code.** Auth logs show three
  clean `/otp` 200s, then `429 over_sms_send_rate_limit` (limit was 3/hour,
  since raised to 10), then another clean 200. A 200 means GoTrue handed the
  message to the provider without error — so delivery died at Vonage/the
  carrier, not in the app. Supabase Auth's phone provider is configured in the
  dashboard and is entirely separate from our `send-sms` function. Likely
  Vonage trial whitelisting, balance, or an unregistered Egyptian sender ID
  (NTRA drops unregistered alphanumeric senders). **Founder action, not a code
  fix.**
- **No confirmation SMS was ever sent — by design.** Both confirmed dev
  bookings were made as `+201000000001`; `notifications` rows read
  `status='skipped'`, `"static test number — no real SMS in dev/CI"`. The real
  SMS path stays untested until the OTP issue above is resolved, because the
  founder cannot sign in as a real number to receive one.
- **Calendar on iPhone — RESOLVED by the instrumentation above.** The very next
  device run logged `[calendar] createEventAsync failed: RangeError: Date value
out of bounds`, which named it: `cairoWallClockToDate` derived Cairo's offset
  via `new Date(d.toLocaleString('en-US', { timeZone }))`. That round-trip is
  **V8-only** — Hermes parses essentially only ISO 8601, so on device the parse
  failed, the offset became `NaN`, and expo-calendar got an Invalid Date whose
  `toISOString()` threw. It passed every unit test and Node script because those
  run on V8. Replaced with `cairoWallClockToInstant` in core, which reads the
  zoned wall clock via `Intl.DateTimeFormat.formatToParts` and rebuilds with
  `Date.UTC` — no string parsing anywhere. Six new core tests, one asserting the
  result is a VALID date rather than only checking its value.

**Second device round (same PR):**

- **`POP_TO_TOP was not handled by any navigator` on every successful payment.**
  `popToTopOnBlur: true` on the booking tab dispatches when the blur ANIMATION
  completes — by which point the replace to `/confirmation` has already torn the
  flow stack down. Removed; the flow layout's selection guard was always the
  real protection against re-entry.
- **Expo web threw at boot:** "Cannot manually set color scheme, as dark mode is
  type 'media'". NativeWind/react-native-css-interop needs
  `darkMode: 'class'` in `tailwind.config.ts` on web. The app is light-only with
  zero `dark:` variants, so this only quiets the runtime.
- **`<button>` nested inside `<button>` on the home list.** `ProviderCard`'s
  احجز button was a `Pressable` inside the card `Pressable`, both calling the
  same `openProfile`. Invalid HTML (React hydration error on web) and two
  overlapping controls for a screen reader on native. The inner one is now a
  plain `View` — the card owns the press. Audited every other multi-`Pressable`
  component; this was the only nesting.
- The `A listener indicated an asynchronous response…` console error is a Chrome
  extension, not our code.

### 2026-07-27 · FIX — Realtime actually shipped + subscription hardening

"Still 15s" had TWO compounding causes, both proven:

1. **PR #13 never reached main.** It was stacked (base = PR #12's branch) and its base
   branch wasn't deleted when #12 merged — so GitHub merged #13 into the DEAD feature
   branch. `git log origin/main` showed no realtime commit; the device was honestly
   running #12's 15s poll. Cherry-picked onto main properly. Trap recorded in
   ENGINEERING-WORKFLOW §2 (verify stacked merges against origin/main).
2. **The hook had a real silent-failure mode** (would have bitten after the merge fix):
   `setAuth()` fired without awaiting before the private-channel join — Node-verified
   that an anon-token join returns `CHANNEL_ERROR Unauthorized`, and the old
   `.subscribe()` had no status callback, so it failed invisibly leaving only the poll.
   Hook hardened: getSession → `setAuth(token)` → join, deterministically; every channel
   status logged in dev (`[realtime] …` in Metro console); failed joins retry every 5s;
   each successful (re)join fires one catch-up refetch. Verified: anon join rejected,
   JWT join SUBSCRIBED, push delivered.

### 2026-07-27 · FEAT — Realtime slot availability (push replaces fast polling)

Founder-requested upgrade from the 15s poll: hold changes now PUSH to viewers.

- **Migration `20260726205901_realtime_hold_broadcasts`**: AFTER INSERT/DELETE trigger on
  `slot_holds` calls `realtime.send()` to private topic `branch-holds:{branch_id}` with a
  minimal `{slot_id, op}` payload — never user data (that's also why postgres_changes was
  a non-starter: RLS SELECT-own would deliver nothing useful, and opening it would leak
  user ids). Receive auth = SELECT policy on `realtime.messages` for the topic prefix;
  no INSERT policy, so only the DB trigger can broadcast.
- **`useBranchHoldsRealtime(branchId)`** (features/booking/realtime.ts): the slot picker
  subscribes and invalidates the slots + preview queries on any event. Poll relaxed to a
  60s FALLBACK (covers silent time-expiry between cron sweeps + dropped sockets) — push is
  the fast path, correctness still never depends on the client.
- **Verified end-to-end from Node with both test users**: B subscribed on the private
  channel received `INSERT` and `DELETE` broadcasts the moment A held/released. Bonus:
  confirm_booking deletes the hold → confirmations will propagate live too (F06).
- Gotcha recorded: first-ever realtime use returned `MissingPartition` (service creates
  its message partitions lazily; schema is service-owned — wait/retry, don't fix by hand).

### 2026-07-26 · FIX — Hold self-healing: one hold per patient + real crons + picker liveness

Ended the hold-release loop with an end-to-end Node reproduction using both static test
users (+201000000001/2, real authenticated sessions against the live DB). Finding: **every
server + client-library layer worked perfectly** — the leaked holds came from the device
running a pre-merge bundle (holds created 45s after PR #11 merged) and, before that, the
unreliable navigation-blur release. Lesson codified in ENGINEERING-WORKFLOW: client-side
cleanup is an optimization; correctness must be server-side.

**Migration `20260726193258_one_hold_per_patient_and_cron`:**

- **One active hold per patient**: `create_slot_hold` now releases ALL the caller's other
  holds on success (the app books one slot at a time). A leaked hold — killed app, stale
  bundle, dead battery — self-heals the moment its owner holds anything again. Verified
  live: A holds s1 → abandons → holds s2 → B immediately gets s1. On REJECTION the
  caller's previous hold is kept (slot.tsx no longer clears it — your old slot stays
  yours while you shop).
- **pg_cron scheduled for real** (neither cron had ever run): `cleanup-expired-holds`
  every 5 min; `generate-slot-window` nightly 00:10 UTC keeps the 30-day window rolling
  (both standing risks CLOSED).

**Client**: picker polls (`refetchInterval` 15s + `refetchOnMount: 'always'`) so phone B
sees releases/expiries while sitting on the screen — RN has no window-focus refetch;
preview strip refetches on mount. Release helpers now LOG failures in dev instead of
swallowing. **Cruft removed**: booking layout's dead blur/unmount backstops,
`acquireSlotHold`'s client-side pre-release (server owns exclusivity now), unused imports.
The segments watcher in `(app)/_layout` + logout `releaseAllHolds` remain the two client
paths.

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

**2 · Flow-exit + sign-out hold release actually works now** — device testing proved the
F05 blur-listener release NEVER fired (holds leaked their full 10 minutes after backing
out; a live leaked hold was found in the dev DB). The authoritative release is now a
**segments watcher in `(app)/_layout`** (always mounted; pure route state — the moment the
route leaves `/booking` with a lingering hold/pending booking, `cleanupFlow` runs). The
booking layout's blur/unmount hooks remain as backstops; shared logic in
`features/booking/cleanup.ts`. Sign-out additionally calls `releaseAllHolds(userId)`
BEFORE `signOut()` (the RLS delete-own path needs the live session); the booking store
also resets so no selection leaks across users. Same-user semantics fixed + documented in the same migration:
**re-holding a slot you already hold now REFRESHES the hold** (the old count included your
own hold, so capacity-1 refreshes returned `slot_full`). SQL-verified: A hold → A re-hold =
success with new hold_id, ONE row; B still `slot_full`. The F05 "known quirk" note is void.

**3 · Prep strip renders NOTHING when there's nothing** — core `computePreparationNotes`
now filters reassurance-only notes (`isReassurancePrepNote`: notes starting "لا يشترط" /
"No fasting required" are information, not preparation). Selecting only such services shows
no strip at all; mixed selections surface only the real prep. The per-row chip uses the
SAME core predicate. (The old core test that locked the merge of "لا يشترط" notes was
updated — it had locked the wrong behavior.)

**4 · OTP input rewritten to the hidden-input pattern** — per-box TextInputs kept
misrendering digit centering on iOS devices (default padding + forced RTL), so OtpInput is
now ONE invisible input (transparent text, hidden caret, `textContentType="oneTimeCode"`
→ iOS SMS autofill works) over six rendered `<Text>` boxes — a Text centered in a View
cannot misrender. Paste and backspace simplify to plain `onChangeText`. `otp-box-*`
testIDs kept on the boxes, so all Maestro flows work unchanged. Founder device check pending.

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

Full onboarding flow built to the DESIGN-01 handoff bundle (`design/handoff/project` (Onboarding Flow)): welcome →
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

`packages/core` filled per `docs/specs/SPEC-CORE-01-core-package.md`. **92 tests, 100% line coverage
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
  the flag. Full detail in `docs/decisions/DECISION-provider-data-model.md`.
- **2026-07 · Preparation notes:** Per-service, NOT per-branch. Computed from the patient's actual
  selection via a shared `computePreparationNotes()` in `packages/core/business` — longest fast wins,
  duplicates merged, shown only when a selected service needs it, reused at selection + confirmation +
  SMS. Displayed as an **expandable inline note** (collapsed summary → tap to reveal per-service detail
  in place; no modal, no "go review elsewhere" dead end). (Caught while reviewing the DESIGN-01
  provider profile mockup, then refined when the note pointed nowhere.)
- **2026-07 · Booking flow step 1:** Read-only REVIEW (services + total + prep note + "تعديل" back-link),
  NOT a re-selection — the patient already chose on the branch profile. Selection happens once. Branch
  profile = choose; booking flow = confirm & schedule. Detail in `docs/decisions/DECISION-booking-flow.md`.
- **2026-07 · Date picker:** Short horizontal strip (7–14 days) + a calendar affordance for going
  further, BOTH capped at the 30-day slot window (`generate_branch_slots` ceiling). Fully-booked and
  out-of-window days are disabled in both — no dead ends. (The mockup strip "not sliding" is a static-
  preview limitation, not a real bug.) Detail in `docs/decisions/DECISION-booking-flow.md`.
- **2026-07 · Tab bar:** Persistent on destinations (home, search, bookings, profile, branch profile);
  HIDDEN during the booking flow (all 4 steps) and auth — keeps the patient in the commitment funnel
  with the live slot hold; exit only via back/cancel. Detail in `docs/decisions/DECISION-navigation-safe-areas.md`.
- **2026-07 · Safe areas:** Every sticky/bottom element (CTAs, tab bar, countdown banner) must sit
  inside the safe-area inset — nothing under the iOS home indicator / Android gesture bar. Global rule,
  verified on real devices. (Caught in the step-1 review mockup where the CTA sat flush to the edge.)
- **2026-07 · Payments: PayTabs, not Paymob** (changed at F06). Hosted payment page + IPN
  signature verification; Server Key is server-only. No account or credentials exist yet (legal
  entity pending), so payments are SIMULATED by a mock provider behind the real settlement path —
  when credentials land, only the provider module and an IPN handler change.
- **2026-07 · Settlement is server-only.** `confirm_booking()` is executable by `service_role`
  alone; the single caller is the `settle-payment` Edge Function, which also validates the hold and
  is idempotent. Clients have no grant on it and no INSERT policy on `payments`. (Closed a real
  hole: default PUBLIC EXECUTE had made it client-callable since the schema was written.)
- **2026-07 · Auth:** Patients phone OTP (Vonage). Providers email/password. Admin email + TOTP.
- **2026-07 · Booking integrity:** Atomic `confirm_booking()` Postgres function. 10-min slot holds,
  cron cleanup every 5 min.
- **2026-07 · CI/CD:** Full rigor — blocking gates on lint, typecheck, unit, E2E, security. No red merges.
- **2026-07 · Company/legal:** Running in parallel. Build + validate with TEST data now. Do NOT go
  live with real patient data / real payments until entity is registered and founder agreement signed.

---

## Known risks / open items

- **⚠ PAYMENTS ARE SIMULATED — PayTabs integration pending the legal entity.**
  No merchant account, no credentials (not even test). `MockPaymentProvider`
  settles bookings through the real server-side path; no money moves. **Launch
  blocker.** Plug-in point + full TODO list:
  `packages/core/src/business/payment-paytabs.ts`.
- **⚠ Final payment-method lineup is an OPEN PRODUCT DECISION.** The approved
  design shows بطاقة / فوري / نقداً, but PayTabs Egypt supports neither Fawry nor
  Vodafone Cash (its methods are creditcard/aman/meezaqr/valu). Resolving this
  needs a design revision AND a migration to `bookings_payment_method_check`.
- **⚠ The confirmation SMS has never been delivered to a real handset.** Every
  dev/CI run uses the static test numbers, which are deliberately skipped. The
  founder's real-number check is the only proof the Arabic Unicode message
  actually arrives.

- ✅ ~~`generate-slots` nightly cron still not scheduled~~ — **STALE ENTRY, closed 2026-08-04
  after verification against the live DB.** The horizon never shrank: pg_cron job
  `generate-slot-window` (jobid 2, `10 0 * * *`) has existed since migration
  `20260726193258` — the very "since 2026-07-26" date this entry cited — and does the
  nightly extension in set-based SQL, which is why it was listed above as a _sibling_ cron
  while being declared missing. Verified: every run through 2026-08-04 `succeeded` in
  `cron.job_run_details`, and `max(slot_date)` = today + 30. The separate `generate-slots`
  EDGE FUNCTION remains unscheduled and redundant — retire it or note it as the pg_cron
  job's spare. The durable lesson: this file said "unscheduled" for nine days while the
  database said otherwise; **verify a risk entry against the live system before repeating
  it** (§1.3 applies to PROGRESS itself).
- ✅ ~~`create_slot_hold(p_slot_id, p_user_id)` doesn't verify `p_user_id = auth.uid()`~~ —
  **CLOSED 2026-08-01** (migration `20260801005955`). The parameter is gone, not guarded;
  the holder comes from `auth.uid()`. It was worse than this entry described: the grant
  reached `anon`, and the body's `DELETE … WHERE user_id = p_user_id` meant a caller could
  destroy a stranger's hold, not merely create one in their name.
- ✅ ~~SEVEN CLIENT-REACHABLE WRITE POLICIES, ACROSS FIVE TABLES, EVERY ONE
  COLUMN-BLIND~~ — **CLOSED 2026-08-03** (migration `20260803160517`). Five had
  no consumer at all and were dropped; the two load-bearing `users` policies were
  kept and narrowed by column GRANT. Proven with 9 Node checks. Kept below for
  the record, because the SHAPE is what matters:

  The `branches` hole was not the exception — it was the first one anyone looked
  for. The authorization-surface sweep (2026-08-02) enumerated the rest. Supabase
  grants every column to `anon`/`authenticated` by default and RLS is the only
  gate, so wherever a write policy matched, **all columns were writable**:

  | table      | policy                           | who          | what that lets them set                                                 |
  | ---------- | -------------------------------- | ------------ | ----------------------------------------------------------------------- |
  | `bookings` | provider updates status          | branch staff | ⚠ `total_amount`, `payment_status`, `commission_amount/rate`, `user_id` |
  | `slots`    | provider updates own             | branch staff | ⚠ `capacity`, `booked_count`, `is_blocked`                              |
  | `branches` | provider updates own branches    | branch staff | ⚠ `rating`, `review_count`, `instahealth_slot_allocation`, `is_active`  |
  | `reviews`  | patient updates own              | patient      | ⚠ `is_flagged`, `is_verified`, `rating`                                 |
  | `reviews`  | patient inserts own              | patient      | same at insert (WITH CHECK does gate booking ownership + completed)     |
  | `users`    | patient updates own row / insert | patient      | `phone`, `email` (own row only — `id = auth.uid()` holds)               |

  **The three worst are new information:** a partner can mark their own bookings
  `paid` or zero the commission on them; a partner can raise their own `capacity`
  and manufacture allocation the agreement never granted; a patient can clear
  `is_flagged` on their own moderated review. None is exploited — the only
  provider accounts are our two dev logins — but the ordering matters: **these
  must close before partner staff get real accounts, and certainly before PayTabs
  goes live.**

  **How it closed:** four of the five tables needed nothing at all — a search of
  every write call in `apps/`, `packages/` and `supabase/functions/` found NO
  client writes to `bookings`, `slots`, `branches` or `reviews`. Every real write
  already went through a SECURITY DEFINER function or an Edge Function on the
  service role, which bypasses RLS. Those policies were pure attack surface, so
  they were dropped outright. When P05 needs to edit a branch profile and F09
  needs to write a review, each gets a writer function in the
  `update_branch_service` shape — the write-path rule, now in CLAUDE.md §8.

- **⚠⚠ `branches` HAS A COLUMN-BLIND UPDATE POLICY — the fifth instance of the
  §5 general law, and the first with MARKETPLACE-INTEGRITY consequences.**
  Found during P04 while verifying the spec's RLS claim.

  ```
  policy "branches: provider updates own branches"   cmd = UPDATE
  USING (id = ANY (get_provider_branch_ids()) OR get_user_role() = 'admin')
  WITH CHECK  = null
  ```

  Any provider staff member can `PATCH` **any column** of their own branch row.
  Proven from Node: Town's `instahealth_slot_allocation` moved 5 → 99 and was
  restored immediately. Writable today, in rough order of severity:
  - **`rating` and `review_count`** — a partner can set their own rating. This
    is not capacity, it is fraud against patients choosing a provider, and it
    silently outranks every genuine review.
  - **`instahealth_slot_allocation`** — the commercial term P04 just documented
    as InstaHealth-owned. The dashboard says «تواصل مع إنستاهيلث»; the API says
    go ahead.
  - **`is_active`** — a branch can delist itself (or relist itself).
  - `name_ar`, `address_*`, `lat`/`lng`, `phone`, `operating_hours` — legitimate
    branch-maintained fields, and the reason the policy exists at all.

  **Not exploited and not urgent-in-the-wild** (the only provider accounts are
  our two dev logins), but it must close before partner staff get real accounts.
  The fix is a column-scoped policy, or a SECURITY DEFINER writer for the
  handful of fields a branch legitimately maintains — the `update_branch_service`
  pattern from P03. **Its own PR**; P04 deliberately did not widen into it.

- **⚠ Supabase security advisors: 4 open classes, all WARN, all PRE-EXISTING — deliberately
  NOT fixed in the 2026-08-01 security PR to keep it one scope.** Reviewed after the
  `create_slot_hold` migration; `create_slot_hold` no longer appears among the
  anon-executable functions. What remains, worst first:
  - **`auth_leaked_password_protection` is DISABLED.** Supabase can check new passwords
    against HaveIBeenPwned. ⚠ **Turn this on BEFORE rotating the dev provider passwords**,
    or the new ones are set without the check that would have caught a weak reuse.
  - **Six SECURITY DEFINER functions are still anon-executable**: `get_branch_slots`
    (deliberate — public slot browsing), `get_user_role` / `get_provider_branch_ids`
    (return empty for anon; harmless but pointless to expose), and
    `handle_new_user` / `broadcast_slot_hold_change` / `broadcast_branch_booking_change`
    (TRIGGER functions — Postgres refuses a direct call, so the grant is noise, not a hole).
    A one-migration REVOKE sweep would clear all but the first.
  - **Eleven functions have a mutable `search_path`** — the older ones predate the
    `SET search_path = public` convention. Same sweep.
  - `pnpm audit` carries one ignored GHSA (`GHSA-mh99-v99m-4gvg`, build tooling).
- **⚠ Seeded prices are PLACEHOLDERS — now a DATA task, not a code task.** P03 shipped the
  editor, so partners enter their real prices themselves at
  `/dashboard/services`. The rows that have never been touched show
  «لم يُحدَّث بعد», which is the checklist. **Verify every service has a
  partner-confirmed price before launch.**
- **⚠ `branches.slot_duration_minutes` is a uniform seeded 30 across ALL 24 branches** and no
  longer describes the slot grid (spacing is `opening window ÷ allocation` since migration
  20260726151039 — 150 min at Saridar, 120 at Town). P02's drawer renders it as "expected
  service duration", which is a fair reading, but confirm real per-branch values with the
  partners before launch — same class of placeholder as the prices.
- **Saridar per-branch hours unconfirmed:** all 23 seeded branches use the standard schedule
  (Sat–Thu 08:00–22:00, Fri 09:00–17:00). Google shows different hours at Dokki/Manial/Faisal 2 —
  awaiting Saridar's answer to the template's question 4; update `operating_hours` per branch then.
- **7 Saridar branches not yet seeded** (Maadi, Giza, Faisal 3, El-Mahla, Benha, Zagazig,
  Mansoura) — pending confirmation/maps links; add via a data-only follow-up to seed 002.

- **⚠ PLACEHOLDER — NO LICENSE FILE, AND THE IP POSTURE IS UNDECIDED. Founder decision;
  this build deliberately does not pick one.** The repo went PUBLIC on 2026-07-29 (to unblock
  GitHub Actions minutes) and carries no `LICENSE`. **Public ≠ open source:** with no licence,
  default copyright applies and nobody has permission to use, copy, modify or distribute the
  code — but "all rights reserved by whom?" is exactly the question that has no answer yet.
  Three unresolved facts make this a decision the founders must take together, not a file
  someone adds:
  - **The founder agreement is unsigned** (Mohamed 35 / Yazeed 33 / Tarek 28, verbal only —
    see below). Until it is, ownership of the copyright is genuinely ambiguous, and a licence
    is a grant of rights nobody is yet established to be making.
  - **This is a commercial healthcare product with committed launch partners**, not a side
    project. A permissive licence (MIT/Apache) hands the booking platform to any competitor;
    Egypt's healthcare-booking space already has adjacent players.
  - **The trademark question below is live** — a licence file naming "InstaHealth" as the
    project asserts a name that has not been cleared.

  **Options, for the founders to choose between** (in rough order of reversibility):
  ① **Make the repo private again** and pay for Actions minutes — restores every option and
  costs only money; ② **stay public with no licence** — the status quo: viewable, legally
  unusable by others, but it reads as carelessness to anyone who looks; ③ **add an explicit
  proprietary "all rights reserved" notice** — cheap, honest, needs a named holder;
  ④ **choose a real licence** — only after the entity exists and the agreement is signed.
  ⚠ Note ① does not undo publication: anything already cloned, forked or indexed stays out.
  **Decide this before public launch; revisit it the moment the entity is registered.**

- **⚠ THIS FILE NAMES VULNERABILITIES BY FUNCTION IN A PUBLIC REPO — decide whether that
  is still right.** The Shipped entries deliberately describe each security hole precisely:
  the function, the migration, the exact predicate that failed, and how it was proven. That
  candour is why the same mistake stopped recurring, and every hole named so far is CLOSED and
  verified — so today the disclosure is historical, and it doubles as an honest engineering
  record. But the file is now world-readable, and the practice generalises badly: the next
  entry could name a live one, and «Known risks» is precisely a list of things not yet fixed.
  **The question for the founders is whether the security narrative should move to a PRIVATE
  security note** (with PROGRESS keeping a dated pointer), or stay public as a deliberate
  transparency choice. There is a real argument each way and it is not an engineering call.
  Whatever is decided: **an OPEN, unfixed vulnerability must never be described in a public
  file** — that is not transparency, it is a how-to.

- **Trademark:** "InstaHealth" name proximity to existing "InstaClinic" (home-visit app) and
  "Instapharm". Check trademark availability in Egypt before public launch / printing.
  ⚠ Now entangled with the LICENSE decision above — a licence file names the project.
- **Doctor scheduling complexity:** doctor appointments differ from slot-based labs. Practitioners
  migration needed. Kept out of first milestone deliberately.
- **Legal not yet signed:** founder split (Mohamed 35 / Yazeed 33 / Tarek 28) agreed verbally only.
  Two-page agreement to be signed in parallel with build.
- **Provider onboarding at scale:** Town + Saridar solve launch supply. Post-launch expansion still
  needs a repeatable onboarding process (future).

---

_This file is the memory of the project. Keep it honest and current._
