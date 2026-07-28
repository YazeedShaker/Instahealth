-- P01 — the receptionist workflow: the desk records what actually happened.
--
-- Three pieces: the outcome states themselves, the RPC that moves a booking
-- between them, and the read function the Today view is built on.

-- ═══ 1 · outcome states ════════════════════════════════════════════════════
-- `arrived` sits between confirmed and completed: the patient is at the desk
-- but the service has not been delivered yet. completed/no_show already
-- existed but nothing ever wrote them (PROGRESS, F07 open decision #1) — this
-- migration is what answers "who marks the outcome": the receptionist.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (
  status IN ('pending', 'pending_payment', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show')
);

-- One timestamp per terminal-ish transition. `completed_at` already existed.
-- COMMISSION NOTE: open business decision #2 (PROGRESS, F07) is whether
-- commission attaches at payment (prepaid) or at completion (cash). These
-- columns are what makes the second option computable later — do not drop them
-- because "nothing reads them yet".
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS arrived_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ;

-- ═══ 2 · mark_booking_outcome ══════════════════════════════════════════════
-- SECURITY DEFINER, so per the grants sweep (ENGINEERING-WORKFLOW §5) the
-- function body IS the authorization boundary — RLS does not apply inside it.
-- Two holes of exactly this shape have already shipped (confirm_booking in F06,
-- cancel_booking in F07), so the membership check comes first and the booking
-- id is never trusted on its own.
--
-- LEGAL TRANSITIONS ONLY, and they mirror what the UI offers:
--   confirmed | pending_payment → arrived | no_show
--   arrived                     → completed | no_show
-- Everything else is refused. Cancelled and completed are terminal.
--
-- CASH: the desk collecting the money IS the payment event. confirm_booking
-- writes cash bookings as payment_status='cash' + payments.status='pending'
-- (verified in 20260616164733); completing one flips both to paid/completed.
-- Prepaid bookings are already settled and are left untouched.
CREATE OR REPLACE FUNCTION mark_booking_outcome(p_booking_id UUID, p_outcome VARCHAR)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_booking      bookings;
  v_caller       UUID := auth.uid();
  v_is_staff     BOOLEAN;
  v_legal        BOOLEAN;
BEGIN
  IF p_outcome NOT IN ('arrived', 'completed', 'no_show') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_outcome');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
  END IF;

  -- COALESCE is load-bearing: get_provider_branch_ids() returns NULL (not an
  -- empty array) for a non-provider, and `x = ANY(NULL)` is NULL, which an
  -- `IF NOT (...)` would treat as false and fall through to ALLOW.
  v_is_staff :=
       (v_caller IS NULL)                                                     -- service_role
    OR COALESCE(v_booking.branch_id = ANY (get_provider_branch_ids()), FALSE)
    OR (get_user_role() = 'admin');

  IF NOT v_is_staff THEN
    -- Same shape as a missing row: never confirm to a stranger (or a patient
    -- poking at the RPC) that a given booking id exists.
    RETURN jsonb_build_object('success', false, 'error', 'booking_not_found');
  END IF;

  -- IDEMPOTENT: re-marking the state a booking is already in is a no-op
  -- success, so a double-clicked وصل cannot raise a second error toast.
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
    RETURN jsonb_build_object(
      'success', false, 'error', 'illegal_transition',
      'from', v_booking.status, 'to', p_outcome
    );
  END IF;

  UPDATE bookings
     SET status       = p_outcome,
         arrived_at   = CASE WHEN p_outcome = 'arrived'   THEN NOW() ELSE arrived_at   END,
         completed_at = CASE WHEN p_outcome = 'completed' THEN NOW() ELSE completed_at END,
         no_show_at   = CASE WHEN p_outcome = 'no_show'   THEN NOW() ELSE no_show_at   END,
         -- The cash collection. Prepaid ('paid') is untouched; a no-show never
         -- becomes paid.
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

-- ═══ 3 · get_branch_bookings_for_date ══════════════════════════════════════
-- The Today view CANNOT be built from table queries. `users` has no provider
-- SELECT policy (only `id = auth.uid()` or admin), so a receptionist cannot
-- read the patient name and phone the desk exists to use — and widening a PII
-- table's RLS for every provider is a far worse trade than one scoped function.
-- Same shape as get_patient_bookings (F07): the membership check lives inside,
-- and the branch id is validated rather than trusted.
CREATE OR REPLACE FUNCTION get_branch_bookings_for_date(p_branch_id UUID, p_date DATE)
RETURNS TABLE (
  id              UUID,
  booking_ref     VARCHAR,
  status          VARCHAR,
  payment_status  VARCHAR,
  payment_method  VARCHAR,
  total_amount    NUMERIC,
  patient_notes   TEXT,
  slot_id         UUID,
  slot_time       TIME,
  created_at      TIMESTAMPTZ,
  arrived_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  no_show_at      TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  patient_name_ar TEXT,
  patient_phone   TEXT,
  services        JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (
       (auth.uid() IS NULL)
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
    b.total_amount, b.patient_notes, b.slot_id, s.slot_time,
    b.created_at, b.arrived_at, b.completed_at, b.no_show_at, b.cancelled_at,
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
  GROUP BY b.id, s.slot_time, u.name_ar, u.phone
  ORDER BY s.slot_time;
END;
$$;

REVOKE ALL ON FUNCTION get_branch_bookings_for_date(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_branch_bookings_for_date(UUID, DATE) TO authenticated, service_role;

-- ═══ 4 · realtime: bookings changes broadcast to the branch ════════════════
-- Deliberately the BROADCAST pattern, not postgres_changes, matching
-- migration 20260726205901 and ENGINEERING-WORKFLOW §5: postgres_changes on
-- `bookings` would put every booking row through the realtime server for
-- per-subscriber RLS filtering, and `supabase_realtime` currently publishes no
-- tables at all. The payload carries ids only; the dashboard refetches through
-- get_branch_bookings_for_date, so RLS-equivalent scoping is never bypassed.
CREATE OR REPLACE FUNCTION broadcast_branch_booking_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row bookings;
BEGIN
  v_row := COALESCE(NEW, OLD);
  IF v_row.branch_id IS NOT NULL THEN
    PERFORM realtime.send(
      jsonb_build_object('booking_id', v_row.id, 'op', TG_OP, 'status', v_row.status),
      'bookings_changed',
      'branch-bookings:' || v_row.branch_id::text,
      true
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_broadcast ON bookings;
CREATE TRIGGER trg_bookings_broadcast
AFTER INSERT OR UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION broadcast_branch_booking_change();

-- Receive-side auth. Unlike the hold topics (which carry nothing sensitive and
-- are open to any patient), a branch's booking activity is staff-only: the
-- topic name must match a branch the caller actually works at.
DROP POLICY IF EXISTS "provider staff receive branch booking broadcasts" ON realtime.messages;
CREATE POLICY "provider staff receive branch booking broadcasts"
ON realtime.messages FOR SELECT TO authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND realtime.topic() LIKE 'branch-bookings:%'
  AND COALESCE(
    replace(realtime.topic(), 'branch-bookings:', '')::uuid = ANY (get_provider_branch_ids()),
    FALSE
  )
);
