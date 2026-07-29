-- ═══════════════════════════════════════════════════════════════════════════
-- P02 — booking-detail drawer, cancel-on-behalf & upcoming days
--
-- Three changes, all of them found by verifying SPEC-P02's claims against this
-- database rather than assuming them.
--
-- 1 · SECURITY — `auth.uid() IS NULL` does NOT mean "service_role".
--     An anon-key caller with NO session ALSO has auth.uid() = NULL, and
--     cancel_booking was the one provider RPC that additionally granted
--     EXECUTE to anon/PUBLIC. PROVEN on dev before this migration: a plain
--     unauthenticated fetch carrying only the public anon key reached the
--     privileged branch — it came back `cannot_cancel` (the STATUS guard)
--     instead of `booking_not_found` (the AUTHORIZATION guard), i.e. it was
--     authorized to cancel any booking by id without logging in.
--
--     Measured INSIDE a SECURITY DEFINER function, per caller class:
--       anon key, no session -> uid NULL · auth.role() 'anon' · current_user postgres
--       pg_cron / direct SQL -> uid NULL · auth.role() NULL   · current_user postgres
--     So auth.uid() cannot separate them, and `current_user` is the function
--     OWNER inside a DEFINER body — never the caller — so it can NEVER serve as
--     an authorization signal here. auth.role() is the one that works.
--
--     This is the FOURTH function of this shape (confirm_booking in F06,
--     cancel_booking in F07, the two P01 functions). ENGINEERING-WORKFLOW §5.
--
-- 2 · INTEGRITY — cancel_booking wrote `p_cancelled_by` verbatim.
--     Nothing checked the caller was entitled to the label it claimed, so a
--     patient could record their own cancellation as 'provider'. That
--     discriminator is exactly what the dashboard reads to tell a desk
--     cancellation from a patient one, and what
--     DECISION-booking-outcome-lifecycle requires to stay honest forever.
--     The claim is now VERIFIED against the caller's real capacity rather than
--     overridden — so a receptionist who is also a patient at their own branch
--     is recorded correctly from either app, which a blind override would get
--     wrong in one direction or the other.
--
-- 3 · DATA — the drawer must show WHY a booking closed, and the read function
--     never returned closed_by / cancelled_by / cancellation_reason / slot_date.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · the caller-class predicate ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_internal_caller()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  -- 'service_role' → an Edge Function holding the service key.
  -- NULL           → no HTTP request context at all (pg_cron, psql, a
  --                  migration). Nothing untrusted can reach the database
  --                  except through PostgREST, and PostgREST always stamps a
  --                  role claim, so an absent claim means we are already inside.
  -- 'anon'         → an UNAUTHENTICATED stranger holding the public key. The
  --                  whole point of this function is that this is NOT us.
  SELECT COALESCE(auth.role(), 'internal') IN ('service_role', 'internal');
$$;

REVOKE ALL ON FUNCTION public.is_internal_caller() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_internal_caller() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_internal_caller() TO authenticated, service_role;

-- ── 2 · cancel_booking: real caller class + a verified discriminator ────────
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id uuid,
  p_reason text,
  p_cancelled_by character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_booking       bookings;
  v_caller        UUID    := auth.uid();
  v_is_internal   BOOLEAN := is_internal_caller();
  v_is_owner      BOOLEAN;
  v_is_staff      BOOLEAN;
  v_is_admin      BOOLEAN;
  v_is_privileged BOOLEAN;
  v_claimed       VARCHAR;
  v_starts_at     TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
  END IF;

  v_is_owner := (v_caller IS NOT NULL AND v_booking.user_id = v_caller);
  -- COALESCE is load-bearing: get_provider_branch_ids() returns NULL (not an
  -- empty array) for a non-provider, `x = ANY(NULL)` is NULL, and an
  -- un-COALESCEd OR chain evaluates to NULL — which `IF NOT (...)` treats as
  -- false and FALLS THROUGH TO ALLOW.
  v_is_staff := COALESCE(v_booking.branch_id = ANY (get_provider_branch_ids()), FALSE);
  v_is_admin := (get_user_role() = 'admin');
  v_is_privileged := v_is_internal OR v_is_staff OR v_is_admin;

  IF NOT (v_is_owner OR v_is_privileged) THEN
    -- Deliberately indistinguishable from a missing row: never confirm to a
    -- stranger that a given booking id exists.
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
  END IF;

  -- The discriminator is VERIFIED, not trusted. A label may only be claimed by
  -- a caller that actually holds that capacity. An internal caller acts for the
  -- system (the abandoned-booking cleanup cancels AS the patient) and may state
  -- any of them.
  v_claimed := COALESCE(
    NULLIF(p_cancelled_by, ''),
    CASE WHEN v_is_owner THEN 'patient' WHEN v_is_admin THEN 'admin' ELSE 'provider' END
  );

  IF NOT v_is_internal AND NOT (
       (v_claimed = 'patient'  AND v_is_owner)
    OR (v_claimed = 'provider' AND v_is_staff)
    OR (v_claimed = 'admin'    AND v_is_admin)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_canceller', 'claimed', v_claimed);
  END IF;

  IF v_booking.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_cancel', 'status', v_booking.status);
  END IF;

  -- Slots are Egypt WALL CLOCK (date + time, no zone); pin the comparison to
  -- Africa/Cairo or a server in another zone would move the boundary. The
  -- boundary is the PATIENT's alone — reception must be able to close out a
  -- past booking, and the abandoned-booking cleanup calls the same function.
  IF v_is_owner AND NOT v_is_privileged THEN
    SELECT (s.slot_date + s.slot_time) AT TIME ZONE 'Africa/Cairo'
      INTO v_starts_at
      FROM slots s WHERE s.id = v_booking.slot_id;

    IF v_starts_at IS NOT NULL AND v_starts_at <= NOW() THEN
      RETURN jsonb_build_object('success', false, 'error', 'slot_started', 'starts_at', v_starts_at);
    END IF;
  END IF;

  IF v_booking.status = 'confirmed' THEN
    UPDATE slots SET booked_count = GREATEST(0, booked_count - 1) WHERE id = v_booking.slot_id;
  END IF;

  UPDATE bookings
     SET status = 'cancelled', cancellation_reason = p_reason, cancelled_by = v_claimed,
         cancelled_at = NOW(), updated_at = NOW()
   WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true, 'booking_ref', v_booking.booking_ref, 'cancelled_by', v_claimed
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_booking(uuid, text, character varying) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_booking(uuid, text, character varying) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid, text, character varying)
  TO authenticated, service_role;

-- ── 3 · mark_booking_outcome: caller class + the future-day rule ────────────
CREATE OR REPLACE FUNCTION public.mark_booking_outcome(
  p_booking_id uuid,
  p_outcome character varying
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_booking   bookings;
  v_is_staff  BOOLEAN;
  v_legal     BOOLEAN;
  v_closer    VARCHAR;
  v_slot_date DATE;
BEGIN
  IF p_outcome NOT IN ('arrived', 'completed', 'no_show') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_outcome');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
  END IF;

  v_is_staff :=
       is_internal_caller()
    OR COALESCE(v_booking.branch_id = ANY (get_provider_branch_ids()), FALSE)
    OR (get_user_role() = 'admin');

  IF NOT v_is_staff THEN
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
  END IF;

  -- You cannot mark tomorrow's patient arrived. SPEC-P02 §B requires this to
  -- hold SERVER-side, not merely as a hidden button: the Upcoming Days view
  -- renders the same rows as Today, so the display predicate needs an
  -- enforcement predicate behind it (ENGINEERING-WORKFLOW §1.4). Cairo wall
  -- clock, for the same reason the cancel boundary is.
  SELECT s.slot_date INTO v_slot_date FROM slots s WHERE s.id = v_booking.slot_id;
  IF v_slot_date IS NOT NULL AND v_slot_date > (NOW() AT TIME ZONE 'Africa/Cairo')::date THEN
    RETURN jsonb_build_object(
      'success', false, 'error', 'slot_in_future', 'slot_date', v_slot_date
    );
  END IF;

  IF v_booking.status::text = p_outcome THEN
    RETURN jsonb_build_object('success', true, 'status', v_booking.status, 'unchanged', true);
  END IF;

  v_legal := CASE
    WHEN p_outcome = 'arrived'   THEN v_booking.status IN ('confirmed', 'pending_payment')
    WHEN p_outcome = 'completed' THEN v_booking.status = 'arrived'
    WHEN p_outcome = 'no_show'   THEN v_booking.status IN ('confirmed', 'pending_payment', 'arrived')
    ELSE FALSE
  END;

  IF NOT v_legal THEN
    RETURN jsonb_build_object('success', false, 'error', 'illegal_transition',
                              'from', v_booking.status, 'to', p_outcome);
  END IF;

  -- A human is on the other end of this RPC by construction: internal callers
  -- are the crons, and the auto-close cron does NOT come through here (it keeps
  -- its own write path precisely so 'system' stays distinguishable — see
  -- DECISION-booking-outcome-lifecycle).
  v_closer := CASE WHEN get_user_role() = 'admin' THEN 'admin' ELSE 'provider' END;

  UPDATE bookings
     SET status       = p_outcome,
         arrived_at   = CASE WHEN p_outcome = 'arrived'   THEN NOW() ELSE arrived_at   END,
         completed_at = CASE WHEN p_outcome = 'completed' THEN NOW() ELSE completed_at END,
         no_show_at   = CASE WHEN p_outcome = 'no_show'   THEN NOW() ELSE no_show_at   END,
         closed_by    = v_closer,
         payment_status = CASE
           WHEN p_outcome = 'completed' AND payment_status = 'cash' THEN 'paid'
           ELSE payment_status
         END,
         updated_at   = NOW()
   WHERE id = p_booking_id;

  IF p_outcome = 'completed' AND v_booking.payment_status = 'cash' THEN
    UPDATE payments SET status = 'completed', updated_at = NOW()
     WHERE booking_id = p_booking_id AND status = 'pending';
  END IF;

  RETURN jsonb_build_object('success', true, 'status', p_outcome, 'unchanged', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_booking_outcome(uuid, character varying) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_booking_outcome(uuid, character varying) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_booking_outcome(uuid, character varying)
  TO authenticated, service_role;

-- ── 4 · get_branch_bookings_for_date: the columns the drawer needs ──────────
-- DROP first: the RETURNS TABLE signature changes, and CREATE OR REPLACE
-- cannot alter a function's output columns.
DROP FUNCTION IF EXISTS public.get_branch_bookings_for_date(uuid, date);

CREATE FUNCTION public.get_branch_bookings_for_date(p_branch_id uuid, p_date date)
RETURNS TABLE(
  id uuid,
  booking_ref character varying,
  status character varying,
  payment_status character varying,
  payment_method character varying,
  total_amount numeric,
  patient_notes text,
  slot_id uuid,
  slot_date date,
  slot_time time without time zone,
  created_at timestamp with time zone,
  confirmed_at timestamp with time zone,
  arrived_at timestamp with time zone,
  completed_at timestamp with time zone,
  no_show_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancelled_by character varying,
  cancellation_reason text,
  closed_by character varying,
  patient_name_ar text,
  patient_phone text,
  services jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
       is_internal_caller()
    OR COALESCE(p_branch_id = ANY (get_provider_branch_ids()), FALSE)
    OR (get_user_role() = 'admin')
  ) THEN
    -- Not staff for this branch: zero rows, not an error. A patient calling
    -- this learns nothing about the branch's day.
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b.id, b.booking_ref, b.status, b.payment_status, b.payment_method,
    b.total_amount, b.patient_notes, b.slot_id, s.slot_date, s.slot_time,
    b.created_at, b.confirmed_at, b.arrived_at, b.completed_at, b.no_show_at,
    -- closed_by carries the auto-close discriminator: 'system' means the
    -- nightly job guessed, not that anyone at the desk decided. The drawer
    -- renders it as «أُغلق تلقائياً» so the desk understands why a booking
    -- closed itself (DECISION-booking-outcome-lifecycle §Consequences).
    b.cancelled_at, b.cancelled_by, b.cancellation_reason, b.closed_by,
    u.name_ar::TEXT, u.phone::TEXT,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', sv.id, 'nameAr', sv.name_ar, 'nameEn', sv.name_en,
          'priceEgp', bsv.price_at_booking,
          'preparationNotesAr', sv.preparation_notes_ar,
          'preparationNotesEn', sv.preparation_notes_en
        ) ORDER BY sv.name_ar
      ) FILTER (WHERE sv.id IS NOT NULL),
      '[]'::jsonb
    )
  FROM bookings b
  JOIN slots s ON s.id = b.slot_id
  LEFT JOIN users u ON u.id = b.user_id
  LEFT JOIN booking_services bsv ON bsv.booking_id = b.id
  LEFT JOIN branch_services  xbs ON xbs.id = bsv.branch_service_id
  LEFT JOIN services         sv  ON sv.id  = xbs.service_id
  WHERE b.branch_id = p_branch_id
    AND s.slot_date = p_date
    -- Abandoned checkout rows are flow debris, never a booking the desk acts
    -- on. Cancellations DO show: the desk must see them, not have rows vanish.
    AND b.status <> 'pending_payment'
  GROUP BY b.id, s.slot_date, s.slot_time, u.name_ar, u.phone
  ORDER BY s.slot_time;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_branch_bookings_for_date(uuid, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_branch_bookings_for_date(uuid, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_branch_bookings_for_date(uuid, date)
  TO authenticated, service_role;

-- ── 5 · adjacent grant sweep ───────────────────────────────────────────────
-- Same shape as the hole above, found by the same audit: two maintenance
-- functions were callable by anon/PUBLIC. Their only callers are the
-- `cleanup-holds` and `generate-slots` Edge Functions, which hold the service
-- key, so revoking costs nothing. confirm_booking and auto_close_stale_bookings
-- were already locked down this way; these two were missed.
REVOKE ALL ON FUNCTION public.cleanup_expired_holds() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_holds() FROM anon;
REVOKE ALL ON FUNCTION public.cleanup_expired_holds() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_holds() TO service_role;

REVOKE ALL ON FUNCTION public.generate_branch_slots(uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_branch_slots(uuid, date, date) FROM anon;
REVOKE ALL ON FUNCTION public.generate_branch_slots(uuid, date, date) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.generate_branch_slots(uuid, date, date) TO service_role;
