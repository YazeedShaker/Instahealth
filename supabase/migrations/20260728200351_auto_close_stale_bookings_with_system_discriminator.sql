-- Ratified decision: untouched bookings are auto-closed — never silently,
-- never punitively.
--
-- A booking nobody clicks would otherwise sit `confirmed` forever, which makes
-- the السابقة tab lie and leaves F09 reviews with nothing to attach to. A
-- nightly job closes them, but three rules keep it honest:
--
--   1. 24h GRACE. Only slots that ended more than a day ago. The desk gets a
--      full day to fix yesterday truthfully before the system guesses.
--   2. ALWAYS DISTINGUISHABLE. A system guess is recorded as closed_by
--      'system'; a receptionist's judgement is 'provider'. Future reputation
--      logic MUST exclude the system ones — a patient who actually attended but
--      whose desk forgot to click must never be penalised for our automation.
--   3. NEVER PUNITIVE ON MONEY. An auto-closed cash booking does NOT flip to
--      paid. Nobody collected anything, so claiming otherwise would invent
--      revenue and corrupt the commission trail.
--
-- See docs/decisions/DECISION-booking-outcome-lifecycle.md

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS closed_by VARCHAR;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_closed_by_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_closed_by_check CHECK (
  closed_by IS NULL OR closed_by IN ('provider', 'admin', 'system')
);

COMMENT ON COLUMN bookings.closed_by IS
  'Who recorded the terminal outcome: provider (desk), admin, or system '
  '(nightly auto-close). System-closed no-shows are GUESSES and must be '
  'excluded from any patient-reputation or reliability metric.';

UPDATE bookings SET closed_by = 'provider'
 WHERE closed_by IS NULL AND status IN ('arrived', 'completed', 'no_show');

CREATE OR REPLACE FUNCTION mark_booking_outcome(p_booking_id UUID, p_outcome VARCHAR)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_booking  bookings;
  v_caller   UUID := auth.uid();
  v_is_staff BOOLEAN;
  v_legal    BOOLEAN;
  v_closer   VARCHAR;
BEGIN
  IF p_outcome NOT IN ('arrived', 'completed', 'no_show') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_outcome');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
  END IF;

  v_is_staff :=
       (v_caller IS NULL)
    OR COALESCE(v_booking.branch_id = ANY (get_provider_branch_ids()), FALSE)
    OR (get_user_role() = 'admin');

  IF NOT v_is_staff THEN
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
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

  -- A human is on the other end of this RPC by construction: the cron does NOT
  -- come through here.
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
$$;

REVOKE ALL ON FUNCTION mark_booking_outcome(UUID, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mark_booking_outcome(UUID, VARCHAR) TO authenticated, service_role;

-- Deliberately NOT routed through mark_booking_outcome: that function records a
-- HUMAN decision, and conflating the two would make the discriminator
-- meaningless.
CREATE OR REPLACE FUNCTION auto_close_stale_bookings()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_closed INTEGER;
BEGIN
  WITH stale AS (
    SELECT b.id
    FROM bookings b
    JOIN slots s ON s.id = b.slot_id
    WHERE b.status IN ('confirmed', 'arrived')
      -- Slots are Egypt WALL CLOCK; pin the comparison or a server in another
      -- zone moves the grace window.
      AND ((s.slot_date + s.slot_time) AT TIME ZONE 'Africa/Cairo') < NOW() - INTERVAL '24 hours'
  )
  UPDATE bookings b
     SET status     = 'no_show',
         no_show_at = NOW(),
         closed_by  = 'system',
         updated_at = NOW()
    FROM stale
   WHERE b.id = stale.id;
  -- NOTE what is absent: payment_status is untouched. An auto-closed cash
  -- booking stays 'cash' because nobody collected anything.

  GET DIAGNOSTICS v_closed = ROW_COUNT;
  RETURN v_closed;
END;
$$;

REVOKE ALL ON FUNCTION auto_close_stale_bookings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION auto_close_stale_bookings() TO service_role;

-- 02:30 Cairo (00:30 UTC) — after midnight, before the desk opens, and clear of
-- the 00:10 slot-generation job.
SELECT cron.unschedule('auto-close-stale-bookings')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-close-stale-bookings');

SELECT cron.schedule(
  'auto-close-stale-bookings',
  '30 0 * * *',
  $cron$ SELECT auto_close_stale_bookings(); $cron$
);
