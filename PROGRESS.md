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

**Phase:** 🎉 **MILESTONE ONE — the loop is closed.** Patient books on mobile (F01→F07) → the branch desk sees it, records the outcome, opens the detail drawer and can cancel on the patient's behalf (P01–P02). Next: P03–P06 dashboard; F03 Search and F08–F09 still open
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
- [ ] **P03–P06** — Web: prices editor, slot allocation, branch profile
- [x] **F07** — ✅ DONE. Mobile: My Bookings list, detail & cancel (see Shipped)
- [ ] **F08–F09** — Mobile: reviews, profile
- [ ] **A01–A06** — Web: admin panel
- [ ] **006_practitioners.sql + doctor booking** — after labs/scans proven

**First milestone:** patient books on mobile at Town/Saridar → pays → gets SMS + confirmation →
receptionist sees it on web dashboard and confirms. Closed loop = model proven.

---

## Shipped

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

- **⚠ `generate-slots` nightly cron still not scheduled:** the capacity-model fix
  regenerated a full 30-day window (now through +30 days), but nothing extends it nightly —
  wire the Edge Function schedule before launch or the window shrinks day by day.
- **⚠ `create_slot_hold(p_slot_id, p_user_id)` doesn't verify `p_user_id = auth.uid()`**
  (SECURITY DEFINER, callable by any authenticated user) — a malicious client could hold
  slots as another user. Harden with an auth.uid() check in a follow-up migration.
- **⚠ All seeded prices are PLACEHOLDERS** (labs 150/250/400, scans 300–2500 EGP rounds) —
  replace with real Saridar/Town prices via the provider dashboard before real patients.
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
