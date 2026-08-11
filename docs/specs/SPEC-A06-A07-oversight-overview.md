# SPEC · A06+A07 — Admin: Bookings Oversight + Ops Overview (Web, paired — final)

> Read: root docs, docs/CHECKLIST.md, PROGRESS (A04+A05 hand-off), the Bookings Oversight
> and نظرة عامة frames in design/handoff/ (incl. the approved عمولة متوقعة annotation and
> the honest-zero first-day state). Requires A04+A05 merged. One session, one PR, two commit
> groups. Tiers per CHECKLIST.

---

# A06 · Bookings Oversight

## Writers & data — **Tier 1**

1. **Admin cancel-on-behalf:** its own writer per the standing pattern (NOT a loosening of
   the patient or provider paths): required reason (enum per the frame's dropdown + free
   text; logged to audit, never sent to the patient), slot release, `cancelled_by='admin'`,
   same before-slot-start boundary. Preview-less; the confirm's facts (slot release, no
   commission on cancelled, no-refund under cash-v1) are static truths, render per frame.
2. **The admin-only money block reuses A02's computation functions** (built shareable by
   ruling): per-booking rate-at-event-date, commission amount, statement-month link. The
   **عمولة متوقعة chip rules** per the approved annotation: expected on
   confirmed/arrived cash; actual at completed (prepaid: at payment); ABSENT on
   cancelled/no_show. The drawer must never disagree with the statement it links to — one
   shared source, zero drawer-local math.
3. **Search:** ref (exact, forgiving of case/spacing), patient phone (normalized via core —
   finds ALL their bookings incl. cancelled), provider/status/date filters. Server-side,
   admin-gated read per the verified policy matrix.

## Screens — **Tier 2**

Per frames: the network list (admin-cancelled rows' deep-ink tint), the P02 drawer reused
in structure with the admin deltas (money block present, تسجيل الوصول ABSENT — admin cannot
check in, the two-portal authority model), cancel confirm, not-found state routing to phone
lookup, loading/empty. Fidelity screenshots.

---

# A07 · Ops Overview (نظرة عامة)

## Detectors & data — **Tier 1**

1. **Health detectors as admin-gated functions, each returning its frame's exact facts:**
   - _Slot generation stale:_ last successful run (read the real cron run history that
     exists in the platform — pg_cron run details or the function's own effects; pick what's
     verifiable and document it), threshold ~26h → the alert with since-when + affected
     branch count.
   - _Active branch with zero bookable slots today_ (visible to patients, nothing bookable)
     with per-branch since-when.
   - _Branch with zero active staff accounts_ (A05 made this real data) + upcoming-bookings-
     unattended count — the escalated fact from the A05 confirm, now monitored.
     The "لا شيء يحتاج انتباهك" state lists what was checked (per frame) — the honest-green,
     not an empty div.
2. **"شغّل التوليد الآن"** — the drawn action: admin-gated invocation of the existing
   generation function (reuse, never reimplement), result reflected in the panel. Other
   alert actions LINK to their owning screens (the standing check) — only this one mutates.
3. **Stat cards:** today's bookings, network fill (the shared definition — zero new
   predicates), today's cancellations, month-to-date **expected** commission carrying the
   frame's "ليست فاتورة" subline (A02's draft computation, clearly not a statement).
4. Auto-refresh ~5min per the frame's note; per-branch today table from the shared
   derivations.

## Screens — **Tier 2**

Per frames: cards, attention panel (patient-impact ordering, no dismiss, one concrete action

- alternative per alert), per-branch table, first-day honest-zero state ("٨ فروع نشطة ·
  ١٤٧ موعداً متاحاً — لم يصل أول حجز بعد"), loading skeleton. Second-pass note stays on
  record in PROGRESS. Fidelity screenshots.

---

## Tests

**Node (Tier 1):** admin cancel (boundary, reason required, audit, slot release, patient's
حجوزاتي reflects admin attribution); chip rules matrix (expected/actual/absent × method ×
status) sourced from A02 fns with zero local math — assert drawer value == statement value
for a completed row; each detector fires on a seeded broken state AND stays quiet on healthy
(both directions); run-now generates and clears its alert; phone search finds cancelled
bookings; non-admin denied.
**Playwright:** search → drawer → money block variants; cancel flow with reason; overview
healthy + one seeded alert + first-day zero.
**Manual (weekly batch):** admin-cancel a dev booking → desk sees it live → patient sees
ألغته الإدارة.

## What NOT to do

No check-in from admin. No reschedule. No alert emails/WhatsApp (annotated post-v1). No
week-over-week trends (post-v1 per frame notes). No analytics beyond the stub (DESIGN-04,
post-pilot). No new fill/availability predicates anywhere.

## When done

**The admin portal is COMPLETE.** PROGRESS entry + a portal-wide closing note: the full
admin surface map, the runbook index (invoicing, password resets, recovery, monthly
procedure), and the remaining board: F08 (reviews, submission+display — next spec), the
P05 fidelity+card fix, EAS publish + auto-publish job, then pilot-prep. Flag for founders:
the software side of "run the marketplace" is done pending F08.
