-- ============================================================
-- F08 follow-up — `reviews.booking_id` must CASCADE on delete.
--
-- ⚠ THIS BROKE CI THE MOMENT THE FIRST REAL REVIEW EXISTED, and it broke the
-- one thing every other web test depends on:
--
--   psql:supabase/seeds/004_dashboard_e2e_fixtures.sql:180: ERROR:
--   update or delete on table "bookings" violates foreign key constraint
--   "reviews_booking_id_fkey" on table "reviews"
--
-- `004_dashboard_e2e_fixtures.sql` RESETS the day rather than appending (§9 —
-- it exists because an appending seed let the day drain and nine tests began
-- skipping). Resetting means DELETING bookings. `reviews.booking_id` was
-- declared `REFERENCES bookings(id)` with no ON DELETE clause back in the
-- original create_tables migration, which defaults to NO ACTION — so a booking
-- carrying a review cannot be deleted, the seed aborts, and the ENTIRE E2E job
-- fails before a single test runs.
--
-- ⚠ THE CONSTRAINT IS OLDER THAN F08; WHAT F08 CHANGED IS THAT `reviews` IS NO
-- LONGER EMPTY. It was unreachable dead weight until the feature that populates
-- the table shipped. Same shape as the admin policies A01 switched on: a
-- latent flaw that only becomes real when something finally writes.
--
-- CASCADE is the correct semantics, not merely the convenient one: a review is
-- ABOUT a booking and has no meaning without it — the eligibility rule, the
-- branch, the service and the display name are all derived from that booking.
-- And `recalculate_branch_rating()` already fires `AFTER ... DELETE`, so a
-- cascaded removal recomputes `branches.rating` / `review_count` correctly
-- rather than leaving the aggregate counting a row that no longer exists.
-- ============================================================

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_booking_id_fkey;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_booking_id_fkey
  FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;
