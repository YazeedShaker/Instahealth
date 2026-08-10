# SPEC · A03 — Admin: Providers & Branches + Rate Editor (Web)

> Read: root docs, docs/CHECKLIST.md, PROGRESS (A02 hand-off), DECISION-slot-allocation-
> ownership.md, the Providers & Branches frames in design/handoff/ (list, provider detail
> with rate editor, branch detail with regeneration confirm, deactivation confirm, states).
> Requires A02 merged. One PR. Tiers per docs/CHECKLIST.md noted per section.

## Goal

The screens where InstaHealth manages the network and its commercial terms: provider list →
provider detail (fields, branch list, THE RATE EDITOR) → branch detail (the admin-owned
fields the partner portal locks: name, hours, allocation, pin, active) — plus creation flows
for onboarding new partners. Closes the loop DECISION-slot-allocation-ownership promised:
allocation changes are an admin action with the regeneration consequence stated in numbers.

## A · Writers & data — **Tier 1**

1. **Rate editor backend:** append-only INSERT into `provider_commission_rates` via an
   admin-gated DEFINER function (the P03 write pattern: role check inside, audit row,
   explicit grants). Rules per the design rulings: effective_from strictly future (past
   dates rejected server-side), never an UPDATE/DELETE on existing rows. The UI confirm per
   the approved frame — old/new split by event date, statements-untouched line, and the
   **required written-partner-acknowledgment checkbox** (design ruling: required element).
2. **`admin_update_branch`** — DEFINER writer for the admin-owned branch fields (name AR/EN,
   hours, allocation, lat/lng, is_active) + audit rows into the existing branch history
   (one trail per entity, both portals — the shared audit panel reads it). No client-side
   path exists for these by construction (post-REFACTOR state); this function is the ONLY
   writer. Same for provider fields + `is_active` (`admin_update_provider`).
3. **Slot-shaping changes (allocation OR hours) trigger regeneration:**
   `preview_allocation_change(branch, …)` returns the confirm dialog's exact numbers
   (empty future slots to delete/regenerate, standing bookings preserved, date range);
   the writer then applies + regenerates the 30-day window by REUSING the existing
   `generate_branch_slots` (capacity-1 model — do not reimplement). Standing bookings and
   today untouched, per the approved dialog's promises — the dialog's numbers must be the
   function's numbers.
4. **Creation:** `admin_create_provider` (fields + REQUIRED initial rate row with
   effective_from + the acknowledgment flow — a provider cannot exist rate-less, A02 throws
   on missing rate) and `admin_create_branch` (fields, coords, hours, allocation default 5,
   **created inactive** — activation is its own consequential confirm, "ظهر للمرضى").
5. Provider deactivation per the approved escalated confirm (branches hidden immediately,
   standing bookings unaffected and still served — counts in the dialog from a preview fn).

## B · Screens — **Tier 2** (per the frames, component contract only)

- List (search/filter, the reserved نسبة الفرع column disabled with footnote), provider
  detail (fields, rate history with ساري chip, branch list rows, audit panel), branch detail
  (editable admin fields + regeneration flow + audit panel), creation forms (per frames;
  where a frame is thin, compose from contract — no invention), all loading/empty/error
  states per bundle. Fidelity screenshots per convention.

## Tests

**Node (Tier 1 only):** rate append-only + past-date rejection + acknowledgment enforced
server-side isn't required (UI concern) but audit row is; allocation change → preview
numbers == applied numbers, standing bookings survive, patient picker reflects new slot set
(one query check); creation → provider unusable until rate exists, branch invisible until
activated; deactivation hides branches from patient discovery query; provider/patient
sessions denied all writers.
**Playwright (Tier 2):** one happy path each — edit a field + audit entry appears; rate
change flow through the confirm; allocation change through the regeneration dialog; create
provider→branch→activate; deactivate provider.
**Manual (batched into the weekly pass, not blocking merge):** allocation change on a dev
branch → phone shows the new slot picture.

## What NOT to do

No role tiers. No branch-level rate overrides (column stays disabled). No slot-time custom
distribution UI (even spread per the generator). No partner-facing anything. No statement
changes (A02's functions are consumed, not touched).

## When done

PROGRESS ship entry + hand-off for A04+A05 (paired session: catalog + staff — both consume
the audit panel and the P03/A03 write pattern; staff creation per the approved temp-password
flow). Note for the founders' agenda: the rate editor now exists — signed rates can be
entered the day agreements are signed.
