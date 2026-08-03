-- ═══════════════════════════════════════════════════════════════════════════
-- CLOSE THE CLIENT WRITE SURFACE.
--
-- The authorization sweep (`pnpm authz:check`) enumerated SEVEN
-- client-reachable write policies across FIVE tables, every one COLUMN-BLIND.
-- An RLS policy scopes ROWS; it says nothing about COLUMNS, and Supabase grants
-- every column to anon/authenticated by default. So wherever a write policy
-- matched, the whole row was writable:
--
--   bookings  → total_amount, payment_status, commission_amount/rate, user_id
--   slots     → capacity, booked_count, is_blocked
--   branches  → rating, review_count, instahealth_slot_allocation, is_active
--   reviews   → is_verified, is_flagged, rating
--   users     → phone (the OTP identity), id
--
-- A partner could mark their own bookings paid or zero the commission on them;
-- raise their own slot capacity and manufacture allocation the agreement never
-- granted; set their own rating. A patient could clear is_flagged on their own
-- moderated review. Sixth instance of the ENGINEERING-WORKFLOW §5 general law.
--
-- ⚠ FIVE OF THE SEVEN HAVE NO CONSUMER AT ALL. Verified by searching every
-- write call in apps/ packages/ supabase/functions/: nothing writes bookings,
-- slots, branches or reviews from a client. Every real write already goes
-- through a SECURITY DEFINER function (mark_booking_outcome, cancel_booking,
-- confirm_booking, create_pending_booking, update_branch_service,
-- generate_branch_slots) or through an Edge Function on the service role, which
-- bypasses RLS entirely. Those five policies were pure attack surface.
--
-- ⚠ THE TWO `users` POLICIES ARE LOAD-BEARING and are KEPT, then narrowed by
-- COLUMN GRANT. `ensureProfile` inserts the patient's own row on first sign-in
-- (there is deliberately no trigger for phone signups) and `updateProfileName`
-- sets name_ar. RLS cannot restrict columns — column-level GRANTs are the only
-- mechanism that can, which is why the sweep records them.
--
-- ⚠ AND THAT IS WHY THE SEARCH HAD TO BE MULTILINE. A first pass grepped for
-- `.from('users')` and `.update(` on the SAME line and found nothing, which
-- would have concluded "no consumers, drop everything" and broken sign-in. The
-- calls are chained across lines. Verify a consumer before removing its door.
--
-- WHAT REPLACES THE DROPPED POLICIES: nothing, until a feature needs it, and
-- then a writer function in the `update_branch_service` shape — membership check
-- first, validation server-side, audit row, no client policy (CLAUDE.md §8).
-- P05 will need `update_branch_profile`; F09 will need a review writer.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Five policies with no consumer ──────────────────────────────────────
DROP POLICY IF EXISTS "bookings: provider updates status" ON public.bookings;
DROP POLICY IF EXISTS "slots: provider updates own"       ON public.slots;
DROP POLICY IF EXISTS "branches: provider updates own branches" ON public.branches;
DROP POLICY IF EXISTS "reviews: patient inserts own"      ON public.reviews;
DROP POLICY IF EXISTS "reviews: patient updates own"      ON public.reviews;

-- ── 2 · `users`: keep the policies, narrow the columns ──────────────────────
-- anon is never a patient — `id = auth.uid()` is NULL for it, so these grants
-- were unreachable, but an unreachable grant is still a grant.
REVOKE INSERT, UPDATE, DELETE ON public.users FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.users FROM authenticated;

-- First sign-in creates the row: id (must equal auth.uid(), enforced by the
-- INSERT policy's WITH CHECK) and phone (the number that just passed OTP).
GRANT INSERT (id, phone) ON public.users TO authenticated;

-- What a patient may later change about themselves. `phone` is ABSENT on
-- purpose: it is the OTP identity, so changing it is an auth operation, not a
-- profile edit. `id`, `email` and the timestamps are absent for the same
-- reason — they are not the patient's to assert.
GRANT UPDATE (name_ar, name_en, date_of_birth, gender, preferred_language, sms_reminders)
  ON public.users TO authenticated;
