-- A06 + A07 · Bookings oversight and the ops overview.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⓪ WHAT THE LIVE DATABASE ALREADY DID, AND WHERE THE SPEC IS RIGHT ANYWAY
-- ═══════════════════════════════════════════════════════════════════════════
-- SPEC-A06 asks for an admin cancel writer "per the standing pattern (NOT a
-- loosening of the patient or provider paths)". Verified first, as §1.3
-- requires — and `cancel_booking` ALREADY supports an admin cancel, correctly:
-- it computes `v_is_admin`, permits the `'admin'` discriminator only to a
-- caller that actually holds that capacity (VERIFIED, not trusted — the §5
-- fix), releases the slot on a confirmed booking, and records `cancelled_by`.
--
-- So a second full writer would be a SECOND DOOR to the same transition, which
-- is exactly what A04's `admin_update_service` refuses to be. This wrapper
-- therefore DELEGATES the state change and adds only what the admin path owes
-- and the shared function cannot know:
--
--   ⚠ ① THE BOUNDARY. `cancel_booking` applies the before-slot-start rule to
--      the PATIENT ALONE (`IF v_is_owner AND NOT v_is_privileged`) — reception
--      must be able to close out a past booking. SPEC-A06 says the admin path
--      carries the "same before-slot-start boundary", so it is enforced HERE,
--      above the delegate. That is a tightening, not a loosening.
--   ② A REQUIRED, ENUMERATED REASON. Free text alone cannot be reported on.
--   ③ AN AUDIT ROW naming the admin. The reason is for us, never for the
--      patient — the frame is explicit that it is not sent to them.

-- ───────────────────────────────────────────────────────────────────────────
-- ① The audit trail for admin action on a booking.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE public.admin_booking_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id  UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  reason_code TEXT,
  reason_note TEXT,
  changed_by  UUID REFERENCES auth.users(id),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX admin_booking_history_by_booking
  ON public.admin_booking_history (booking_id, changed_at DESC);

COMMENT ON TABLE public.admin_booking_history IS
  'Admin action on a booking. reason_note is INTERNAL — never rendered to the patient. Read-only, append-only.';

ALTER TABLE public.admin_booking_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin booking history: admin reads"
  ON public.admin_booking_history FOR SELECT
  USING (public.get_user_role() = 'admin');

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
  ON public.admin_booking_history FROM anon, authenticated;
REVOKE ALL ON public.admin_booking_history FROM anon;

-- ───────────────────────────────────────────────────────────────────────────
-- ② The admin cancel — a wrapper, not a rewrite.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_cancel_booking(
  p_booking_id UUID,
  p_reason_code TEXT,
  p_reason_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_note      TEXT := NULLIF(BTRIM(COALESCE(p_reason_note, '')), '');
  v_starts_at TIMESTAMPTZ;
  v_status    TEXT;
  v_slot      UUID;
  v_result    JSONB;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- The frame's dropdown. An enum rather than free text because «why did the
  -- admin cancel this» is a question the oversight screen has to be able to
  -- answer in aggregate, and prose cannot be counted.
  IF p_reason_code IS NULL OR p_reason_code NOT IN (
    'partner_unavailable', 'patient_request', 'duplicate', 'test_booking', 'other'
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'reason_required');
  END IF;

  -- «other» without a note is not a reason, it is a shrug.
  IF p_reason_code = 'other' AND v_note IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'note_required_for_other');
  END IF;

  SELECT b.status, b.slot_id INTO v_status, v_slot FROM bookings b WHERE b.id = p_booking_id;
  IF v_status IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'booking_not_found');
  END IF;

  -- ⚠ THE BOUNDARY THE DELEGATE DOES NOT APPLY TO PRIVILEGED CALLERS.
  -- Egypt wall clock, pinned to Africa/Cairo — a server in another zone would
  -- move the boundary (the same pin `cancel_booking` uses).
  SELECT (s.slot_date + s.slot_time) AT TIME ZONE 'Africa/Cairo'
    INTO v_starts_at FROM slots s WHERE s.id = v_slot;
  IF v_starts_at IS NOT NULL AND v_starts_at <= NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'slot_started', 'starts_at', v_starts_at);
  END IF;

  -- Delegate. The slot release, the status guard and the discriminator check
  -- all live there and are already proven; duplicating them here is how two
  -- copies of one rule drift apart.
  v_result := cancel_booking(p_booking_id, v_note, 'admin');

  IF (v_result->>'success')::BOOLEAN IS NOT TRUE THEN
    RETURN v_result;
  END IF;

  INSERT INTO admin_booking_history (booking_id, action, reason_code, reason_note, changed_by)
  VALUES (p_booking_id, 'booking_cancelled', p_reason_code, v_note, v_uid);

  RETURN v_result || jsonb_build_object('reason_code', p_reason_code);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ③ THE MONEY BLOCK — one shared source, zero drawer-local math.
--
-- SPEC-A06: "The drawer must never disagree with the statement it links to."
-- So the chip is computed from A02's own helpers — `commission_rate_at` and
-- `commission_piasters` — which are internal-only (`postgres, service_role`)
-- and reachable here because a SECURITY DEFINER body runs as the owner. That
-- is the whole reason this is a function and not a client-side calculation.
--
-- The chip rules, from the approved annotation:
--   confirmed / arrived            → «عمولة متوقعة» (expected)
--   completed                      → actual
--   cancelled / no_show            → ABSENT. Nothing is owed on either.
-- The event date is when the booking was TAKEN (migration 20260809183734), so
-- the rate is the one in force then — not today's.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_commission_view(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_b        bookings;
  v_provider UUID;
  v_percent  NUMERIC;
  v_piasters BIGINT;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF v_b.id IS NULL THEN RETURN NULL; END IF;

  SELECT br.provider_id INTO v_provider FROM branches br WHERE br.id = v_b.branch_id;

  IF v_b.status IN ('cancelled', 'no_show') THEN
    RETURN jsonb_build_object('kind', 'none', 'reasonAr',
      CASE WHEN v_b.status = 'cancelled' THEN 'لا عمولة على حجز ملغى'
           ELSE 'لا عمولة على عدم حضور' END);
  END IF;

  v_percent := commission_rate_at(v_provider, (v_b.created_at AT TIME ZONE 'Africa/Cairo')::DATE);
  IF v_percent IS NULL THEN
    -- A missing rate THROWS in A02 rather than defaulting; here it degrades to
    -- an honest gap so one unconfigured provider cannot blank the whole drawer.
    RETURN jsonb_build_object('kind', 'unknown', 'reasonAr', 'لا نسبة عمولة مسجّلة لهذا المزود');
  END IF;

  v_piasters := commission_piasters(ROUND(COALESCE(v_b.total_amount, 0) * 100)::BIGINT, v_percent);

  RETURN jsonb_build_object(
    'kind', CASE WHEN v_b.status = 'completed' THEN 'actual' ELSE 'expected' END,
    'percent', v_percent,
    'commissionPiasters', v_piasters,
    'totalEgp', v_b.total_amount,
    'eventDate', (v_b.created_at AT TIME ZONE 'Africa/Cairo')::DATE,
    'statementMonth', date_trunc('month', (v_b.created_at AT TIME ZONE 'Africa/Cairo')::DATE)::DATE
  );
END;
$$;

REVOKE ALL ON FUNCTION public.booking_commission_view(UUID) FROM PUBLIC, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- ④ The network list. Server-side search, admin-gated.
--
-- ⚠ PHONE SEARCH IS DIGITS-ONLY ON BOTH SIDES. A founder types 0101…, the
-- column holds 201… — comparing them raw finds nothing, and «finds ALL their
-- bookings incl. cancelled» is the whole point of the lookup.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_bookings(
  p_search TEXT DEFAULT NULL,
  p_provider_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_q      TEXT := NULLIF(BTRIM(COALESCE(p_search, '')), '');
  v_ref    TEXT;
  v_digits TEXT;
  v_rows   JSONB;
  v_total  INT;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- «forgiving of case/spacing» — IH-2026-52316, ih202652316, and
  -- «IH 2026 52316» are the same reference.
  v_ref := UPPER(REGEXP_REPLACE(COALESCE(v_q, ''), '[^A-Za-z0-9]', '', 'g'));
  v_digits := REGEXP_REPLACE(COALESCE(v_q, ''), '\D', '', 'g');
  IF LENGTH(v_digits) < 6 THEN v_digits := NULL; END IF;

  WITH filtered AS (
    SELECT bk.id, bk.booking_ref, bk.status, bk.total_amount, bk.created_at,
           bk.cancelled_by, bk.cancelled_at,
           sl.slot_date, sl.slot_time,
           b.id AS branch_id, b.name_ar AS branch_name_ar,
           p.id AS provider_id, p.name_ar AS provider_name_ar,
           u.name_ar AS patient_name_ar, u.phone AS patient_phone
      FROM bookings bk
      JOIN slots sl ON sl.id = bk.slot_id
      JOIN branches b ON b.id = bk.branch_id
      JOIN providers p ON p.id = b.provider_id
      LEFT JOIN users u ON u.id = bk.user_id
     WHERE (p_provider_id IS NULL OR p.id = p_provider_id)
       AND (p_status IS NULL OR bk.status = p_status)
       AND (p_from IS NULL OR sl.slot_date >= p_from)
       AND (p_to IS NULL OR sl.slot_date <= p_to)
       AND (
         v_q IS NULL
         OR UPPER(REGEXP_REPLACE(bk.booking_ref, '[^A-Za-z0-9]', '', 'g')) LIKE '%' || v_ref || '%'
         OR (v_digits IS NOT NULL
             AND REGEXP_REPLACE(COALESCE(u.phone, ''), '\D', '', 'g') LIKE '%' || v_digits || '%')
         OR normalize_arabic(COALESCE(u.name_ar, '')) LIKE '%' || normalize_arabic(v_q) || '%'
       )
  )
  SELECT COUNT(*)::INT INTO v_total FROM filtered;

  WITH filtered AS (
    SELECT bk.id, bk.booking_ref, bk.status, bk.total_amount, bk.created_at,
           bk.cancelled_by, sl.slot_date, sl.slot_time,
           b.name_ar AS branch_name_ar, p.name_ar AS provider_name_ar,
           u.name_ar AS patient_name_ar, u.phone AS patient_phone
      FROM bookings bk
      JOIN slots sl ON sl.id = bk.slot_id
      JOIN branches b ON b.id = bk.branch_id
      JOIN providers p ON p.id = b.provider_id
      LEFT JOIN users u ON u.id = bk.user_id
     WHERE (p_provider_id IS NULL OR p.id = p_provider_id)
       AND (p_status IS NULL OR bk.status = p_status)
       AND (p_from IS NULL OR sl.slot_date >= p_from)
       AND (p_to IS NULL OR sl.slot_date <= p_to)
       AND (
         v_q IS NULL
         OR UPPER(REGEXP_REPLACE(bk.booking_ref, '[^A-Za-z0-9]', '', 'g')) LIKE '%' || v_ref || '%'
         OR (v_digits IS NOT NULL
             AND REGEXP_REPLACE(COALESCE(u.phone, ''), '\D', '', 'g') LIKE '%' || v_digits || '%')
         OR normalize_arabic(COALESCE(u.name_ar, '')) LIKE '%' || normalize_arabic(v_q) || '%'
       )
     ORDER BY sl.slot_date DESC, sl.slot_time DESC
     LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200)) OFFSET GREATEST(0, COALESCE(p_offset, 0))
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'bookingId', f.id,
           'bookingRef', f.booking_ref,
           'status', f.status,
           'cancelledBy', f.cancelled_by,
           'slotDate', f.slot_date,
           'slotTime', f.slot_time,
           'branchNameAr', f.branch_name_ar,
           'providerNameAr', f.provider_name_ar,
           'patientNameAr', f.patient_name_ar,
           'totalEgp', f.total_amount
         )), '[]'::jsonb) INTO v_rows FROM filtered f;

  RETURN jsonb_build_object('bookings', v_rows, 'total', COALESCE(v_total, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_booking_detail(p_booking_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_out JSONB;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT jsonb_build_object(
    'found', TRUE,
    'bookingId', bk.id,
    'bookingRef', bk.booking_ref,
    'status', bk.status,
    'cancelledBy', bk.cancelled_by,
    'cancelledAt', bk.cancelled_at,
    'cancellationReason', bk.cancellation_reason,
    'createdAt', bk.created_at,
    'slotDate', sl.slot_date,
    'slotTime', sl.slot_time,
    'branchNameAr', b.name_ar,
    'branchPhone', b.phone,
    'providerNameAr', p.name_ar,
    'patientNameAr', u.name_ar,
    'patientPhone', u.phone,
    'totalEgp', bk.total_amount,
    'paymentStatus', bk.payment_status,
    'services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nameAr', s.name_ar, 'priceEgp', bsv.price_at_booking))
        FROM booking_services bsv
        JOIN branch_services bs ON bs.id = bsv.branch_service_id
        JOIN services s ON s.id = bs.service_id
       WHERE bsv.booking_id = bk.id), '[]'::jsonb),
    -- ⚠ The money block. One shared source; the drawer does no arithmetic.
    'commission', booking_commission_view(bk.id),
    'adminHistory', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'action', h.action, 'reasonCode', h.reason_code,
               'reasonNote', h.reason_note, 'changedAt', h.changed_at,
               'who', COALESCE(au.name, 'الإدارة')) ORDER BY h.changed_at DESC)
        FROM admin_booking_history h
        LEFT JOIN admin_users au ON au.auth_user_id = h.changed_by
       WHERE h.booking_id = bk.id), '[]'::jsonb)
  ) INTO v_out
  FROM bookings bk
  JOIN slots sl ON sl.id = bk.slot_id
  JOIN branches b ON b.id = bk.branch_id
  JOIN providers p ON p.id = b.provider_id
  LEFT JOIN users u ON u.id = bk.user_id
  WHERE bk.id = p_booking_id;

  RETURN COALESCE(v_out, jsonb_build_object('found', FALSE));
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ⑤ A07 — the ops overview. Cards, and detectors that answer BOTH directions.
--
-- ⚠ THE STALENESS DETECTOR READS THE REAL CRON HISTORY. `cron.job_run_details`
-- is unreadable by any client, so this is the only place the answer exists.
-- The threshold is 26h against a job that runs at 00:10 daily — two hours of
-- slack, so a slow night is not an alert and a genuinely missed run is.
-- PROGRESS once claimed this cron was «unscheduled» for nine days while the
-- database said otherwise; this makes the claim self-checking.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_ops_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_today      DATE := (NOW() AT TIME ZONE 'Africa/Cairo')::DATE;
  v_last_gen   TIMESTAMPTZ;
  v_alerts     JSONB := '[]'::JSONB;
  v_no_slots   JSONB;
  v_no_staff   JSONB;
  v_bookings   INT;
  v_cancels    INT;
  v_capacity   INT;
  v_booked     INT;
  v_branches   INT;
  v_open_slots INT;
  v_expected   BIGINT := 0;
  v_rate       NUMERIC;
  r            RECORD;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT MAX(d.end_time) INTO v_last_gen
    FROM cron.job_run_details d
    JOIN cron.job j ON j.jobid = d.jobid
   WHERE j.jobname = 'generate-slot-window' AND d.status = 'succeeded';

  IF v_last_gen IS NULL OR v_last_gen < NOW() - INTERVAL '26 hours' THEN
    v_alerts := v_alerts || jsonb_build_object(
      'kind', 'slot_generation_stale',
      'severity', 'high',
      'lastSuccessAt', v_last_gen,
      'affectedBranches', (SELECT COUNT(*)::INT FROM branches WHERE COALESCE(is_active, FALSE))
    );
  END IF;

  -- Visible to patients, nothing bookable — the worst possible pairing.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'branchId', x.id, 'branchNameAr', x.name_ar, 'lastBookableDate', x.last_date)), '[]'::jsonb)
    INTO v_no_slots
    FROM (
      SELECT b.id, b.name_ar,
             (SELECT MAX(s.slot_date) FROM slots s
               WHERE s.branch_id = b.id AND COALESCE(s.booked_count,0) < COALESCE(s.capacity,0)
                 AND NOT COALESCE(s.is_blocked, FALSE)) AS last_date
        FROM branches b
        JOIN providers p ON p.id = b.provider_id
       WHERE COALESCE(b.is_active, FALSE) AND COALESCE(p.is_active, FALSE)
         AND NOT EXISTS (
           SELECT 1 FROM slots s
            WHERE s.branch_id = b.id AND s.slot_date = v_today
              AND NOT COALESCE(s.is_blocked, FALSE)
              AND COALESCE(s.booked_count, 0) < COALESCE(s.capacity, 0))
    ) x;

  IF jsonb_array_length(v_no_slots) > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'kind', 'branch_no_bookable_slots_today', 'severity', 'high', 'branches', v_no_slots);
  END IF;

  -- A05 made this real data: a branch nobody can open the portal for, with
  -- bookings still arriving at it.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'branchId', y.id, 'branchNameAr', y.name_ar, 'upcomingBookings', y.upcoming)), '[]'::jsonb)
    INTO v_no_staff
    FROM (
      SELECT b.id, b.name_ar,
             (SELECT COUNT(*)::INT FROM bookings bk
                JOIN slots s ON s.id = bk.slot_id
               WHERE bk.branch_id = b.id
                 AND bk.status IN ('pending_payment','confirmed','arrived')
                 AND s.slot_date >= v_today) AS upcoming
        FROM branches b
        JOIN providers p ON p.id = b.provider_id
       WHERE COALESCE(b.is_active, FALSE) AND COALESCE(p.is_active, FALSE)
         AND NOT EXISTS (
           SELECT 1 FROM provider_users pu
            WHERE COALESCE(pu.is_active, FALSE)
              AND b.id = ANY (COALESCE(pu.branch_ids, '{}'::UUID[])))
    ) y;

  IF jsonb_array_length(v_no_staff) > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'kind', 'branch_no_active_staff', 'severity', 'medium', 'branches', v_no_staff);
  END IF;

  SELECT COUNT(*) FILTER (WHERE bk.status <> 'cancelled')::INT,
         COUNT(*) FILTER (WHERE bk.status = 'cancelled')::INT
    INTO v_bookings, v_cancels
    FROM bookings bk JOIN slots s ON s.id = bk.slot_id
   WHERE s.slot_date = v_today;

  SELECT COALESCE(SUM(COALESCE(s.capacity,0)),0)::INT,
         COALESCE(SUM(COALESCE(s.booked_count,0)),0)::INT
    INTO v_capacity, v_booked
    FROM slots s JOIN branches b ON b.id = s.branch_id
   WHERE s.slot_date = v_today AND COALESCE(b.is_active, FALSE)
     AND NOT COALESCE(s.is_blocked, FALSE);

  SELECT COUNT(*)::INT INTO v_branches
    FROM branches b JOIN providers p ON p.id = b.provider_id
   WHERE COALESCE(b.is_active, FALSE) AND COALESCE(p.is_active, FALSE);

  SELECT COUNT(*)::INT INTO v_open_slots
    FROM slots s JOIN branches b ON b.id = s.branch_id
   WHERE s.slot_date >= v_today AND COALESCE(b.is_active, FALSE)
     AND NOT COALESCE(s.is_blocked, FALSE)
     AND COALESCE(s.booked_count,0) < COALESCE(s.capacity,0);

  -- Month-to-date EXPECTED commission. A02's rate helper per booking, summed —
  -- ⚠ NOT a statement, and the card says so in the frame's subline.
  FOR r IN
    SELECT bk.id, bk.total_amount, br.provider_id,
           (bk.created_at AT TIME ZONE 'Africa/Cairo')::DATE AS event_date
      FROM bookings bk
      JOIN branches br ON br.id = bk.branch_id
     WHERE bk.status IN ('confirmed','arrived','completed')
       AND (bk.created_at AT TIME ZONE 'Africa/Cairo')::DATE >= date_trunc('month', v_today)::DATE
  LOOP
    v_rate := commission_rate_at(r.provider_id, r.event_date);
    IF v_rate IS NOT NULL THEN
      v_expected := v_expected + commission_piasters(ROUND(COALESCE(r.total_amount,0)*100)::BIGINT, v_rate);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'today', v_today,
    'cards', jsonb_build_object(
      'bookingsToday', COALESCE(v_bookings,0),
      'cancellationsToday', COALESCE(v_cancels,0),
      'fillPercent', CASE WHEN COALESCE(v_capacity,0) = 0 THEN 0
                          ELSE ROUND(v_booked::NUMERIC * 100 / v_capacity, 1) END,
      'capacityToday', COALESCE(v_capacity,0),
      'bookedToday', COALESCE(v_booked,0),
      'expectedCommissionPiasters', v_expected),
    'alerts', v_alerts,
    -- The honest-green state lists what was CHECKED, per the frame — an empty
    -- div teaches nothing.
    'checked', jsonb_build_array(
      'توليد المواعيد الليلي', 'فروع بلا مواعيد متاحة اليوم', 'فروع بلا حساب نشط'),
    'network', jsonb_build_object('activeBranches', COALESCE(v_branches,0),
                                  'openSlots', COALESCE(v_open_slots,0)),
    'lastGenerationAt', v_last_gen
  );
END;
$$;

-- ⑥ «شغّل التوليد الآن» — REUSES the nightly job's exact body rather than
-- reimplementing it. Verified from `cron.job`: a per-branch loop over
-- generate_branch_slots for a 30-day window, which has succeeded nightly at 24
-- branches, so the §5 statement-timeout warning does not bite at this size.
CREATE OR REPLACE FUNCTION public.admin_run_slot_generation()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_before INT;
  v_after  INT;
  b        RECORD;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT COUNT(*)::INT INTO v_before FROM slots;
  FOR b IN SELECT id FROM branches WHERE is_active = TRUE AND holiday_mode IS NOT TRUE LOOP
    PERFORM generate_branch_slots(b.id, CURRENT_DATE, CURRENT_DATE + 30);
  END LOOP;
  SELECT COUNT(*)::INT INTO v_after FROM slots;

  RETURN jsonb_build_object('success', TRUE, 'slotsCreated', GREATEST(0, v_after - v_before));
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ⑦ Grants.
-- ───────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.admin_cancel_booking(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_booking(UUID, TEXT, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_admin_bookings(TEXT, UUID, TEXT, DATE, DATE, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_bookings(TEXT, UUID, TEXT, DATE, DATE, INT, INT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_admin_booking_detail(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_booking_detail(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_ops_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_ops_overview() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_run_slot_generation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_run_slot_generation() TO authenticated, service_role;
