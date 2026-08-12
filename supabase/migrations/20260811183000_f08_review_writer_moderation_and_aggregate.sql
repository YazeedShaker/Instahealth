-- ============================================================
-- F08 — Reviews: the write path, moderation, and the aggregate that has to
-- agree with it.
--
-- ⚠ WHAT THE AUDIT FOUND, because three of the spec's premises were wrong and
-- the fourth was wrong in our favour:
--
--  ① «`reviews` still carries patient INSERT/UPDATE policies that are
--     COLUMN-BLIND» — IT DOES NOT. They were dropped on 2026-08-03 in migration
--     20260803160517 along with four siblings. `reviews` has exactly ONE policy
--     today, a SELECT. So there is no door to close here; there is no door at
--     all, for anyone. Nothing in this migration adds one.
--  ② «`reviews` has NO admin write policy» — TRUE, and it stays that way. The
--     moderation path is a SECURITY DEFINER writer, not a policy.
--  ③ The aggregate trigger the spec asks for ALREADY EXISTS
--     (`recalculate_branch_rating`, on INSERT/UPDATE/DELETE) — but it is
--     SECURITY INVOKER with no pinned search_path, which means it only works
--     because every future writer will be DEFINER-owned. Hardened below rather
--     than rebuilt.
--  ④ The spec's «published/hidden flag» and the composed display name had no
--     column to live in. §5a②: a state is not real until a column holds it.
--
-- ⚠ THE HIDE SWITCH IS `is_flagged`, AND THERE IS DELIBERATELY NO SECOND
-- BOOLEAN. `published ≡ is_flagged = FALSE`. Two columns that must agree is
-- "the single most repeated mistake in this schema" (CLAUDE.md §8), and the two
-- consumers that already exist — the SELECT policy and the aggregate trigger —
-- both key off `is_flagged` and already agree with each other. v1 ships no
-- patient flagging UI (bundle annotation: v2), so this column has exactly ONE
-- writer: the admin moderation function below.
-- ⚠ IF v2 ADDS PATIENT REPORTING, "reported" NEEDS ITS OWN COLUMN. Do not
-- overload this one — a patient-set flag and an admin-set hide are different
-- facts, and merging them is how the aggregate starts lying.
-- ============================================================

-- ── ① The composed display name — a column, because the promise is stored ───
-- The frame tells the patient exactly how their name will appear. A live join
-- to `users.name_ar` would let a later profile edit silently rewrite a review
-- that was published under a different name, so the promise is MATERIALISED at
-- insert and never recomputed.
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS display_name TEXT;

COMMENT ON COLUMN public.reviews.display_name IS
  'The name shown with the review, composed server-side at insert from users.name_ar (first name + family initial). Never recomputed: the prompt states exactly how the name will appear, and the stored value is that promise.';

-- ── ② The moderation audit trail ────────────────────────────────────────────
-- Same shape as `admin_booking_history`: an action, a reason, who and when.
CREATE TABLE IF NOT EXISTS public.review_moderation_history (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  review_id   UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  action      TEXT NOT NULL CHECK (action IN ('hidden', 'restored')),
  reason_code TEXT,
  reason_note TEXT,
  changed_by  UUID,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_moderation_history_review
  ON public.review_moderation_history (review_id, changed_at DESC);

ALTER TABLE public.review_moderation_history ENABLE ROW LEVEL SECURITY;

-- Admins read it; nobody writes it except the DEFINER function below.
DROP POLICY IF EXISTS "review moderation history: admin read" ON public.review_moderation_history;
CREATE POLICY "review moderation history: admin read"
  ON public.review_moderation_history FOR SELECT
  USING (public.get_user_role() = 'admin');

-- ⚠ A grant is a ceiling a policy can never raise. No client writes this table.
REVOKE INSERT, UPDATE, DELETE ON public.review_moderation_history FROM anon, authenticated;

-- ── ③ Close the grant on `reviews` ──────────────────────────────────────────
-- ⚠ THE POLICIES ARE GONE BUT THE GRANTS ARE NOT. `anon` and `authenticated`
-- both still hold INSERT and UPDATE on EVERY column of `reviews` — including
-- `is_flagged`, `is_verified` and `rating`. RLS is the only thing refusing them
-- today, which means one permissive policy added by a future session reopens
-- every column at once. That is precisely the shape `notifications` was in
-- (PROGRESS, 2026-08-10) and the reason `users` was narrowed by GRANT rather
-- than by policy. Writes go through the two functions below; nothing else needs
-- the grant.
REVOKE INSERT, UPDATE ON public.reviews FROM anon, authenticated;

-- ── ④ Harden the aggregate ──────────────────────────────────────────────────
-- Was SECURITY INVOKER with a mutable search_path. As INVOKER its
-- `UPDATE branches` is subject to the caller's RLS, and no patient has an
-- UPDATE policy on `branches` — so the update would silently touch ZERO rows
-- and the aggregate would never move, with no error anywhere. It works today
-- only by the accident that nothing writes reviews at all. Made DEFINER and
-- pinned, so it is correct by construction rather than by luck.
--
-- ⚠ COUNTS PUBLISHED ONLY — `is_flagged = FALSE` — on INSERT, UPDATE and
-- DELETE, so hiding and restoring both move the aggregate immediately. AVG over
-- zero rows is NULL, which is the honest value for "no reviews yet": the branch
-- profile keys its zero state on `review_count`, never on `rating`, because a
-- rating of 0.00 and a rating of "none" must not look the same.
CREATE OR REPLACE FUNCTION public.recalculate_branch_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE branches SET
    rating = (
      SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM reviews
       WHERE branch_id = COALESCE(NEW.branch_id, OLD.branch_id) AND is_flagged = FALSE
    ),
    review_count = (
      SELECT COUNT(*) FROM reviews
       WHERE branch_id = COALESCE(NEW.branch_id, OLD.branch_id) AND is_flagged = FALSE
    )
  WHERE id = COALESCE(NEW.branch_id, OLD.branch_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ⚠ AND REVOKE ITS INHERITED PUBLIC GRANT. Making it DEFINER without this would
-- have LEFT IT WORSE than it was: a SECURITY DEFINER function reachable with the
-- public anon key is the exact `confirm_booking` shape (§5), and it carried
-- `PUBLIC,anon` from the day it was created because Postgres grants EXECUTE to
-- PUBLIC by default. Calling a trigger function directly raises on an unassigned
-- NEW/OLD, so it was never exploitable — but "assume nothing" is the rule, and a
-- hardening step that opens a second hole is not a hardening step.
REVOKE ALL ON FUNCTION public.recalculate_branch_rating() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_branch_rating() TO service_role;

-- ── ⑤ The display-name rule, as a function so one spelling exists ───────────
-- «أحمد م.» — first name, then the initial of the family name with a full stop.
-- A single-word name is returned as-is; an empty or NULL name falls back to the
-- frame's «مريض» rather than rendering a blank byline.
CREATE OR REPLACE FUNCTION public.compose_review_display_name(p_full_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_clean  TEXT;
  v_parts  TEXT[];
BEGIN
  v_clean := BTRIM(COALESCE(p_full_name, ''));
  IF v_clean = '' THEN RETURN 'مريض'; END IF;

  v_parts := regexp_split_to_array(v_clean, '\s+');
  IF array_length(v_parts, 1) = 1 THEN RETURN v_parts[1]; END IF;

  -- ⚠ The LAST part is the family name, and only its first CHARACTER is kept —
  -- `LEFT(..., 1)` on a text value is character-wise, not byte-wise, so Arabic
  -- survives it. Anything more would be identifying.
  RETURN v_parts[1] || ' ' || LEFT(v_parts[array_length(v_parts, 1)], 1) || '.';
END;
$$;

-- ── ⑥ The review writer ─────────────────────────────────────────────────────
-- Follows `update_branch_service` / `admin_*`: SECURITY DEFINER, its own
-- authorization check, every consequential value DERIVED from `auth.uid()`.
--
-- ⚠ IT TAKES NO USER ID, AND NO BRANCH ID. Both come from the booking, which
-- comes from `auth.uid()`. §5's law: prefer deleting the parameter to
-- validating it — with no channel to carry the lie, impersonation is impossible
-- by construction. The client supplies an identity (its session) and two
-- values it is entitled to assert (its own rating and its own words); it
-- supplies nothing else.
--
-- ⚠ `is_verified` and `is_flagged` are SET HERE, not accepted. Every review
-- written through this path is by definition from a patient who completed a
-- real visit — that IS the verification, and it is why the frame can promise
-- «كل تقييم من مريض أكمل زيارة فعلاً في هذا الفرع».
CREATE OR REPLACE FUNCTION public.submit_review(
  p_booking_id UUID,
  p_rating     INTEGER,
  p_comment    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller    UUID := auth.uid();
  v_booking   RECORD;
  v_name      TEXT;
  v_review_id UUID;
  v_comment   TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_rating');
  END IF;

  -- ⚠ OWNERSHIP AND STATUS IN ONE LOOKUP, matched on the CALLER — not on the
  -- booking id alone. Matching on id alone is the `cancel_booking` hole (§5):
  -- any signed-in patient could review any booking by guessing a UUID.
  SELECT b.id, b.user_id, b.branch_id, b.status
    INTO v_booking
    FROM bookings b
   WHERE b.id = p_booking_id AND b.user_id = v_caller;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_found');
  END IF;

  -- `completed` is human-marked by definition (DECISION-booking-outcome-
  -- lifecycle: a system close goes to no_show), so completed implies a real
  -- visit someone at the desk witnessed. Nothing else is eligible.
  IF v_booking.status <> 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'booking_not_completed');
  END IF;

  IF EXISTS (SELECT 1 FROM reviews r WHERE r.booking_id = p_booking_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_reviewed');
  END IF;

  -- Stars-only is a first-class case per the frames: an empty comment is NULL,
  -- not an empty string, so "no comment" has one representation.
  v_comment := NULLIF(BTRIM(COALESCE(p_comment, '')), '');

  -- ⚠ THE LENGTH CAP IS ENFORCED HERE TOO, not only in Zod. `reviewSchema`
  -- carries REVIEW_COMMENT_MAX_LENGTH = 500 and a modified client simply does
  -- not run it — "all input validated at the boundary" (CLAUDE.md §8) means the
  -- boundary that cannot be skipped. 500 matches core; if one moves, both move.
  IF v_comment IS NOT NULL AND LENGTH(v_comment) > 500 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'comment_too_long');
  END IF;

  SELECT compose_review_display_name(u.name_ar) INTO v_name
    FROM users u WHERE u.id = v_caller;

  INSERT INTO reviews (booking_id, user_id, branch_id, rating, comment,
                       display_name, is_verified, is_flagged)
  VALUES (p_booking_id, v_caller, v_booking.branch_id, p_rating, v_comment,
          COALESCE(v_name, 'مريض'), TRUE, FALSE)
  RETURNING id INTO v_review_id;

  RETURN jsonb_build_object(
    'ok', true,
    'review_id', v_review_id,
    'display_name', COALESCE(v_name, 'مريض')
  );
END;
$$;

-- ── ⑦ The patient's own review, hidden or not ───────────────────────────────
-- ⚠ WITHOUT THIS THE PROMPT LIES. The SELECT policy hides flagged rows from
-- everyone but an admin, so a patient whose review was moderated would see the
-- prompt offered to them again — and the UNIQUE(booking_id) constraint would
-- refuse the submission. The screen must decide on the same fact the database
-- enforces (§1.4), so it reads its OWN review through a function that can see
-- it. Takes no user id; filters on `auth.uid()` inside (§5).
CREATE OR REPLACE FUNCTION public.get_my_review(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_row    RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT r.id, r.rating, r.comment, r.display_name, r.is_flagged, r.created_at
    INTO v_row
    FROM reviews r
   WHERE r.booking_id = p_booking_id AND r.user_id = v_caller;

  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;

  RETURN jsonb_build_object(
    'found', true,
    'review_id', v_row.id,
    'rating', v_row.rating,
    'comment', v_row.comment,
    'display_name', v_row.display_name,
    -- The author is NOT told their review was hidden (v1 truth, SPEC-F08 §A.3);
    -- the client needs the fact only to keep the prompt from reappearing.
    'is_published', NOT v_row.is_flagged,
    'created_at', v_row.created_at
  );
END;
$$;

-- ── ⑧ The admin moderation writer ───────────────────────────────────────────
-- The last open policy gap in the schema: an admin could READ a flagged review
-- and had no way to un-flag it. Moderation had no path — unreachable by
-- ACCIDENT rather than by design. This closes it as a writer, not a policy.
CREATE OR REPLACE FUNCTION public.admin_set_review_hidden(
  p_review_id   UUID,
  p_hidden      BOOLEAN,
  p_reason_code TEXT DEFAULT NULL,
  p_reason_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_before BOOLEAN;
BEGIN
  -- ⚠ ITS OWN AUTHORIZATION CHECK. RLS does not protect a DEFINER function —
  -- the body IS the boundary (§5).
  IF v_caller IS NULL OR get_user_role() <> 'admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF p_hidden IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_state');
  END IF;

  SELECT r.is_flagged INTO v_before FROM reviews r WHERE r.id = p_review_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'review_not_found');
  END IF;

  -- Idempotent: re-hiding an already-hidden review is a success that writes
  -- nothing, so a double-click cannot produce two audit rows for one decision.
  IF v_before = p_hidden THEN
    RETURN jsonb_build_object('ok', true, 'unchanged', true, 'is_published', NOT p_hidden);
  END IF;

  UPDATE reviews SET is_flagged = p_hidden, updated_at = NOW()
   WHERE id = p_review_id;

  -- ⚠ `changed_by` is DERIVED, never passed in. A discriminator the client
  -- supplies is not a discriminator (§5).
  INSERT INTO review_moderation_history (review_id, action, reason_code, reason_note, changed_by)
  VALUES (p_review_id,
          CASE WHEN p_hidden THEN 'hidden' ELSE 'restored' END,
          NULLIF(BTRIM(COALESCE(p_reason_code, '')), ''),
          NULLIF(BTRIM(COALESCE(p_reason_note, '')), ''),
          v_caller);

  RETURN jsonb_build_object('ok', true, 'unchanged', false, 'is_published', NOT p_hidden);
END;
$$;

-- ── ⑨ Grants ────────────────────────────────────────────────────────────────
-- ⚠ Postgres grants EXECUTE to PUBLIC by default, so a new SECURITY DEFINER
-- function is callable by the anon key the moment it exists (§5 — this is how
-- `confirm_booking` was reachable from the app for four features). REVOKE
-- first, then grant deliberately, matching the established
-- {postgres, authenticated, service_role} shape.
REVOKE ALL ON FUNCTION public.submit_review(UUID, INTEGER, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_review(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_review_hidden(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.compose_review_display_name(TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.submit_review(UUID, INTEGER, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_review(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_review_hidden(UUID, BOOLEAN, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compose_review_display_name(TEXT) TO authenticated, service_role;
