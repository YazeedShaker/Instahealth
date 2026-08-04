-- ═══════════════════════════════════════════════════════════════════════════
-- PROF-01 — account deletion prerequisite: the tombstone must outlive the login.
--
-- `users.id` carried `REFERENCES auth.users(id) ON DELETE CASCADE`, which made
-- the ratified deletion semantics (SPEC-PROF-01) impossible: deleting the auth
-- user would cascade-delete the anonymized public.users row — and then FAIL
-- anyway, because bookings/reviews/notifications reference users with NO
-- ACTION. The financial-trail law (bookings/payments STAY; the person is
-- scrubbed) requires the users row to survive its login.
--
-- So the FK to auth.users is DROPPED, not weakened: any delete rule breaks one
-- side — CASCADE destroys the tombstone, NO ACTION blocks the auth deletion.
-- Creation-side integrity is untouched: the ONLY insert path is the RLS policy
-- "users: patient inserts own row" (WITH CHECK id = auth.uid()), so a users
-- row is always born pointing at a real, live auth user. After deletion it
-- deliberately points at nothing — that is the tombstone.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.users DROP CONSTRAINT users_id_fkey;
