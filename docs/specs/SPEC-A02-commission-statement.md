# SPEC · A02 — Admin: Commission & Invoicing Statement (Web)

> Hand this to Claude Code. Read the root docs, ENGINEERING-WORKFLOW, PROGRESS (A01 hand-off
> incl. the verified admin-policy matrix), docs/decisions/DECISION-commission-attachment.md
> and DECISION-booking-outcome-lifecycle.md (this spec implements them — verbatim, no
> reinterpretation), and the Commission Statement screens in design/handoff/ (all states:
> draft, sent+changed, settled, superseded/re-issued, cash-only variant). Verify against the
> live dev DB. Requires A01 merged. One PR.
>
> **V1 BUILD RULE:** rendering and computation are method-generic (prepaid at payment, cash
> at completion), but v1 reality is CASH-ONLY — seeds and tests are cash-only, the prepaid
> path ships computed-but-untested-by-data, no demo/statement ever shows prepaid rows, and
> the method-split summary line collapses gracefully per the approved cash-only frame.

## Goal

The founder picks a partner and a calendar month and gets the statement: every commissionable
booking as a traceable row, blended totals, the system-closed exclusions footnoted in the
open, a real issuance lifecycle (مسودة → أُرسلت → تمت التسوية) with frozen snapshots and
versioned re-issue — the document a partner pays against and disputes against. This is how
InstaHealth collects revenue in a cash-only world.

## A · Data layer (migrations)

1. **Effective-dated rates — `provider_commission_rates`:** provider_id, percent, effective_from
   (date), created_by, created_at (+ audit-friendly, append-only: changing a rate is a new
   row, never an update). Backfill: one row per provider from the current agreement value,
   effective_from = epoch/launch. The existing single-column rate (wherever it lives) becomes
   derived/deprecated — read paths move to the table; document the deprecation. (A03 builds
   the editor UI; A02 builds the truth it edits.)
2. **Statements — `commission_statements`:** provider_id, month (date, first-of-month,
   Africa/Cairo semantics), version (int, 1..n), status (draft implied by absence — rows
   exist from first ISSUE; enum: issued|sent|settled|superseded), issued_at/by, sent_at/by,
   settled_at/by, superseded_by (statement id), totals snapshot (gmv, commissionable_count,
   commission_total, excluded_count, excluded_amount), UNIQUE(provider_id, month, version).
3. **Line snapshots — `commission_statement_lines`:** statement_id, booking_id, booking_ref,
   booking_date, method, event_date, amount_egp, rate_percent, commission_egp — copied at
   issue time; the frozen truth the exports and the partner see.
4. **Computation function(s), admin-gated per the A01-verified pattern:**
   `compute_commission_draft(provider, month)` — live computation:
   - Commissionable events in the Cairo-calendar month: prepaid → payment event
     (confirmed_at/payments completed); cash → completed_at, **human-closed only**
     (`closed_by <> 'system'` — the decision doc's exclusion, enforced in SQL).
   - Excluded strip data: system-closed no_shows in-month with their would-have amounts.
   - Rate per row = the rate effective AT THE ROW'S EVENT DATE (from the rates table) —
     mixed-rate months are normal; totals are sums, never single-rate × GMV.
   - Money math via core's integer-piaster functions semantics (SQL mirror); missing rate
     for an event date = hard error, never a default.
     `issue_statement(provider, month)` — snapshots draft → statements + lines, version = max+1,
     marks any prior version superseded; `transition_statement(id, to)` — sent/settled with
     timestamps, legal transitions only; settled is TERMINAL and immutable (re-issue refused;
     post-settlement data changes surface as the credit-forward note, computed against next
     month's draft view — per the ruling).
     All: EXECUTE admin-only (grants-sweep pattern + role check inside), every action audited.

## B · Screen (per the approved frames — build exactly)

- Scope bar: partner picker × calendar-month picker (nothing else). Status chip + the manual
  transition affordances with their captured timestamps; the two dash-dates in draft.
- Summary cards incl. the method-split line that collapses in cash-only reality.
- The amber system-closed strip: count + amount + إظهار في الجدول toggle → struck-through
  rows that touch no totals.
- The table per design: ref, booking date, method chip, event date WITH its sublabel
  (تاريخ الدفع/تاريخ الإتمام), amount, rate, commission; mixed-rate footnote when applicable.
- Issue semantics: before first issue = live draft, labeled; after issue = the SNAPSHOT
  renders, with the changed-since-issue detection (live recompute vs snapshot compare) →
  the warning strip + إعادة إصدار (versioned; superseded v1 stays viewable, marked
  نسخة ملغاة, per the approved frame). Settled = immutable + credit-forward note when the
  underlying month has drifted.
- Export: CSV + print stylesheet, both carrying issue stamp, version, and the excluded-
  bookings footnote — paper agrees with screen (the approved annotation, now acceptance).
- States: loading, month-with-no-activity (honest zero), error. Traceability rule: every
  summary number must be reproducible from the visible rows — no orphan math.

## Consistency section

- The statement NEVER disagrees with the bookings-oversight drawer's numbers (A06 later
  reuses these functions — build them shareable); عمولة متوقعة semantics stay in the
  drawer's world — the statement contains only OCCURRED events.
- Display = enforcement: transition buttons shown ≡ transitions the RPC accepts; the
  re-issue button absent on settled.
- Timezone: month boundaries are Africa/Cairo throughout — computation, display, export.

## Tests

**Node (the heart — against dev with seeded scenarios):** month-boundary completions
(23:59/00:01 Cairo on the month edge land correctly); system-closed excluded from totals and
present in the strip; human no_show/cancelled → zero rows; mid-month rate change → rows
split correctly, blended total exact to the piaster; missing-rate hard error; issue →
snapshot stable while underlying data mutates → change detection fires → re-issue creates
v2 + supersedes v1 (both readable) → settle v2 → further mutation refuses re-issue and
surfaces credit-forward; double-issue guarded; provider/patient sessions denied everything.
**Playwright:** full lifecycle draft→issue→sent→settled with timestamps; excluded toggle;
cash-only collapse; CSV contains stamp/version/footnote; superseded version viewable.
**Manual (recorded):** generate the real July+August statements for Town and Saridar from
the dev data that exists; export both; eyeball every number to its rows.

## What NOT to do

No arbitrary date ranges. No automation of sent/settled (manual toggles are v1 truth). No
refunds/credits engine (credit-forward is a NOTE, not a ledger — the ledger comes with real
payments). No editing rates here (A03). No PDF generation (CSV + print stylesheet only).
No prepaid seed data.

## When done

PROGRESS ship entry + hand-off: A03 (rate editor writes provider_commission_rates —
append-only, effective-dated, the written-acknowledgment checkbox is REQUIRED per the design
ruling) and A06 (drawer reuses the computation functions; عمولة متوقعة chip rules). Update
the finance runbook: monthly invoicing procedure, step by step, founder-executable.
