# SPEC · A04+A05 — Admin: Service Catalog + Provider Staff Accounts (Web, paired)

> Read: root docs, docs/CHECKLIST.md, PROGRESS (A03 hand-off), DECISION-provider-data-model
> (catalog is admin-owned; is_active is the launch dial), the Catalog and Staff Accounts
> frames in design/handoff/ (all states incl. the approved additions: unpriced-branch rows,
> last-account disable escalation). Requires A03 merged. One session, one PR, two clearly
> separated commit groups. Tiers per CHECKLIST.

---

# A04 · Service Catalog

## Writers & data — **Tier 1**

1. **Map the design's service states (مسودة/منشورة/موقوفة) to the real schema first** —
   read services' columns; if a draft/suspended distinction is missing, add it by migration
   (do not overload branch-level is_available — that's the partner's dial from P03; these
   are the ADMIN's dial). Patient-side queries and the booking-creation rejection must
   respect the admin state exactly as they already respect the P03 checks (extend the shared
   predicate, prove with the existing regression pattern).
2. **Admin writers (the A03/P03 pattern — DEFINER, role check, audit, explicit grants):**
   create/update service (AR/EN names, code, category, prep notes), set service status,
   toggle category `is_active`. Publish/suspend/category confirms get preview functions
   feeding the dialogs' exact numbers (branches-live-now / unpriced-won't-appear counts;
   suspend's weekly-volume signal; category flip's network-wide counts) — dialog numbers ==
   function numbers, per the A03 rule.
3. Category `is_active` flip = THE launch switch — audit it with its own action label; the
   confirm carries the acknowledgment checkbox treatment (it's a network-wide commercial
   moment, same family as rates).

## Screens — **Tier 2**

Per the frames: list (search, category/status filters, the counts header), service detail
(definition fields, prep-note editor with the patient-side cream preview, the read-only
per-branch price table INCLUDING the approved "بلا سعر — لن تظهر" rows with per-row
nudge + footer bulk-nudge affordances rendered as mailto/WhatsApp links v1), publish +
suspend + category confirms, loading/empty/error. Fidelity screenshots.

---

# A05 · Provider Staff Accounts

## Auth flows — **Tier 1**

1. **Creation (the approved 2-step flow):** an Edge Function (service role) creates the auth
   user + provider_users row for a chosen branch, generates the temp password
   (shown ONCE in the step-2 frame with copy affordance), sets must_change + issued_at.
   Enforcement of the design's promises in the PROVIDER portal's login path: must_change →
   forced change before anything; unused temp older than 72h → refused with the
   "اطلب كلمة جديدة من الإدارة" copy (login-time check; no cron needed). Regenerate-temp
   action = same function, invalidates old, new shown once.
2. **Disable/enable:** disable = provider_users deactivated + auth sessions killed + login
   banned (Supabase admin ban) — immediate lockout per the confirm's promise; enable
   reverses with a fresh temp password flow. **The last-account escalation is enforced,
   not just drawn:** the confirm's data comes from a preview fn (active accounts remaining,
   upcoming bookings count), and the escalated variant renders when remaining == 0.
3. Role column: drawn, disabled, footnoted — no tiers (standing decision).

## Screens — **Tier 2**

List (per frames, last-login column), create flow both steps, account detail (scope
statement, regenerate, disable/enable with both confirm variants), audit panel showing both
portals' events (the partner's own first-login change appears under بوابة الشركاء). States
per bundle. Fidelity screenshots.

---

## Tests

**Node (Tier 1):** service-state enforcement reaches patient discovery AND booking creation
(suspended/draft rejected server-side); category flip flips the network; preview numbers ==
applied effects; staff temp-password lifecycle (create → login forces change → 72h-stale
refused → regenerate invalidates old); disable kills a LIVE session (prove with two
clients); last-account preview counts correct; non-admin sessions denied all writers.
**Playwright:** one happy path per flow (create service → publish; suspend; category flip;
create staff both steps; disable w/ escalated variant reachable via fixture).
**Manual (weekly batch):** suspend a service on dev → phone hides it; create a staff account
→ log into the provider portal with the temp flow end-to-end.

## What NOT to do

No service bundles, no price copying, no admin price editing (annotated v2 in the bundle).
No "request a service" partner affordance. No role tiers. No email delivery of temp
passwords (shown-once + founder relays it — v1 truth).

## When done

PROGRESS entry + hand-off for the final pair A06+A07 (oversight consumes A02's computation
fns + the عمولة متوقعة chip rules; overview consumes the alert states A05 just made
detectable — a branch with zero active accounts is now real data).
