-- F07, part 2 — the RATIFIED cancellation policy, enforced server-side.
--
-- SPEC-F07 supersedes the design bundle: a patient may cancel ANY TIME BEFORE
-- THE SLOT STARTS, free, no fees, for every payment method. The design's
-- "قبل الموعد بـ ٤ ساعات" copy is outdated and the app no longer says it.
-- There is deliberately NO cancellation-fee logic anywhere in the stack.
--
-- Display predicate = enforcement predicate (ENGINEERING-WORKFLOW §1.4): the
-- app hides the cancel button once the slot has started, so the server must
-- refuse it there too — otherwise the two could drift.
--
-- The boundary applies to the PATIENT only. Provider staff, admins and
-- service_role keep cancelling past bookings: reception has to be able to
-- close out a no-show, and the abandoned-booking cleanup path
-- (features/booking/cleanup.ts → cancel_booking) must never start failing
-- because a slot ticked over mid-flow.
CREATE OR REPLACE FUNCTION cancel_booking(p_booking_id UUID, p_reason TEXT, p_cancelled_by VARCHAR)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_booking      bookings;
  v_caller       UUID := auth.uid();
  v_is_owner     BOOLEAN;
  v_is_privileged BOOLEAN;
  v_starts_at    TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
  END IF;

  v_is_owner := (v_caller IS NOT NULL AND v_booking.user_id = v_caller);
  -- COALESCE is load-bearing: get_provider_branch_ids() returns NULL (not an
  -- empty array) for a non-provider, and `x = ANY(NULL)` is NULL — an
  -- un-COALESCEd OR chain would evaluate to NULL and fall through to ALLOW.
  v_is_privileged :=
       (v_caller IS NULL)                                                     -- service_role
    OR COALESCE(v_booking.branch_id = ANY (get_provider_branch_ids()), FALSE) -- branch staff
    OR (get_user_role() = 'admin');

  IF NOT (v_is_owner OR v_is_privileged) THEN
    -- Deliberately indistinguishable from a missing row: never confirm to a
    -- stranger that a given booking id exists.
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
  END IF;

  IF v_booking.status IN ('completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_cancel', 'status', v_booking.status);
  END IF;

  -- Slots are Egypt WALL CLOCK (date + time, no zone); pin the comparison to
  -- Africa/Cairo or a server in another zone would move the boundary.
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
     SET status = 'cancelled', cancellation_reason = p_reason, cancelled_by = p_cancelled_by,
         cancelled_at = NOW(), updated_at = NOW()
   WHERE id = p_booking_id;

  RETURN jsonb_build_object('success', true, 'booking_ref', v_booking.booking_ref);
END;
$$;

-- `branch_phone` added so the detail screen can reuse F04's اتصال action
-- without a second round-trip (the patient can already read `branches`, but
-- one payload beats two).
DROP FUNCTION IF EXISTS get_patient_bookings();
CREATE FUNCTION get_patient_bookings()
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
  branch_phone      VARCHAR,
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
    br.id, br.name_ar, br.address_ar, br.phone, br.lat, br.lng,
    COALESCE(bool_or(sc.slug = 'scans'), FALSE),
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
  JOIN slots    s  ON s.id  = b.slot_id
  JOIN branches br ON br.id = b.branch_id
  LEFT JOIN booking_services bsv ON bsv.booking_id = b.id
  LEFT JOIN branch_services  xbs ON xbs.id = bsv.branch_service_id
  LEFT JOIN services         sv  ON sv.id  = xbs.service_id
  LEFT JOIN service_categories sc ON sc.id = sv.category_id
  WHERE b.user_id = auth.uid()
    AND b.status <> 'pending_payment'
  GROUP BY b.id, s.slot_date, s.slot_time, br.id
  ORDER BY s.slot_date DESC, s.slot_time DESC;
$$;

REVOKE ALL ON FUNCTION get_patient_bookings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_patient_bookings() TO authenticated, service_role;
