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

**Phase:** Booking loop COMPLETE on mobile (F01→F07: discover → select → hold → review → pay → confirmed → manage/cancel). Next: P01–P06 provider dashboard (closes the loop); F03 Search and F08–F09 still open
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
- [ ] **P01–P06** — Web: provider dashboard. **UNBLOCKED AND NOW THE CRITICAL PATH** — real confirmed bookings with payment rows exist in dev; a receptionist has nothing to see them on.
- [x] **F07** — ✅ DONE. Mobile: My Bookings list, detail & cancel (see Shipped)
- [ ] **F08–F09** — Mobile: reviews, profile
- [ ] **A01–A06** — Web: admin panel
- [ ] **006_practitioners.sql + doctor booking** — after labs/scans proven

**First milestone:** patient books on mobile at Town/Saridar → pays → gets SMS + confirmation →
receptionist sees it on web dashboard and confirms. Closed loop = model proven.

---

## Shipped

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
