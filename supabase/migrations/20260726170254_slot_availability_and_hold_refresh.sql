-- ============================================================
-- Post-race-test fixes:
--
-- 1 · Displayed availability must equal the enforced rule. Patients can only
--     SELECT their OWN holds (RLS), so the picker rendered a slot as available
--     while create_slot_hold correctly rejected it (someone else's abandoned
--     hold). get_branch_slots() exposes per-slot ACTIVE hold counts — counts
--     only, no user data — so the client can evaluate the exact predicate the
--     DB enforces: booked_count + active unexpired holds < capacity.
--
-- 2 · Same-user semantics: re-holding a slot you already hold REFRESHES your
--     hold instead of erroring. The old count included the caller's own hold,
--     so on capacity-1 slots a refresh returned slot_full before the
--     delete-and-replace could run.
-- ============================================================

-- 1 · Availability read model for the slot picker + preview strips.
CREATE OR REPLACE FUNCTION get_branch_slots(p_branch_id UUID, p_from DATE DEFAULT CURRENT_DATE, p_to DATE DEFAULT CURRENT_DATE + INTERVAL '30 days')
RETURNS TABLE (
  id UUID,
  slot_date DATE,
  slot_time TIME,
  capacity INT,
  booked_count INT,
  is_blocked BOOLEAN,
  active_hold_count INT
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT s.id, s.slot_date, s.slot_time, s.capacity, s.booked_count, s.is_blocked,
         COUNT(h.id) FILTER (WHERE h.expires_at > NOW())::INT AS active_hold_count
  FROM slots s
  LEFT JOIN slot_holds h ON h.slot_id = s.id
  WHERE s.branch_id = p_branch_id
    AND s.slot_date BETWEEN p_from AND p_to
  GROUP BY s.id
  ORDER BY s.slot_date, s.slot_time;
$$;

-- 2 · create_slot_hold: exclude the caller's own holds from the capacity
--     count — their existing hold is deleted-and-replaced below, so counting
--     it double-books the caller against themselves.
CREATE OR REPLACE FUNCTION create_slot_hold(p_slot_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_slot       slots;
  v_hold_count INT;
  v_hold_id    UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_slot FROM slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'slot_not_found'); END IF;
  IF v_slot.is_blocked THEN RETURN jsonb_build_object('success', false, 'error', 'slot_blocked'); END IF;
  SELECT COUNT(*) INTO v_hold_count FROM slot_holds
  WHERE slot_id = p_slot_id AND expires_at > NOW() AND user_id <> p_user_id;
  IF (v_slot.booked_count + v_hold_count) >= v_slot.capacity THEN RETURN jsonb_build_object('success', false, 'error', 'slot_full'); END IF;
  DELETE FROM slot_holds WHERE slot_id = p_slot_id AND user_id = p_user_id;
  v_expires_at := NOW() + INTERVAL '10 minutes';
  INSERT INTO slot_holds (slot_id, user_id, expires_at) VALUES (p_slot_id, p_user_id, v_expires_at) RETURNING id INTO v_hold_id;
  RETURN jsonb_build_object('success', true, 'hold_id', v_hold_id, 'slot_id', p_slot_id, 'expires_at', v_expires_at);
END;
$$;
