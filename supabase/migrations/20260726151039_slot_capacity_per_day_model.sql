-- ============================================================
-- Slot capacity model fix (F05 sign-off blocker)
--
-- BUSINESS RULE: branches.instahealth_slot_allocation = max bookings per
-- branch per DAY. The old model generated a slot every slot_duration_minutes
-- across the full opening window, EACH with capacity = allocation — Town
-- (24/7) got 48 slots/day × capacity 5 = 240 bookings/day instead of 5,
-- and any single slot legitimately admitted 5 simultaneous holds (the
-- "two winners" seen in the two-session race test).
--
-- NEW MODEL: exactly `allocation` slots per branch per day, each capacity 1,
-- evenly spread (on a 30-min grid) within that day's opening hours. 24/7
-- branches use a 09:00–21:00 daytime window — no 1:00 AM slots.
-- ============================================================

-- 1 · generate_branch_slots — same name/signature (the generate-slots Edge
--     Function calls it per branch), new body implementing the per-day model.
CREATE OR REPLACE FUNCTION generate_branch_slots(p_branch_id UUID, p_start_date DATE DEFAULT CURRENT_DATE, p_end_date DATE DEFAULT CURRENT_DATE + INTERVAL '30 days')
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_branch        branches;
  v_current_date  DATE;
  v_day_key       VARCHAR(3);
  v_day_hours     JSONB;
  v_open_time     TIME;
  v_close_text    TEXT;
  v_close_time    TIME;
  v_daily_slots   INT;
  v_window_mins   INT;
  v_slot_count    INT;
  v_step_mins     INT;
  v_slots_made    INT := 0;
  i               INT;
BEGIN
  SELECT * INTO v_branch FROM branches WHERE id = p_branch_id AND is_active = TRUE;
  IF NOT FOUND THEN RETURN 0; END IF;
  v_daily_slots := GREATEST(COALESCE(v_branch.instahealth_slot_allocation, 5), 1);

  v_current_date := p_start_date;
  WHILE v_current_date <= p_end_date LOOP
    v_day_key := CASE EXTRACT(DOW FROM v_current_date)::INT WHEN 0 THEN 'sun' WHEN 1 THEN 'mon' WHEN 2 THEN 'tue' WHEN 3 THEN 'wed' WHEN 4 THEN 'thu' WHEN 5 THEN 'fri' WHEN 6 THEN 'sat' END;
    v_day_hours := v_branch.operating_hours -> v_day_key;
    IF v_day_hours IS NULL OR (v_day_hours ->> 'closed')::BOOLEAN IS TRUE THEN
      v_current_date := v_current_date + 1; CONTINUE;
    END IF;
    v_close_text := v_day_hours ->> 'close';
    IF (v_day_hours ->> 'open') IS NULL OR v_close_text IS NULL THEN
      v_current_date := v_current_date + 1; CONTINUE;
    END IF;
    v_open_time := (v_day_hours ->> 'open')::TIME;
    v_close_time := v_close_text::TIME;

    -- 24/7 branches: spread bookings over a sensible daytime window.
    IF v_open_time = '00:00'::TIME AND v_close_text = '24:00' THEN
      v_open_time := '09:00'::TIME;
      v_close_time := '21:00'::TIME;
    END IF;

    v_window_mins := (EXTRACT(EPOCH FROM (v_close_time - v_open_time)) / 60)::INT;
    -- Midnight-crossing ranges (open > close) are not supported for slot
    -- generation — skip rather than emit slots outside the window.
    IF v_window_mins < 30 THEN
      v_current_date := v_current_date + 1; CONTINUE;
    END IF;

    -- Evenly spread on a 30-min grid. step = floor((window/count)/30)*30
    -- guarantees the last slot stays >= 30 min before close.
    v_slot_count := LEAST(v_daily_slots, v_window_mins / 30);
    v_step_mins  := GREATEST(30, ((v_window_mins / v_slot_count) / 30) * 30);

    FOR i IN 0..(v_slot_count - 1) LOOP
      INSERT INTO slots (branch_id, slot_date, slot_time, capacity)
      VALUES (p_branch_id, v_current_date, v_open_time + make_interval(mins => i * v_step_mins), 1)
      ON CONFLICT (branch_id, slot_date, slot_time) DO NOTHING;
      IF FOUND THEN v_slots_made := v_slots_made + 1; END IF;
    END LOOP;

    v_current_date := v_current_date + 1;
  END LOOP;
  RETURN v_slots_made;
END;
$$;

-- 2 · Safety constraint: active (unexpired) holds + booked_count can never
--     exceed capacity, enforced under the slot row lock. create_slot_hold
--     already checks this pre-insert; the trigger closes every OTHER write
--     path (direct SQL, service role, future code).
CREATE OR REPLACE FUNCTION enforce_slot_hold_capacity()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_slot         slots;
  v_active_holds INT;
BEGIN
  SELECT * INTO v_slot FROM slots WHERE id = NEW.slot_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'slot_hold for missing slot %', NEW.slot_id;
  END IF;
  IF v_slot.is_blocked THEN
    RAISE EXCEPTION 'slot_hold on blocked slot %', NEW.slot_id;
  END IF;
  SELECT COUNT(*) INTO v_active_holds
  FROM slot_holds
  WHERE slot_id = NEW.slot_id AND expires_at > NOW() AND id <> NEW.id;
  IF v_slot.booked_count + v_active_holds + 1 > v_slot.capacity THEN
    RAISE EXCEPTION 'slot_hold_capacity_exceeded for slot % (booked %, active holds %, capacity %)',
      NEW.slot_id, v_slot.booked_count, v_active_holds, v_slot.capacity;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_slot_holds_capacity ON slot_holds;
CREATE TRIGGER trg_slot_holds_capacity BEFORE INSERT ON slot_holds FOR EACH ROW EXECUTE FUNCTION enforce_slot_hold_capacity();

-- 3 · Close the RPC bypass: the RLS INSERT policy let clients insert holds
--     directly, skipping create_slot_hold's capacity check entirely. Holds
--     are created ONLY via the SECURITY DEFINER RPC (which bypasses RLS);
--     patients keep SELECT-own and DELETE-own (release path).
DROP POLICY IF EXISTS "slot_holds: patient creates own" ON slot_holds;
