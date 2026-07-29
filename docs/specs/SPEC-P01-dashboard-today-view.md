# SPEC · P01 — Provider Dashboard: Auth, Shell & Today View (Web)

> Hand this to Claude Code. Read `CLAUDE.md`, `PRODUCT.md`, `docs/ENGINEERING-WORKFLOW.md`,
> `PROGRESS.md` (F06/F07 Shipped entries + hand-off notes: statuses, payment semantics,
> cancellation policy, the two open business decisions), the dashboard design handoff in
> `design/handoff/project` (Login + Today view + the extended status-chip set; the other screens
> are LATER P-specs — do not build them), and the DB contract (bookings statuses,
> provider_users, RLS). Verify everything against the live dev DB. One PR.
> This is the FIRST real feature in `apps/web` — foundation choices here carry.

---

## Goal

Milestone one closes here: a receptionist at Town Hospital or a Saridar branch signs into
بوابة الشركاء on a desktop, sees TODAY's InstaHealth bookings for their branch in realtime,
knows who paid and who pays at the desk, and marks what happened (وصل / تمت الخدمة / لم يحضر).
Patient books on a phone → desk sees it → desk records the outcome. The loop.

## A · Data layer first (migration + seed)

1. **Outcome statuses:** ensure the bookings status model supports the receptionist workflow:
   `confirmed → arrived → completed` and `confirmed → no_show` (plus existing
   pending_payment/cancelled). Read the current enum/constraint; add what's missing in a
   migration. Persist `arrived_at`, `completed_at`, `no_show_at` timestamps (the
   commission-at-completion decision will need them — record that link in a comment).
2. **`mark_booking_outcome(p_booking_id, p_outcome)` RPC** — SECURITY DEFINER with explicit
   grants per the grants-sweep pattern (authenticated may EXECUTE, but the function itself
   verifies the caller is a provider_users member of the booking's branch — RLS-equivalent
   check inside, since DEFINER bypasses RLS). Enforces legal transitions only (no completing
   a cancelled booking, no un-no-showing; illegal transition → schema error object).
   Cash-payment interaction: marking completed on a cash booking also flips its payment row
   per the DB contract (read `payments` semantics from F06 interpretation #5 and follow —
   the desk collecting cash IS the payment event; document the interpretation).
3. **provider_users seed** (dev): Supabase auth users (email/password) + provider_users rows —
   two Town Hospital receptionists and one for a Saridar branch (e.g. Dokki), with the
   user_role claim path verified for the provider role (same trigger/claim mechanism as
   patients — verify, don't assume it covers non-patient roles). Document the dev credentials
   in the seed file header. RLS: providers read ONLY their branch's bookings (and the joined
   patient name/phone — legitimate operational need), write NOTHING directly (outcomes go
   through the RPC). Prove the scoping from Node: a Town receptionist must get zero rows for
   a Saridar branch.

## B · Web foundation (`apps/web`)

- Port the design tokens to Tailwind config from the dashboard handoff (the mobile theme is
  NativeWind — same values, web-native setup). Cairo font, RTL root (`dir="rtl"`), light mode.
- Supabase auth for web (SSR-safe client per current Supabase/Next.js 15 practice), provider
  login page per the approved design, session middleware protecting `/dashboard/*`,
  role-gated: a PATIENT session must not enter (friendly rejection), and login errors map to
  Arabic messages (F01's error-mapping discipline).
- Shell per design: branch name header, date, the fill indicator (٣/٥ محجوز اليوم), logout.
  Multi-branch users (future) out of scope: one provider_users→branch mapping assumed; if the
  schema allows many, pick the first and flag it.

## C · Today view (per the approved design — build exactly)

- Today's bookings for the receptionist's branch, ordered by slot time. Row anatomy from the
  design: time, patient name + phone (tel: link), services summary, prep-required indicator,
  payment state (تم الدفع vs يدفع هنا — unmissable per the design), status chip (extended
  set from the handoff), and the single contextual primary action:
  confirmed→[وصل], arrived→[تمت الخدمة], plus [لم يحضر] where the design places it.
  Optimistic UI on actions with rollback on RPC error (error toast, Arabic).
- **Realtime:** new/updated bookings for the branch appear without refresh (postgres_changes
  subscription scoped to the branch, RLS-respecting — verify realtime is enabled for the
  table; if not, enable via migration). The design's new-row highlight treatment on arrival;
  sound toggle default OFF. Fallback: refetch on window focus + 60s polling when the socket
  drops (show nothing scary — a quiet "متصل/غير متصل" dot per design if provided).
- Cancelled bookings render per design (visible with cancelled styling — the desk must SEE
  cancellations, not have rows vanish mysteriously).
- States: loading skeleton, empty ("لا توجد حجوزات اليوم"), error with retry.

## Consistency section

- Display predicates = enforcement predicates: the action button shown ≡ transitions
  `mark_booking_outcome` accepts; fill indicator counts ≡ the DB's booked_count definition.
- Every mutation path idempotent-or-clean-error (double-click وصل must not error-toast twice).
- Empty means absent (no prep → no indicator).

## Tests

**Node-against-dev (both a provider session and patient sessions):** RLS scoping (own branch
only, patient blocked from the RPC and the queries), every legal + illegal outcome transition,
cash completion flips payment correctly, realtime event received on a fresh booking.
**Playwright (this is why it's been sitting in CI):** login → Today view renders seeded
bookings → mark arrived → completed → chip/action progression correct → no-show path →
patient-role login rejected. Static provider test creds from the seed.
**Manual (recorded in PR):** phone books at Town (mock pay) → row appears on the desktop
WITHOUT refresh → mark وصل ثم تمت الخدمة → patient's حجوزاتي reflects completed on next
focus. Then the cash variant: book cash on phone → desk shows يدفع هنا → completed → payment
state updates both sides. THIS is milestone one — record it as such in PROGRESS.

## Acceptance criteria

- [ ] Receptionist login works; patient sessions rejected; RLS branch-scoping proven
- [ ] Today view matches the approved design RTL at 1366×768; realtime arrival verified
- [ ] Outcome workflow enforced server-side incl. timestamps; cash completion = payment event
- [ ] Milestone-one manual test recorded (phone→desk→outcome→phone)
- [ ] PROGRESS updated (+ the commission-at-completion data note); CI green incl. Playwright

## What NOT to do

- No booking detail drawer, upcoming days, prices editor, or slot views (P02+ per the
  approved designs — one screen done well beats four scaffolds).
- No provider self-service onboarding (A-series). No analytics beyond the fill indicator.
- No new visual patterns — the handoff is the contract.

## When done

PROGRESS ship entry + hand-off for P02 (detail drawer + cancel-on-behalf) and P03 (upcoming
days), noting any row-component APIs they'll reuse.
