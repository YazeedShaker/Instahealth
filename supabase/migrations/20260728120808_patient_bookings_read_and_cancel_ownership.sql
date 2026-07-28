-- F07 — My Bookings. Two changes, both forced by how RLS and SECURITY DEFINER
-- interact: one closes a hole, the other works around a policy doing its job.

-- ═══ 1 · cancel_booking now AUTHORIZES the caller ═════════════════════════
-- It was SECURITY DEFINER, granted to `authenticated`, and matched on booking
-- id ALONE. SECURITY DEFINER bypasses RLS, so nothing stopped any signed-in
-- patient from cancelling any other patient's booking by id. Verified against
-- this database before the fix: patient B called it with patient A's booking
-- id and got {"success": true} — A's confirmed booking was cancelled and the
-- slot decremented. Same class as the confirm_booking hole closed in
-- 20260727111326: when a function bypasses RLS, the function IS the boundary.
--
-- Allowed callers: the owning patient · provider staff for that branch ·
-- admins · server-side callers (service_role, where auth.uid() IS NULL — the
-- abandoned-booking cleanup path relies on this).
CREATE OR REPLACE FUNCTION cancel_booking(p_booking_id UUID, p_reason TEXT, p_cancelled_by VARCHAR)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_booking     bookings;
  v_caller      UUID := auth.uid();
  v_may_cancel  BOOLEAN;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
  END IF;

  -- COALESCE is load-bearing: get_provider_branch_ids() returns NULL (not an
  -- empty array) for a non-provider, and `x = ANY(NULL)` is NULL — an
  -- un-COALESCEd OR chain would evaluate to NULL and fall through to ALLOW.
  v_may_cancel :=
       (v_caller IS NULL)                                                    -- service_role
    OR (v_booking.user_id = v_caller)                                        -- the patient
    OR COALESCE(v_booking.branch_id = ANY (get_provider_branch_ids()), FALSE)-- branch staff
    OR (get_user_role() = 'admin');

  IF NOT v_may_cancel THEN
    -- Deliberately indistinguishable from a missing row: never confirm to a
    -- stranger that a given booking id exists.
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
  END IF;

  IF v_booking.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_cancel', 'status', v_booking.status);
  END IF;

  IF v_booking.status = 'confirmed' THEN
    UPDATE slots SET booked_count = GREATEST(0, booked_count - 1) WHERE id = v_booking.slot_id;
  END IF;

  UPDATE bookings
     SET status = 'cancelled', cancellation_reason = p_reason, cancelled_by = p_cancelled_by,
         cancelled_at = NOW(), updated_at = NOW()
   WHERE id = p_booking_id;

  RETURN jsonb_build_object('success', true, 'booking_ref', v_booking.booking_ref);
END;
$$;

-- ═══ 2 · get_patient_bookings — the ONLY way the list/detail can read a slot ══
-- `slots` SELECT policy is (is_blocked = false AND booked_count < capacity), so
-- the moment a capacity-1 slot is confirmed its own booker can no longer read
-- it: `bookings → slots` returns NULL for exactly the bookings My Bookings is
-- built to show. Verified on this database. SECURITY DEFINER sees the row.
--
-- It takes NO user id — the filter is auth.uid() INSIDE the function. A
-- p_user_id parameter would reintroduce the cancel_booking hole verbatim.
CREATE OR REPLACE FUNCTION get_patient_bookings()
RETURNS TABLE (
  id                UUID,
  booking_ref       VARCHAR,
  status            VARCHAR,
  payment_status    VARCHAR,
  payment_method    VARCHAR,
  total_amount      NUMERIC,
  patient_notes     TEXT,
  created_at        TIMESTAMPTZ,
  cancelled_at      TIMESTAMPTZ,
  slot_date         DATE,
  slot_time         TIME,
  branch_id         UUID,
  branch_name_ar    VARCHAR,
  branch_address_ar TEXT,
  branch_lat        NUMERIC,
  branch_lng        NUMERIC,
  is_hospital       BOOLEAN,
  services          JSONB
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    b.id, b.booking_ref, b.status, b.payment_status, b.payment_method,
    b.total_amount, b.patient_notes, b.created_at, b.cancelled_at,
    s.slot_date, s.slot_time,
    br.id, br.name_ar, br.address_ar, br.lat, br.lng,
    -- Type badge is DERIVED from categories (ENGINEERING-WORKFLOW §7): any
    -- scan present → مستشفى, otherwise معمل تحاليل.
    COALESCE(bool_or(sc.slug = 'scans'), FALSE),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', sv.id,
          'nameAr', sv.name_ar,
          'nameEn', sv.name_en,
          'priceEgp', bsv.price_at_booking,
          'preparationNotesAr', sv.preparation_notes_ar,
          'preparationNotesEn', sv.preparation_notes_en
        ) ORDER BY sv.name_ar
      ) FILTER (WHERE sv.id IS NOT NULL),
      '[]'::jsonb
    )
  FROM bookings b
  JOIN slots    s  ON s.id  = b.slot_id
  JOIN branches br ON br.id = b.branch_id
  LEFT JOIN booking_services bsv ON bsv.booking_id = b.id
  LEFT JOIN branch_services  xbs ON xbs.id = bsv.branch_service_id
  LEFT JOIN services         sv  ON sv.id  = xbs.service_id
  LEFT JOIN service_categories sc ON sc.id = sv.category_id
  WHERE b.user_id = auth.uid()
    -- Abandoned/unpaid rows are flow debris, never a "booking" to the patient.
    AND b.status <> 'pending_payment'
  GROUP BY b.id, s.slot_date, s.slot_time, br.id
  ORDER BY s.slot_date DESC, s.slot_time DESC;
$$;

REVOKE ALL ON FUNCTION get_patient_bookings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_patient_bookings() TO authenticated, service_role;
