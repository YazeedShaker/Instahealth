CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT 'admin'    FROM admin_users    WHERE auth_user_id = auth.uid() LIMIT 1),
    (SELECT 'provider' FROM provider_users WHERE auth_user_id = auth.uid() AND is_active = TRUE LIMIT 1),
    'patient'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_provider_branch_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE(branch_ids, '{}')
  FROM provider_users
  WHERE auth_user_id = auth.uid() AND is_active = TRUE
  LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION set_booking_ref()
RETURNS TRIGGER AS $$
DECLARE
  v_ref   VARCHAR(20);
  v_count INT;
BEGIN
  IF NEW.booking_ref IS NOT NULL THEN RETURN NEW; END IF;
  LOOP
    v_ref := 'IH-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD((FLOOR(RANDOM() * 99999) + 1)::TEXT, 5, '0');
    SELECT COUNT(*) INTO v_count FROM bookings WHERE booking_ref = v_ref;
    EXIT WHEN v_count = 0;
  END LOOP;
  NEW.booking_ref := v_ref;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_booking_ref BEFORE INSERT ON bookings FOR EACH ROW EXECUTE FUNCTION set_booking_ref();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at           BEFORE UPDATE ON users           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_providers_updated_at       BEFORE UPDATE ON providers       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_branches_updated_at        BEFORE UPDATE ON branches        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_branch_services_updated_at BEFORE UPDATE ON branch_services FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_bookings_updated_at        BEFORE UPDATE ON bookings        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_updated_at        BEFORE UPDATE ON payments        FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION recalculate_branch_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE branches SET
    rating = (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM reviews WHERE branch_id = COALESCE(NEW.branch_id, OLD.branch_id) AND is_flagged = FALSE),
    review_count = (SELECT COUNT(*) FROM reviews WHERE branch_id = COALESCE(NEW.branch_id, OLD.branch_id) AND is_flagged = FALSE)
  WHERE id = COALESCE(NEW.branch_id, OLD.branch_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_branch_rating AFTER INSERT OR UPDATE OR DELETE ON reviews FOR EACH ROW EXECUTE FUNCTION recalculate_branch_rating();

CREATE OR REPLACE FUNCTION confirm_booking(p_booking_id UUID, p_payment_method VARCHAR, p_gateway_txn_id VARCHAR DEFAULT NULL, p_gateway_order_id VARCHAR DEFAULT NULL, p_gateway_response JSONB DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking bookings;
  v_slot    slots;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'booking_not_found'); END IF;
  IF v_booking.status NOT IN ('pending', 'pending_payment') THEN RETURN jsonb_build_object('success', false, 'error', 'booking_already_processed', 'current_status', v_booking.status); END IF;
  SELECT * INTO v_slot FROM slots WHERE id = v_booking.slot_id FOR UPDATE;
  IF v_slot.booked_count >= v_slot.capacity OR v_slot.is_blocked THEN RETURN jsonb_build_object('success', false, 'error', 'slot_unavailable'); END IF;
  UPDATE slots SET booked_count = booked_count + 1 WHERE id = v_slot.id;
  UPDATE bookings SET status = 'confirmed', payment_status = CASE WHEN p_payment_method = 'cash' THEN 'cash' ELSE 'paid' END, payment_method = p_payment_method, confirmed_at = NOW(), updated_at = NOW() WHERE id = p_booking_id;
  INSERT INTO payments (booking_id, amount, method, status, gateway_txn_id, gateway_order_id, gateway_response) VALUES (p_booking_id, v_booking.total_amount, p_payment_method, CASE WHEN p_payment_method = 'cash' THEN 'pending' ELSE 'completed' END, p_gateway_txn_id, p_gateway_order_id, p_gateway_response) ON CONFLICT (booking_id) DO UPDATE SET status = EXCLUDED.status, gateway_txn_id = EXCLUDED.gateway_txn_id, gateway_response = EXCLUDED.gateway_response, updated_at = NOW();
  DELETE FROM slot_holds WHERE slot_id = v_booking.slot_id AND user_id = v_booking.user_id;
  RETURN jsonb_build_object('success', true, 'booking_ref', v_booking.booking_ref, 'branch_id', v_booking.branch_id, 'user_id', v_booking.user_id, 'total_amount', v_booking.total_amount);
END;
$$;

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
  SELECT COUNT(*) INTO v_hold_count FROM slot_holds WHERE slot_id = p_slot_id AND expires_at > NOW();
  IF (v_slot.booked_count + v_hold_count) >= v_slot.capacity THEN RETURN jsonb_build_object('success', false, 'error', 'slot_full'); END IF;
  DELETE FROM slot_holds WHERE slot_id = p_slot_id AND user_id = p_user_id;
  v_expires_at := NOW() + INTERVAL '10 minutes';
  INSERT INTO slot_holds (slot_id, user_id, expires_at) VALUES (p_slot_id, p_user_id, v_expires_at) RETURNING id INTO v_hold_id;
  RETURN jsonb_build_object('success', true, 'hold_id', v_hold_id, 'slot_id', p_slot_id, 'expires_at', v_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION generate_branch_slots(p_branch_id UUID, p_start_date DATE DEFAULT CURRENT_DATE, p_end_date DATE DEFAULT CURRENT_DATE + INTERVAL '30 days')
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_branch       branches;
  v_current_date DATE;
  v_day_key      VARCHAR(3);
  v_day_hours    JSONB;
  v_open_time    TIME;
  v_close_time   TIME;
  v_cur_time     TIME;
  v_duration     INTERVAL;
  v_slots_made   INT := 0;
BEGIN
  SELECT * INTO v_branch FROM branches WHERE id = p_branch_id AND is_active = TRUE;
  IF NOT FOUND THEN RETURN 0; END IF;
  v_duration := (COALESCE(v_branch.slot_duration_minutes, 30) || ' minutes')::INTERVAL;
  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    v_day_key := CASE EXTRACT(DOW FROM v_current_date)::INT WHEN 0 THEN 'sun' WHEN 1 THEN 'mon' WHEN 2 THEN 'tue' WHEN 3 THEN 'wed' WHEN 4 THEN 'thu' WHEN 5 THEN 'fri' WHEN 6 THEN 'sat' END;
    v_day_hours := v_branch.operating_hours -> v_day_key;
    IF (v_day_hours ->> 'closed')::BOOLEAN IS TRUE THEN v_current_date := v_current_date + 1; CONTINUE; END IF;
    v_open_time  := (v_day_hours ->> 'open')::TIME;
    v_close_time := (v_day_hours ->> 'close')::TIME;
    IF v_open_time IS NULL OR v_close_time IS NULL THEN v_current_date := v_current_date + 1; CONTINUE; END IF;
    v_cur_time := v_open_time;
    WHILE v_cur_time < v_close_time LOOP
      INSERT INTO slots (branch_id, slot_date, slot_time, capacity) VALUES (p_branch_id, v_current_date, v_cur_time, v_branch.instahealth_slot_allocation) ON CONFLICT (branch_id, slot_date, slot_time) DO NOTHING;
      IF FOUND THEN v_slots_made := v_slots_made + 1; END IF;
      v_cur_time := v_cur_time + v_duration;
    END LOOP;
    v_current_date := v_current_date + 1;
  END LOOP;
  RETURN v_slots_made;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_expired_holds()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_deleted INT;
BEGIN
  DELETE FROM slot_holds WHERE expires_at < NOW();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION cancel_booking(p_booking_id UUID, p_reason TEXT, p_cancelled_by VARCHAR)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_booking bookings;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'booking_not_found'); END IF;
  IF v_booking.status IN ('completed', 'cancelled') THEN RETURN jsonb_build_object('success', false, 'error', 'cannot_cancel', 'status', v_booking.status); END IF;
  IF v_booking.status = 'confirmed' THEN UPDATE slots SET booked_count = GREATEST(0, booked_count - 1) WHERE id = v_booking.slot_id; END IF;
  UPDATE bookings SET status = 'cancelled', cancellation_reason = p_reason, cancelled_by = p_cancelled_by, cancelled_at = NOW(), updated_at = NOW() WHERE id = p_booking_id;
  RETURN jsonb_build_object('success', true, 'booking_ref', v_booking.booking_ref);
END;
$$;
