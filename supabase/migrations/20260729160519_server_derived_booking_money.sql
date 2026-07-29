-- ═══════════════════════════════════════════════════════════════════════════
-- Booking creation becomes server-derived. MONEY INTEGRITY — no feature work.
--
-- Until now the patient app INSERTed `bookings` and `booking_services`
-- directly, and the only INSERT policy on either table checked that the
-- booking belonged to the caller. It never checked what the caller was
-- claiming to PAY.
--
-- PROVEN on dev before this migration (probe rows deleted afterwards):
--   booking insert: CREATED IH-2026-21236   total_amount = 1
--   line insert   : ACCEPTED at 1 EGP       real branch_services.price = 400
-- i.e. a patient could book a 400 EGP service for 1 EGP. No real money has
-- moved because payments are still simulated by MockPaymentProvider — this is
-- closed BEFORE PayTabs goes live, not after.
--
-- The same missing guard meant an is_available = false service could still be
-- booked (mobile filters it in JavaScript only), and nothing tied a
-- booking_service to the booking's own BRANCH: the FK references
-- branch_services(id) with no branch correlation, so branch A's service could
-- be attached to a booking at branch B.
--
-- THE RULE (ENGINEERING-WORKFLOW §5): the client supplies IDENTITIES; the
-- server derives VALUES. Third instance of this law after confirm_booking's
-- grants and cancel_booking's cancelled_by.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_pending_booking(
  p_slot_id uuid,
  p_branch_service_ids uuid[],
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller     UUID := auth.uid();
  v_slot       slots;
  v_branch     branches;
  v_provider   providers;
  v_total      NUMERIC := 0;
  v_count      INT;
  v_booking_id UUID;
  v_ref        VARCHAR;
  v_notes      TEXT;
  v_lines      JSONB;
BEGIN
  -- A booking belongs to a signed-in patient. `auth.uid() IS NULL` is anon OR
  -- an internal caller; neither creates a patient booking, and treating NULL
  -- as trusted is the exact mistake cancel_booking made.
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF p_branch_service_ids IS NULL OR array_length(p_branch_service_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_services');
  END IF;

  SELECT * INTO v_slot FROM slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_not_found');
  END IF;
  IF COALESCE(v_slot.is_blocked, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_blocked');
  END IF;
  IF COALESCE(v_slot.booked_count, 0) >= COALESCE(v_slot.capacity, 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_full');
  END IF;

  -- The slot must be HELD by this caller. The hold is what reserves capacity
  -- between picking a time and paying for it; without this check a patient
  -- could create bookings on slots they never held.
  IF NOT EXISTS (
    SELECT 1 FROM slot_holds h
     WHERE h.slot_id = p_slot_id AND h.user_id = v_caller AND h.expires_at > NOW()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_active_hold');
  END IF;

  SELECT * INTO v_branch FROM branches WHERE id = v_slot.branch_id;
  IF NOT FOUND OR NOT COALESCE(v_branch.is_active, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'branch_unavailable');
  END IF;

  SELECT * INTO v_provider FROM providers WHERE id = v_branch.provider_id;
  IF NOT FOUND OR NOT COALESCE(v_provider.is_active, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'provider_unavailable');
  END IF;

  -- Every requested line must be bookable AT THIS BRANCH. The count check is
  -- what closes the cross-branch hole: a branch_service belonging to another
  -- branch simply does not match, so the count comes up short and nothing is
  -- written. Duplicate ids collapse via DISTINCT, so a repeated id cannot
  -- inflate the total either.
  SELECT COUNT(DISTINCT bs.id), COALESCE(SUM(bs.price), 0)
    INTO v_count, v_total
    FROM branch_services bs
    JOIN services s ON s.id = bs.service_id
   WHERE bs.id = ANY (p_branch_service_ids)
     AND bs.branch_id = v_slot.branch_id
     AND COALESCE(bs.is_available, FALSE)
     AND COALESCE(s.is_active, FALSE);

  IF v_count <> (SELECT COUNT(DISTINCT x) FROM unnest(p_branch_service_ids) AS x) THEN
    -- Deliberately one error for "not yours / not here / not active": the app
    -- re-fetches the branch either way, and distinguishing them would tell a
    -- caller which branch a service id belongs to.
    RETURN jsonb_build_object('success', false, 'error', 'service_unavailable');
  END IF;

  v_notes := NULLIF(BTRIM(COALESCE(p_notes, '')), '');

  -- total_amount is DERIVED. The client's displayed total is advisory: if a
  -- price moved mid-session the server's number wins and the app re-renders.
  INSERT INTO bookings (user_id, branch_id, slot_id, status, total_amount, patient_notes)
  VALUES (v_caller, v_slot.branch_id, p_slot_id, 'pending_payment', v_total, v_notes)
  RETURNING id, booking_ref INTO v_booking_id, v_ref;

  INSERT INTO booking_services (booking_id, branch_service_id, price_at_booking, quantity)
  SELECT DISTINCT v_booking_id, bs.id, bs.price, 1
    FROM branch_services bs
   WHERE bs.id = ANY (p_branch_service_ids)
     AND bs.branch_id = v_slot.branch_id;

  SELECT jsonb_agg(jsonb_build_object('branchServiceId', bsv.branch_service_id,
                                      'priceEgp', bsv.price_at_booking))
    INTO v_lines
    FROM booking_services bsv WHERE bsv.booking_id = v_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'booking_ref', v_ref,
    'total_egp', v_total,
    'lines', COALESCE(v_lines, '[]'::jsonb)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_pending_booking(uuid, uuid[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_pending_booking(uuid, uuid[], text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_pending_booking(uuid, uuid[], text)
  TO authenticated, service_role;

-- ── Close the door, not just open a new one ────────────────────────────────
-- An RPC beside an open INSERT policy is decoration: the old path stays
-- reachable and every guard above is optional. The RPC is SECURITY DEFINER and
-- bypasses RLS, so it does not need these policies to do its work.
DROP POLICY IF EXISTS "bookings: patient creates own" ON public.bookings;
DROP POLICY IF EXISTS "booking_services: patient inserts own" ON public.booking_services;
