# SPEC · F08 — Reviews: Submission, Display & Minimal Moderation (Mobile + tiny Admin)

> Read: root docs, docs/CHECKLIST.md, PROGRESS, DECISION-booking-outcome-lifecycle (completed
> = human-marked; system-closed is a guess), the Reviews Display Addendum frames in
> design/handoff/ (3 mobile frames incl. the new-branch zero state), and the reviews schema.
> ⚠ FIRST STEP: audit what exists — F08 was once reported "done" with no spec; reconcile any
> partial build against this spec before writing code, and report the delta. One PR.

## Goal

The trust loop closes: a patient who actually completed a visit rates it once; the branch
profile shows honest aggregates and reviews per the approved addendum — including the
zero-state that refuses to fake a star; admins can hide abuse. Last feature spec of v1.

## A · Data, eligibility & aggregates — **Tier 1**

1. **Eligibility, server-enforced (RLS + constraint, not UI):** insert allowed only by the
   booking's owner, only when its status is `completed` (human-marked by definition — the
   lifecycle decision means system closes go to no_show, so completed implies a real visit),
   exactly once per booking (UNIQUE booking_id). Rating 1–5 required; comment optional
   (stars-only is a first-class case per the frames).
2. **Aggregates are server-computed:** `branches.rating` / `review_count` (admin-write-blocked
   columns by construction — correct) get a DEFINER trigger/function recomputing on review
   insert/hide/restore, counting **published only**. Never client-written, never stale after
   moderation.
3. **Minimal moderation:** a published/hidden flag + an admin hide/restore writer per the
   standing pattern (role check, audit row with reason). **The moderation QUEUE screen stays
   v2 per the design annotation** — v1 surfaces the action in the A06 booking drawer: a
   completed booking's review renders there (stars, text, published state) with hide/restore.
   Hidden reviews vanish from patient surfaces and aggregates immediately; the author isn't
   notified (v1 truth, note it).
4. Display-name rule per the frame: first name + family initial, composed server-side into
   the review row at insert (the prompt states exactly how the name appears — the stored
   value must match the promise; no live joins to the mutable profile).

## B · Mobile screens — **Tier 2** (per the addendum frames, component contract)

1. **Prompt:** on a completed booking (bookings list/detail entry point per frames): stars,
   optional comment, the name-preview line, submit once → thanks state; already-reviewed
   bookings show the given rating instead of the prompt.
2. **Branch profile section:** average + count + distribution bars, the verified line
   («كل تقييم من مريض أكمل زيارة فعلاً في هذا الفرع»), three recent (stars-only rendered per
   frame), «كل التقييمات (N)» → full list screen (paginated, newest first).
3. **The zero state, exactly as approved:** new branch → no fake stars, the honest copy, the
   provider's OTHER branches' reviews shown clearly labeled and **excluded from this
   branch's average**. Provider-level other-branch section per frame C.
4. Empty/loading states; RTL; hidden reviews simply absent (empty means absent).

## Tests

**Node (Tier 1):** eligibility matrix — not-completed / not-owner / second attempt /
no_show / system-closed / cancelled all rejected at the database; aggregate correctness on
insert → hide → restore (published-only counting proven); name composition; non-admin denied
the moderation writer; hidden absent from patient reads.
**Maestro:** complete a fixture booking → prompt appears → submit stars-only → branch
profile average/count update → review visible; second visit to the prompt shows given
rating; new-branch zero state renders with other-branches labeled.
**Playwright (tiny):** A06 drawer shows the review; hide → restore round-trip.
**Manual (weekly batch):** one real review from your device end-to-end.

## What NOT to do

No moderation queue screen (v2). No partner replies, photos, or flagging UI (v2 per
bundle annotations). No edit/delete by the patient (v1: immutable once submitted — note in
the prompt's copy). No review prompts by push/SMS. No provider-portal review surfaces.

## When done

PROGRESS: **v1 feature set COMPLETE.** Closing note: the remaining board is hardening +
data + externals only (fidelity batch if not yet merged, EAS + auto-publish, real rates,
real prices, Saridar data, pilot prep). Hand the founders the sentence: the software is
done; the pilot date is now a business decision.
