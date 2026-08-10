# PROGRESS.md — InstaHealth Build Log

> Living log of everything shipped. **Update this after every feature.**
> Any session (yours or Claude Code's) can read this to know exactly where things stand.
> Newest entries at the top of the "Shipped" section.

---

## How to use this file

**Sessions read THIS file, not the archive — unless they are hunting history.**
This file carries the **three newest ship entries** plus **every open item, risk
and decision**. Everything older is in
[`PROGRESS-ARCHIVE.md`](./PROGRESS-ARCHIVE.md), verbatim.

That split is deliberate. A session's first act is to read PROGRESS, and at 3,000
lines that meant spending a large share of a context window on entries about
features that shipped, closed and have not moved since. The open items are what
change decisions; the closed ones are what explain them. Both matter, at
different moments — so keep them in different files and read the archive on
purpose rather than by default.

After each feature merges to `main`, add an entry under **Shipped** with:

- Date, feature ID + name, PR link
- What was built (files/packages touched)
- Key decisions made during the build
- Anything the next session needs to know (gotchas, follow-ups)

Then **move the entry that falls off the end into the archive** — do not delete
it, and do not summarise it on the way. Several archived entries are the only
written record of why a rule in `docs/ENGINEERING-WORKFLOW.md` exists.

Keep **Current status**, **Next up** and **Known risks** accurate at all times.
Those three are the reason this file is read.

---

## Current status

**Phase:** 🎉 **MILESTONE ONE — the loop is closed.** Patient books on mobile (F01→F07) → the branch desk sees it, records the outcome, opens the detail drawer, cancels on the patient's behalf, manages its own prices, reads its slot picture and maintains its own contact details (P01–P05 — every sidebar surface is live). The four shipped identity/money holes are all closed and the repo passed a full-history secret audit (2026-08-01). **V1 collects no money — cash at the branch** (2026-08-04 partner-trust decision), which retires the "payments are simulated" launch blocker outright. **A01 opened the admin portal** (2026-08-08): the founder's account exists, TOTP
is live, and `/admin` is gated four ways. **A02 shipped the commission statement**
(2026-08-09) — the founder can issue, send and settle a partner's monthly
invoice, and the two money policies A01 flagged are closed. Next: A03 (the
commission-rate editor, a LAUNCH BLOCKER — the seeded 12% is a placeholder), F08
reviews (needs the review writer function); card via PayTabs returns post-market-proof
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
- [x] **F03** — ✅ DONE. Mobile: search with Arabic normalization (see Shipped)
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
- [x] **PROF-01** — ✅ DONE. Mobile: profile tab + account deletion (see Shipped)
- [ ] **F08** — Mobile: reviews (needs a review writer function — the
      `update_branch_profile` shape). Its design landed 2026-08-05
      («Reviews Display Addendum»).
- [x] **A01** — ✅ DONE. Web: admin auth (password + TOTP + recovery) & the /admin
      shell (see Shipped). **The genesis admin exists, so every
      `get_user_role() = 'admin'` policy in the schema is LIVE for the first
      time** — read the ruling-③ table in the A01 entry before starting A02.
- [x] **A02** — ✅ DONE. Web: commission & invoicing statement (see Shipped).
      Its opening decision closed the two money policies — `bookings` and
      `payments` admin `ALL` — outright. **Nine of the eleven remain** for
      A03–A06.
- [ ] **A03–A06** — Web: providers & branches, catalog, staff accounts, oversight.
      ⚠ A03 owns the commission-rate editor, and it is a LAUNCH BLOCKER: the
      seeded 12% is a placeholder (see Known risks).
- [ ] **006_practitioners.sql + doctor booking** — after labs/scans proven

**First milestone:** patient books on mobile at Town/Saridar → pays → gets SMS + confirmation →
receptionist sees it on web dashboard and confirms. Closed loop = model proven.

---

## Shipped

### 2026-08-09 · A02 — Commission & invoicing statement (web, admin)

The document a partner is paid against. Pick a partner and a calendar month and
get every commissionable booking as a traceable row, blended totals, the
auto-closed exclusions footnoted in the open, and a real issuance lifecycle —
مسودة → أُرسلت → تمت التسوية — with frozen snapshots and versioned re-issue.
**This is how InstaHealth collects revenue in a cash-only world.**

Shipped as TWO PRs (the spec says one): the data layer landed first because its
migrations were already applied to the shared dev database, and holding them
back would have left the repo and the DB diverged.

#### The money contract, implemented verbatim

`compute_commission_draft` is `DECISION-commission-attachment` in SQL: prepaid
attaches AT PAYMENT (`confirmed_at`), cash AT COMPLETION (`completed_at`) and
**only when a human closed it**. Integer piasters throughout, mirroring core's
`pricing.ts`. A missing rate THROWS — `bookings.commission_rate` carries a
`DEFAULT 0.1200`, and a silent 12% on a partner nobody agreed 12% with is
exactly the failure being guarded against.

`provider_commission_rates` is effective-dated and **APPEND-ONLY, enforced by a
trigger** rather than documented: it is the evidence behind money already
invoiced, so an UPDATE would rewrite history and silently change a statement
nobody re-issued. Proven by aiming an UPDATE and a DELETE at a real row.

#### ⚠ TWO BUGS CAUGHT THE SAME WAY — by looking, not by reading

1. **The draft counted CANCELLED bookings.** The first prepaid rule checked that
   money had moved and said nothing about the booking's own status. Saridar's
   entire July "statement" was two cancellations worth 1,050 EGP; three more
   inflated Town's. **That is an invoice to a partner for services never
   delivered.** Found by running the query against real dev data instead of
   trusting it. Fixed in its own migration so the sequence records it.
2. **«تاريخ الحجز» was showing the VISIT date.** The column rendered
   `slots.slot_date`, one column away from «تاريخ الاستحقاق» — two dates both
   describing the visit, neither saying when the patient booked. Invisible in
   the markup, in the types, and behind four passing E2E assertions. **It became
   obvious the second someone opened the screenshot.** That is §9's entire
   argument, and it has now paid for itself twice.

A third, found while reading the authorization surface before committing it:
`commission_rate_at` and `commission_piasters` were granted to `authenticated`,
so any signed-in patient could read a partner's negotiated percentage. They need
no grant at all — their only caller is SECURITY DEFINER, so privilege checks run
as the OWNER. Revoked, then re-verified by re-running the draft.

#### A02's opening decision — the two worst policies A01 switched on

`bookings: admin full access` and `payments: admin full access` are **DROPPED**.
Both were `ALL` policies with a NULL `with_check` (hence column-blind) over
tables carrying blanket INSERT/UPDATE grants to `anon`+`authenticated`, so an
admin's BROWSER could declare `total_amount`, `commission_amount` and
`payment_status`, or mark a payment `completed`.

A02 needs neither: it is read-only over both tables. Admin READS never came from
those policies — the `… sees own` SELECT policies already OR in the admin role
and stay. Verified there are NO client writes to either table anywhere in
`apps/`, `packages/` or `supabase/functions/`; every real write is an Edge
Function on the service role, which bypasses RLS. The door closed and needed no
replacement, because nobody was walking through it. **Nine flagged policies
remain for A03–A06.**

#### The numbers, from live dev

|                   | counted                | GMV       | commission @12% | excluded      |
| ----------------- | ---------------------- | --------- | --------------- | ------------- |
| Town · يوليو ٢٠٢٦ | 8 (4 cash + 4 prepaid) | 2,700 EGP | 324 EGP         | 3 (1,650 EGP) |
| Town · أغسطس ٢٠٢٦ | 2 cash                 | 300 EGP   | 36 EGP          | 1 (250 EGP)   |
| Saridar · both    | 0                      | —         | —               | 0             |

Town's July carries BOTH attachment rules on one real document — the mixed
mock-era data turned out to be coverage, not noise. Saridar is the honest-zero
month: only cancellations, so no rows at all.

⚠ **Mock-era provenance:** five completed bookings have no `payments` row (they
predate the settlement plumbing). The draft reads them as CASH and attaches at
completion — the only event they have. Stated in the function body, not inferred
silently. Nothing fabricated.

#### The lifecycle, proven end to end

Issue freezes a snapshot + its lines (including excluded rows, so the export can
print them). Re-issue creates v2 and marks v1 `superseded` — readable, exportable,
never deleted. Settled is TERMINAL: re-issue refused, drift surfaced as a
credit-forward NOTE against next month. Verified against live dev across three
phases with a real fixture mutation the ADMIN SESSION ITSELF CANNOT MAKE (that
is the policy closure working): 26 assertions, all passing, fixture fully
restored afterwards.

#### Built to the handoff

Frames A–E of `Admin - Commission Statement.dc.html`. Everything new went
through the **contract**, not the page: `STATEMENT_STATUS_CHIP`,
`STATEMENT_BANNER`, `STATEMENT_SUMMARY_CARD`, `STATEMENT_TABLE`.

⚠ **Two deviations, both deliberate.** The table columns are `auto … 1fr auto`,
NOT the handoff's `150px 96px 124px…` — VIEW-01's law, since every column is
nowrap Arabic or a nowrap Latin ref. (`1fr` is `minmax(auto,1fr)` and respects
the automatic minimum; `minmax(0,1fr)` is the trap and is not used.) And
«مسودة» is the label for `issued`, because frame D shows a freshly re-issued v2
carrying «● مسودة» beside an issue stamp — in the founder's language مسودة means
NOT YET SENT.

#### Verified

**Node, against live dev:** the money rules, Cairo month boundaries with no
booking in two months, traceability (every card equals the sum of its rows),
missing-rate throws, provider and anon refused. **Playwright:** 4 new admin
tests — real money rendered, exclusions footnoted and toggling them moving no
total, the honest-zero month, and display-equals-enforcement (the settle control
does not EXIST before it is legal, rather than being disabled).

⚠ The E2E is deliberately READ-ONLY: issuing writes a row the next run would
find, and the double-issue guard would then refuse forever. The mutating
lifecycle is the Node proof, where the fixture can be created and destroyed.

**Gates:** format, lint, typecheck, build (web + mobile export), 420 core + 88
mobile + 25 tokens unit tests, `pnpm audit`. `authorization-surface.json`
regenerated — 22 tables, 40 functions, diff is exactly +3 functions, none
SECURITY DEFINER with an identity parameter.

#### For A03 and A06

- **A03 writes `provider_commission_rates`** — append-only, effective-dated, and
  the written-acknowledgment checkbox is REQUIRED per the design ruling. The
  table, its trigger and its read path already exist; A03 builds the editor.
- **A06 reuses `compute_commission_draft` and `get_commission_statement_view`** —
  built shareable on purpose. عمولة متوقعة is the drawer's world; the statement
  contains only OCCURRED events.
- `docs/runbooks/RUNBOOK-monthly-invoicing.md` is the founder-executable
  procedure, including what the red and blue strips mean and what to do about
  them.

#### Founder actions

1. **Enter the signed commission rates via A03 before the first real statement.**
   The 12% is a placeholder and nothing can detect that it is wrong.
2. Generate July and August for both partners, export both, and eyeball every
   number against its rows.

### 2026-08-09 · FIX — a refusal at the wrong portal signed the account out EVERYWHERE (main was red for three days)

`main` had been RED since A01 merged — three consecutive runs (#42, #43, #44),
last green was #41 on 2026-08-05. It read as flake, because **the victim was a
different test every time**: `admin.spec.ts:84` first-login, then
`dashboard.spec.ts:690` prices editor, then `dashboard.spec.ts:821` P04 slots.
Each a clean 120s `waitForURL` timeout. PR #45 — **docs-only** — failed the same
way, which is what made it impossible to write off.

**One cause.** `supabase.auth.signOut()` defaults to `scope: 'global'`, which
revokes every refresh token the account owns on every device. Both role gates
used the bare form:

| call site                             | what it meant to do                       | what it did                                     |
| ------------------------------------- | ----------------------------------------- | ----------------------------------------------- |
| `app/admin/actions.ts` (admin door)   | clear the half-authenticated session HERE | killed every session that account held anywhere |
| `app/login/actions.ts` (partner door) | same                                      | same                                            |

A01's cross-portal test signs the **provider** account into the admin door to
assert it is refused. The refusal then revoked that provider account's sessions
globally — including the two other Playwright workers using the same shared dev
account, which bounced to `/login?next=…` mid-test. Hence a different casualty
each run, and hence three days of it looking like geography.

**This is a product defect, not a test defect.** A receptionist standing at the
front desk is signed out because a colleague tried those credentials at the
admin door — on a shared account, that is a live front desk going blank. The
gate's stated intent has always been "don't leave a half-authenticated session
on THIS machine", which is `scope: 'local'` exactly.

**Proven, both directions, before and after.** Two real independent sessions on
the shared provider account against live dev: with the default scope the
bystander's refresh returns `Invalid Refresh Token: Refresh Token Not Found`;
with `{ scope: 'local' }` it survives. Then the same thing end-to-end — the new
guard was run **against the unfixed code first** (it failed, landing on
`/login?next=%2Fdashboard%2Ftoday`, the CI symptom exactly) and again after
(passed), on a **production build** per §9.

**The regression guard lives in the cross-portal test**: a second browser
context signed in as the provider at the front desk, asserted still working
after the admin door refuses those same credentials. It would have caught this
on the A01 PR.

**Deliberately unchanged:** the recovery-code reset in `admin/actions.ts` stays
GLOBAL — killing every session is its entire purpose (A01 ruling ②) — as do the
two explicit logout buttons.

⚠ **The transferable lesson, now in ENGINEERING-WORKFLOW §6a:** a suite whose
FAILING TEST CHANGES every run is not flaky; it has one shared cause and the
tests are just the dice. Chasing the individual test is how three days go by.

### 2026-08-08 · A01 — Admin auth (password + TOTP + recovery) & the /admin shell

The admin portal exists. The founder signs in with email + password, is forced
to replace the seeded temp password, enrols an authenticator, saves eight
recovery codes, and lands in the shell — sidebar, header, seven surfaces, admin
accent. Role-gated hard.

**⚠ THE GENESIS ADMIN IS THE HEADLINE, not the login screen.** `admin_users` had
ZERO rows since the schema was written, so `get_user_role()` could only ever
return `'patient'` and **every `admin` policy in the database was unreachable
dead code**. A01 is what switches twelve of them on. The consequences are the
ruling-③ table below, and they are A02's opening decision.

**Founder ruling ① — migration PLUS seed, split by concern.** DDL is applied via
MCP `apply_migration`, which takes NO variables, so a migration could only carry
the temp password as a literal — in a PUBLIC repo. And migrations run once,
which is the opposite of the replayable bootstrap prod needs. So: schema in
`20260808161645` (+ two follow-ups), account in
`supabase/seeds/005_admin_users.sql`, following `003_provider_users.sql`
exactly — psql `-v`, documented variable NAMES only, `auth.users` +
`auth.identities` both written (an identity-less user cannot sign in),
`ON CONFLICT … SET` upsert. Verified idempotent; login proven from the browser.

---

#### ⚠ FOUNDER RULING ② — THE SPIKE SAYS **NO**. The fallback ships.

26/26 Node checks against the live project, run BEFORE any UI existed. The
verdict is not close:

- `auth.admin.mfa.*` exposes exactly **`deleteFactor, listFactors`**. No
  `challenge`, no `verify`, nothing matching `/aal|assurance|elevat/`.
- Supabase's own MFA reference states it: **"Recovery codes are not supported."**
- `mfa.verify` refuses a recovery-code-shaped string (`Invalid TOTP code
entered`) — there is no slot to put one in.
- The only way a server could satisfy `verify` is to read
  `auth.mfa_factors.secret` — stored in **PLAINTEXT**, confirmed by reading it —
  and compute the user's own code. That is **forging** the second factor, which
  is exactly the "lookalike that bypasses MFA" SPEC-A01 forbids.

So a recovery code buys **one** thing: unbind the lost authenticator, kill every
session, force re-enrollment. Proven end to end, in the browser, against live
dev: factor deleted · sessions 0 · **1 code consumed, 7 live, the old batch of 8
superseded** · lockout counter cleared · re-enrollment restored aal2.

**⚠ THE GATE HAS FOUR STATES, NOT THREE — the fourth is new information.**
Supabase access tokens are **stateless with a 60-minute TTL** (measured: 3600s),
so "kill every session" does **not** revoke a token already issued. A stale
token keeps its `aal2` claim for up to an hour after a recovery reset — the
exact window the reset exists to close.

| session state          | gate decision                              |
| ---------------------- | ------------------------------------------ |
| aal1 + verified factor | the TOTP verify step only                  |
| aal1 + NO factor       | the ENROLLMENT screen only                 |
| aal2 + verified factor | everything                                 |
| **aal2 + NO factor**   | **stale token → enrollment, never access** |

So the gate never trusts the `aal` claim alone: `get_admin_auth_state()` reads
`auth.mfa_factors` live inside a SECURITY DEFINER function (no client can see
that table) and pairs the two. Gating on aal2 alone in the no-factor case would
**brick** the account — no factor means aal2 is unreachable, and if aal2 were
required to enrol there would be no way back in, ever.

**The accepted window, stated rather than discovered:** between the reset and
re-enrollment the account is on password alone. Bounded — the next sign-in is
forced through enrollment before it reaches any surface.

---

#### ⚠ FOUNDER RULING ③ — every admin policy, exercised for the first time

`get_user_role()` returns `'admin'`. Reads + REVERSIBLE writes on throwaway rows
only; all reverted (bookings back to 42, fixtures untouched).

| table / fn                      | op                       | outcome                                                    | intent                        |      |
| ------------------------------- | ------------------------ | ---------------------------------------------------------- | ----------------------------- | ---- |
| 17 tables                       | SELECT                   | ALLOWED                                                    | allow                         | ✓    |
| `service_categories`            | INSERT/UPDATE/DELETE     | ALLOWED                                                    | allow — A04's launch switch   | ✓    |
| `admin_users`                   | SELECT                   | ALLOWED                                                    | allow                         | ✓    |
| `admin_users`                   | INSERT (self-escalate)   | **DENIED 42501**                                           | deny                          | ✓    |
| `admin_users`                   | UPDATE                   | **DENIED 42501**                                           | deny                          | ✓    |
| `admin_recovery_codes`          | SELECT / INSERT          | **DENIED 42501**                                           | deny                          | ✓    |
| `admin_lockouts`                | SELECT / INSERT          | **DENIED 42501**                                           | deny                          | ✓    |
| `users`                         | UPDATE `phone`           | DENIED 42501 — by **column GRANT**, not the policy         | deny                          | ✓    |
| `branches`                      | UPDATE rating/allocation | **ALLOWED — wrote rating=5, allocation=99**                | deny (marketplace integrity)  | ⚠    |
| `slots`                         | INSERT + UPDATE capacity | **ALLOWED — wrote capacity=99**                            | deny                          | ⚠    |
| `bookings`                      | INSERT w/ money          | **ALLOWED — `total=1, commission=0, payment_status=paid`** | deny (server-derived money)   | ⚠    |
| `bookings`                      | UPDATE money             | **ALLOWED — rewrote total to 99999**                       | deny                          | ⚠    |
| `payments`                      | INSERT                   | **ALLOWED — declared a payment `completed`**               | deny (§8 settlement boundary) | ⚠    |
| `reviews`                       | UPDATE `is_flagged`      | 0 rows — **no admin write policy exists**                  | moderation unspecced          | flag |
| `get_admin_auth_state`          | EXECUTE                  | ALLOWED                                                    | allow                         | ✓    |
| `generate_admin_recovery_codes` | EXECUTE @aal1            | REFUSED `aal2_required`                                    | deny at aal1                  | ✓    |

**A01 closed exactly one of these — `admin_users`, the one the founder
delegated.** The other eleven are flagged, not fixed: deciding per table what
the admin panel may legitimately write IS A02–A06's scope, and closing them
blind would break the A-series before it is specced.

**Why it is this wide:** every table except `users` still carries **blanket
all-column INSERT+UPDATE grants to `anon` and `authenticated`**, so RLS policy is
the only gate. `users` is the sole exception, and only **by accident** —
REFACTOR 2/N narrowed its grants (INSERT 2/11, UPDATE 6/11) for unrelated
reasons, and that narrowing is what stops an admin writing `users.phone` despite
a policy that says ALL. That is the clearest unreachable-BY-ACCIDENT case in the
schema.

**⚠ THE METHOD MATTERS, because the first matrix was wrong and looked right.**
RLS denies by **filtering rows**, not by raising — an UPDATE against an id that
matches nothing returns "0 rows" whether the policy allows it or forbids it. Only
a GRANT failure raises 42501. Two more probes returned `23503`, which is a
FOREIGN-KEY violation, not a denial. A conclusive probe needs a row that really
exists and that we are allowed to break, so the second pass created real
throwaway rows and destroyed them. **A policy probe that cannot fail is not a
probe.**

---

#### Three decisions A01 made

1. **`admin_users` is no longer client-writable.** The `ALL` policy became
   SELECT-only and INSERT/UPDATE/DELETE were REVOKED from `anon`+`authenticated`
   — policy and grant are independent mechanisms and both had to shut.
   Adding/removing an admin is runbook + seed in v1.
2. **The lockout table is service-role/definer only** — zero policies, RLS on,
   grants revoked. Decided up front so `authz:check` had a recorded answer
   before the build, exactly as asked.
3. **No self-service password reset**, per the design. The manual procedure is
   `docs/runbooks/RUNBOOK-admin-account.md`, which is also A01's answer to
   "where does a deliberate absence of automation get written down".

#### ⚠ A bug found by RUNNING the flow, not reading it (§9's whole point)

Enrollment succeeded, the session became aal2 — and Next revalidated the route
after the server action, which re-ran the enroll page's gate, saw a
fully-authorised admin, and **redirected to `/admin/overview`, destroying eight
one-time recovery codes before they were ever displayed.** They exist only as
bcrypt hashes, so they were unrecoverable: «تُعرض مرة واحدة» would have shown
them ZERO times, and the founder's only recovery path would have been a set of
codes nobody saw.

The gate cannot be told "the client is holding codes" — the server has no way to
know. So the fact became SERVER STATE (`admin_users.recovery_codes_acknowledged`,
migration `20260808231917`): generated → FALSE, the checkbox → TRUE, and the gate
keeps routing to enrollment until it flips. On a reload the plaintext really is
gone, so that screen says so plainly and offers a regenerate — which turns
«ولّد مجموعة جديدة بعد الدخول» from decoration into the actual remedy. The E2E
carries the regression guard.

**A second bug, same origin:** `uuid_generate_v4()` also lives in the
`extensions` schema, so a bare call inside a body pinned to
`search_path = public` raises 42883. The pgcrypto calls were already qualified;
this one was missed. **A column DEFAULT is immune** (its expression stores the
resolved OID), which is why the table inserted fine and only the function failed
— an asymmetry that survives any read of the migration.

#### Built to the handoff

`Admin - Login and TOTP.dc.html`, all four drawn screens: the two-panel password
step, the TOTP row with its 30-second validity bar, the wrong-code state with
attempts-remaining + clock-drift hint, and the enrollment card with QR, manual
key and the eight codes. Everything new went through the **contract**, not the
page — `ADMIN_ACCENT` (the deep-ink `#023449` that distinguishes الإدارة from
بوابة الشركاء, a literal in every admin screen with no `_ds` token),
`ADMIN_PILL`, `ADMIN_SOON_CHIP`, `CODE_CELL` + `CODE_CELL_STATES`,
`TOTP_VALIDITY_BAR`, `RECOVERY_CODE_CELL`.

**التحليلات renders its APPROVED design, not a placeholder** — five questions,
each with the evidence it needs — because that screen is finished and rendering
it as a stub would throw it away. The other six carry their real title, a
«قريباً» chip, and what they will do.

**Composed from the contract where the bundle has no screen** (§9's second
branch, which SPEC-A01 explicitly invokes): the forced password change and the
recovery-code entry path. Both reuse the login screen's own anatomy.

**Two deviations, flagged for the bundle's next revision:** the recovery-code
copy now says a code **unbinds the authenticator** rather than logging you in
(ruling ② changed the mechanism, so the copy follows); and the code alphabet
excludes O/I/L/U/0/1 for legibility — the SHAPE (`XXXX-XXXX`) is the design's.

**Two VIEW-01 lessons applied at birth:** the TOTP cells FLEX rather than taking
a pixel width measured on this machine, and the Analytics evidence chip uses an
`auto` track, not the design's fixed 160px — that chip is nowrap Arabic, which
renders wider on Linux CI than on Windows.

#### Verified

**Live browser run, end to end:** first login → forced change → enrollment (real
QR, real secret, real TOTP) → 8 codes → checkbox gates continue (asserted
disabled before, enabled after) → shell. Returning login. Wrong code → «بقيت لك
٤ محاولات», the SERVER's counter, plus the clock-drift hint. Recovery code →
factor unbound, sessions killed, code consumed, back to enrollment.
**Cross-portal both ways:** an admin visiting `/dashboard/today` gets the
provider gate's `?rejected=1`; a provider at the admin door is refused and
signed back out.

**Gates:** format, lint, typecheck, 397 core + 88 mobile + 25 tokens unit tests,
web build + mobile export, `pnpm audit --audit-level=high` all green.
`authorization-surface.json` regenerated — the diff is +2 zero-policy tables,
`admin_users` ALL→SELECT, +7 functions, **zero identity parameters**. Verified
against the live catalog rather than assumed. `database.ts` regenerated and
checked mechanically: 19/19 tables, 33/33 functions, no drift (the P05 lesson —
a hand-edited `database.ts` shipped a real bug).

⚠ **`pnpm audit` needed the §4 fix order for the fourth time.** New upstream
advisories (nanoid, js-yaml ×2, postcss) landed mid-PR — all via `postcss`/Expo,
**none from `qrcode`**, whose whole tree is three packages. Fixed by overrides.
`image-size` has NO patched version at all and is build-tooling only
(metro/@expo/cli, never shipped), so its two GHSAs are ignored with this note;
**revisit at the Expo SDK upgrade.**

#### For A02

- The shell's conventions to reuse: `getAdminContext()` for the gate,
  `AdminHeader`/`ComingSoonSurface` for chrome, `ADMIN_NAV_ITEMS` for the
  sidebar, `data-testid="admin-*"` throughout.
- **Open with the eleven-policy decision above.** A02 touches `bookings` and
  `payments` — the two worst rows in that table.
- `DECISION-commission-attachment` is unchanged: auto-closed
  (`closed_by = 'system'`) bookings are EXCLUDED and must be visibly footnoted.
- The `admin-recovery-reset` Edge Function is the second service-role function
  after `settle-payment`; it re-checks authorization itself rather than
  inheriting the RPC's check, and carries NO CORS headers because its only
  caller is a server action.

#### Founder actions

1. **Do the real first login** at `/admin/login` and store the eight recovery
   codes off-device. The dev account is reset to a pristine first-login state.
2. **Add `ADMIN_TEST_EMAIL` / `ADMIN_TEST_PASSWORD` as GitHub secrets** or the
   admin E2E SKIPS in CI — and a skipped suite looks exactly like a passing one.
3. ~~Turn on `auth_leaked_password_protection`~~ — **Pro-plan only, declined
   2026-08-09.** Choose admin passwords from a password manager; nothing checks
   them server-side.

---

### ⤶ Older ship entries → [`PROGRESS-ARCHIVE.md`](./PROGRESS-ARCHIVE.md)

Everything shipped before 2026-08-08 lives there, verbatim and newest-first —
35 entries, VIEW-01 back to SETUP-01 and DESIGN-01.

**Read the archive only when hunting history.** A session needs this file:
the newest three entries say where things stand, and the OPEN items below
say what is still true. The archive says how we got here, which matters
exactly when something looks arbitrary.

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

- ✅ ~~PAYMENTS ARE SIMULATED — launch blocker~~ and ~~final payment-method lineup
  is an OPEN PRODUCT DECISION~~ — **BOTH CLOSED 2026-08-04 by deciding v1 collects
  no money.** Cash-at-branch is the whole lineup, so there is nothing left to
  simulate and nothing left to choose: the app is honest by construction rather
  than by badge. **This un-blocks launch** — the previous blocker was "no
  merchant account", and v1 needs none. Card via PayTabs returns
  post-market-proof (test credentials + integration spec ready and parked in
  `payment-paytabs.ts`; re-entry is one line, `OFFERED_PAYMENT_METHODS`).
  ⚠ Two things a future session must not "restore": Fawry can never ship as the
  design drew it (PayTabs Egypt has no Fawry, no Vodafone Cash), and re-offering
  a prepaid method requires the «وضع تجريبي» badge to come BACK if it is still
  simulated.
- **⚠ STORE-PREP (PROF-01): the app cannot be submitted without a live PRIVACY
  POLICY and TERMS URL.** Apple and Google both require a reachable privacy
  policy; the profile rows render disabled «قريباً» until the URLs exist. Not a
  code task — a founder/legal one, and it blocks submission, not development.
- **⚠ The patient-support contact is UNSET.** `PATIENT_SUPPORT` in core is
  all-null, so «تواصل معنا» hides itself rather than showing a number nobody
  answers. Supply a WhatsApp number (preferred), a phone, or an email and the
  row appears with no code change beyond the constant.
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

- **⚠⚠ ELEVEN ADMIN `ALL` POLICIES ARE NOW LIVE — A01 switched them on, and
  A02 must open by deciding what to do about them.** Until 2026-08-08
  `admin_users` had zero rows, so `get_user_role()` could never return `'admin'`
  and every admin policy was unreachable dead code. The genesis admin ends that.
  Measured with a real admin session (full table in the A01 Shipped entry):

  | table                                                                                                        | what an admin's BROWSER can now do                                                                        |
  | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
  | `payments`                                                                                                   | ⚠ INSERT a payment row marked `completed` — breaks §8's settlement boundary                               |
  | `bookings`                                                                                                   | ⚠ INSERT/UPDATE `total_amount`, `commission_amount`, `payment_status` — reverses migration 20260729160519 |
  | `slots`                                                                                                      | ⚠ INSERT rows and raise `capacity`                                                                        |
  | `branches`                                                                                                   | ⚠ set `rating`, `review_count`, `instahealth_slot_allocation`                                             |
  | `providers`, `services`, `service_categories`, `provider_users`, `notifications`, `branch_services`, `users` | full row access (several legitimate — A03/A04/A05 need them)                                              |

  **Why so wide:** every table except `users` still carries BLANKET all-column
  INSERT+UPDATE grants to `anon`+`authenticated`, so the RLS policy is the only
  gate. `users` is narrowed only because REFACTOR 2/N happened to do it.

  **Not exploited** — the only admin account is the founder's, behind TOTP — and
  the exposure is roughly an admin's trust model anyway. But `payments` and
  `bookings` are money facts the whole schema was deliberately re-plumbed to
  make server-derived, and a browser session should not be able to assert them.
  **A01 deliberately did not widen into this** (founder ruling ③: flag, don't
  silently fix); the per-table answer is what the admin panel legitimately needs
  to write, which is A02–A06's scope. Close them the writer-function way.

- **⚠ `reviews` has NO admin write policy at all** — only a SELECT escape hatch
  on "public read unflagged". So an admin can READ a flagged review and cannot
  un-flag it: moderation has no path. Unreachable BY ACCIDENT rather than by
  design, and F08 is the natural place to decide it.

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
  - **`auth_leaked_password_protection` is DISABLED and will stay that way.** Supabase
    can check new passwords against HaveIBeenPwned, but it is a **Pro-plan** feature and
    the founder declined it 2026-08-09 at this stage. Consequence to keep in mind: no
    server-side check catches a weak or breached password, so every staff and admin
    password must come from a password manager. Revisit if the project moves to Pro.
  - **Six SECURITY DEFINER functions are still anon-executable**: `get_branch_slots`
    (deliberate — public slot browsing), `get_user_role` / `get_provider_branch_ids`
    (return empty for anon; harmless but pointless to expose), and
    `handle_new_user` / `broadcast_slot_hold_change` / `broadcast_branch_booking_change`
    (TRIGGER functions — Postgres refuses a direct call, so the grant is noise, not a hole).
    A one-migration REVOKE sweep would clear all but the first.
  - **Eleven functions have a mutable `search_path`** — the older ones predate the
    `SET search_path = public` convention. Same sweep.
  - `pnpm audit` carries one ignored GHSA (`GHSA-mh99-v99m-4gvg`, build tooling).
- **⚠⚠ LAUNCH BLOCKER — COMMISSION RATES ARE PLACEHOLDERS (12%). Enter the
  signed values via A03 before the first real statement.** A02 backfilled
  `provider_commission_rates` with 12.00% for both partners, effective from
  2026-01-01, because **no signed agreement rate exists yet** (founder ruling,
  2026-08-09). The design's «١٢٪ → ١٣٪ من ١٦ يوليو» was ILLUSTRATIVE and is
  deliberately NOT seeded; tests bring their own rate-change fixtures. Every
  backfilled row carries a `note` saying so, so the placeholder is visible in
  the data rather than only in this file. The statement will compute and issue
  perfectly against a wrong number — that is exactly why this is a blocker and
  not a nicety: **a partner would be invoiced against a rate nobody agreed.**
  ⚠ A missing rate THROWS rather than defaulting, which is deliberate; a WRONG
  rate cannot be detected by any code. Only a human comparing it to a signed
  agreement can catch it.
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
