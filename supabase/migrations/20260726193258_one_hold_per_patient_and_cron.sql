-- ============================================================
-- Hold-leak defense in depth (post device-test loop):
--
-- 1 · ONE ACTIVE HOLD PER PATIENT, enforced server-side. The app books one
--     slot at a time; create_slot_hold now releases ALL of the caller's other
--     holds first. Any leaked hold (killed app, stale bundle, dead battery)
--     self-heals the moment its owner holds anything again — client cleanup
--     becomes an optimization, not a correctness requirement.
--
-- 2 · Schedule the cleanup + slot-window crons via pg_cron. The "cleanup cron
--     safety net" had never actually been scheduled; expired hold rows
--     lingered in the table (harmless to logic, confusing to humans), and the
--     30-day slot window was never extended nightly.
-- ============================================================

-- 1 · One active hold per patient
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
  -- One active hold per patient: starting a new hold releases EVERY other
  -- hold this user has (not just same-slot) — leaked holds self-heal here.
  DELETE FROM slot_holds WHERE user_id = p_user_id;
  v_expires_at := NOW() + INTERVAL '10 minutes';
  INSERT INTO slot_holds (slot_id, user_id, expires_at) VALUES (p_slot_id, p_user_id, v_expires_at) RETURNING id INTO v_hold_id;
  RETURN jsonb_build_object('success', true, 'hold_id', v_hold_id, 'slot_id', p_slot_id, 'expires_at', v_expires_at);
END;
$$;

-- 2 · Real cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Purge expired hold rows every 5 minutes (logic already ignores expired
-- holds everywhere; this keeps the table honest).
SELECT cron.schedule('cleanup-expired-holds', '*/5 * * * *', $$SELECT cleanup_expired_holds()$$);

-- Keep the 30-day slot window rolling: nightly 02:10 Cairo (00:10 UTC).
SELECT cron.schedule('generate-slot-window', '10 0 * * *', $$
  DO 'DECLARE b RECORD; BEGIN
    FOR b IN SELECT id FROM branches WHERE is_active = TRUE AND holiday_mode IS NOT TRUE LOOP
      PERFORM generate_branch_slots(b.id, CURRENT_DATE, CURRENT_DATE + 30);
    END LOOP;
  END'
$$);
