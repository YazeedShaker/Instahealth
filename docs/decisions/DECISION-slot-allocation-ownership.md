# DECISION — Who owns a branch's slot allocation

> Ratified 2026-08-01 with P04. Settles the role-tier question P03 left open,
> and defines what the provider dashboard may and may not change.
> Referenced by SPEC-P04 and `apps/web/components/dashboard/SlotAllocationView.tsx`.

---

## The question

P03's hand-off flagged it: the slot-allocation design gates editing to branch
**owners**, but `provider_users.role` exists with no tiers defined and nothing
reads it. Every P01–P03 surface treats any member of `provider_users` as equally
privileged. So P04 had to either introduce the tier, or decide that nobody in
the dashboard edits allocation at all.

## The decision

**Allocation editing ships to NO provider role.**

`branches.instahealth_slot_allocation` and the daily working window are
**commercial terms of the partner agreement**, not operational settings. The
whole business model (CLAUDE.md §1) is that a partner ring-fences N slots per
day for InstaHealth; that number is what we negotiated, what we forecast
against, and what we grow as we prove we can fill it. Changing it is a
conversation, then an InstaHealth-admin action (A-series) — not a dashboard
toggle.

P04 is therefore a **read-only** view for the whole branch team, with the
design's gated treatment over the edit controls and one instruction:
«لتعديل عدد المواعيد تواصل مع إنستاهيلث».

## Why not the alternatives

- **Give owners the +/− control** (what the design bundle draws). A receptionist
  raising the allocation on a busy morning is agreeing, on the partner's behalf,
  to supply capacity nobody costed. A quiet branch lowering it silently starves
  the marketplace and no alert fires. Both are commercial decisions taken by
  someone with no mandate to take them, and neither leaves a negotiating record.
- **Introduce role tiers now, gate on owner.** That is real work —
  a column with defined values, a back-fill for existing rows, a membership
  check in every surface — spent to enable a capability we just decided nobody
  should have. Tiers are still needed for A-series onboarding, where they gate
  things that genuinely differ by person. Deferred to there.
- **Hide the panel entirely.** The desk then cannot see the number that governs
  its own day, and has no idea it is negotiable. The gated treatment shows the
  setting, its current value, and who owns it — which is the honest answer to
  "why can't I change this?".

## Consequences

- `provider_users.role` still needs no tiers. **P03's open flag is closed**;
  the A-series inherits the question.
- The A-series needs an admin-side allocation editor. When it lands it must
  regenerate the affected days' slots — changing the number does nothing on its
  own, because slots are materialised rows.
- Any future provider-facing write follows `update_branch_service` (P03): a
  SECURITY DEFINER function that checks membership, validates server-side and
  writes an audit row. Never a direct table write.

## ⚠ Open gap this decision does NOT yet enforce

The decision above is a PRODUCT rule. The database does not enforce it:

```
policy "branches: provider updates own branches"   cmd = UPDATE
USING (id = ANY (get_provider_branch_ids()) OR get_user_role() = 'admin')
WITH CHECK  = null
```

The policy is **column-blind**, so any provider staff member can `PATCH` any
column of their own branch row — including `instahealth_slot_allocation`,
`is_active`, and `rating` / `review_count`. Proven from Node during P04 by
moving Town's allocation 5 → 99 and restoring it.

P04 does not close this: it is pre-existing (migration `20260616164757`), and
shipping a read-only screen does not make an open API endpoint safe. Recorded in
PROGRESS as an open risk and as the fifth instance of ENGINEERING-WORKFLOW §5's
general law — a value with commercial consequences that the client can assert.
The fix is a column-scoped policy (or a SECURITY DEFINER writer for the handful
of fields a branch legitimately maintains), and it belongs in its own PR.

> **CLOSED 2026-08-03 / completed 2026-08-04.** REFACTOR 2/N (migration
> `20260803160517`) DROPPED the column-blind policy outright — it had no
> consumer. P05 (migration `20260804121655`) then restored the legitimate half
> as the SECURITY DEFINER writer this section predicted:
> `update_branch_profile` covers phone/whatsapp/address only, derives the
> branch from the caller, and audits to `branch_profile_history`. Allocation,
> hours, pin, rating and `is_active` have NO client write path of any kind —
> the product rule above is now enforced by construction.
