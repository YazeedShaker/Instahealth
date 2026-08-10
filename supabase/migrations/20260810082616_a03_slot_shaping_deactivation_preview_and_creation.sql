-- A03 · slot-shaping, the consequence previews, and onboarding.

-- ───────────────────────────────────────────────────────────────────────────
-- ① preview_branch_slot_shape — the numbers the confirm dialog promises.
--
-- The approved dialog does not say "this will regenerate slots". It says:
--   «٤ حجوزات قائمة في الأيام القادمة تبقى كما هي»
--   «مواعيد فارغة تُحذف وتُبنى من جديد — ٢٣٦ موعداً»
--   «النطاق — ٦ أغسطس … ٤ سبتمبر»
-- Those are counts, and SPEC-A03 requires that the dialog's numbers ARE the
-- function's numbers. So the preview and the apply share this one function:
-- `apply_branch_slot_shape` CALLS it rather than re-deriving anything, which
-- makes divergence impossible instead of merely unlikely.
--
-- ⚠ "EMPTY" MEANS NO BOOKING **AND** NO LIVE HOLD. A slot with an unexpired
-- hold has a patient on the payment screen right now; deleting it would take
-- the slot out from under them mid-checkout. `booked_count = 0` alone does not
-- see that — holds are a separate table, which is the same blind spot that made
-- the F05 picker show "available" for a held slot.
--
-- ⚠ AND THE WINDOW STARTS TOMORROW. «حجوزات اليوم لا تتأثر» — today is left
-- alone entirely, because a branch is mid-day when this is pressed.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.preview_branch_slot_shape(
  p_branch_id UUID,
  p_allocation INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_today  DATE := (NOW() AT TIME ZONE 'Africa/Cairo')::DATE;
  v_from   DATE;
  v_to     DATE;
  v_branch public.branches%ROWTYPE;
  v_empty  INTEGER;
  v_booked INTEGER;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_branch FROM branches WHERE id = p_branch_id;
  IF v_branch.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'branch_not_found');
  END IF;
  IF p_allocation IS NULL OR p_allocation < 1 OR p_allocation > 60 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_allocation');
  END IF;

  v_from := v_today + 1;
  v_to   := v_today + 30;

  SELECT
    COUNT(*) FILTER (
      WHERE s.booked_count = 0
        AND NOT EXISTS (
          SELECT 1 FROM slot_holds h
           WHERE h.slot_id = s.id AND h.expires_at > NOW()
        )
    ),
    COUNT(*) FILTER (WHERE s.booked_count > 0)
  INTO v_empty, v_booked
  FROM slots s
  WHERE s.branch_id = p_branch_id AND s.slot_date BETWEEN v_from AND v_to;

  RETURN jsonb_build_object(
    'success', TRUE,
    'branch_id', p_branch_id,
    'current_allocation', v_branch.instahealth_slot_allocation,
    'new_allocation', p_allocation,
    'from_date', v_from,
    'to_date', v_to,
    -- What the dialog calls «مواعيد فارغة تُحذف وتُبنى من جديد».
    'empty_slots_rebuilt', v_empty,
    -- «حجوزات قائمة … تبقى كما هي» — untouched, and counted so the founder can
    -- see the promise is not empty.
    'standing_bookings', v_booked,
    'resulting_per_day', p_allocation
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ② apply_branch_slot_shape — delete the empty future, then REGENERATE.
--
-- ⚠ THE SPEC SAYS "REUSE `generate_branch_slots` — DO NOT REIMPLEMENT", AND
-- THAT IS ONLY HALF OF WHAT IS NEEDED. Read live, that function contains no
-- DELETE at all and never reads `booked_count`: it is purely additive, an
-- `INSERT … ON CONFLICT (branch_id, slot_date, slot_time) DO NOTHING`. Lowering
-- an allocation from 12 to 8 by calling it would therefore change NOTHING — the
-- twelve old rows stay and the insert conflicts away — and the founder would be
-- shown a confirm dialog promising a rebuild that did not happen.
--
-- So the reuse is real but partial: this function owns the DELETE the generator
-- lacks, and delegates every bit of capacity and spacing arithmetic to the
-- generator, which stays the single definition of "what a day looks like".
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_branch_slot_shape(
  p_branch_id UUID,
  p_allocation INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_preview   JSONB;
  v_from      DATE;
  v_to        DATE;
  v_old_alloc INTEGER;
  v_deleted   INTEGER;
  v_created   INTEGER;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- The preview is the contract. Calling it means the applied action can never
  -- be computed from a different rule than the one the founder was shown.
  v_preview := preview_branch_slot_shape(p_branch_id, p_allocation);
  IF (v_preview ->> 'success')::BOOLEAN IS NOT TRUE THEN
    RETURN v_preview;
  END IF;

  v_from      := (v_preview ->> 'from_date')::DATE;
  v_to        := (v_preview ->> 'to_date')::DATE;
  v_old_alloc := (v_preview ->> 'current_allocation')::INTEGER;

  UPDATE branches
     SET instahealth_slot_allocation = p_allocation, updated_at = NOW()
   WHERE id = p_branch_id;

  -- Exactly the rows the preview counted, re-selected by the SAME predicate.
  WITH doomed AS (
    DELETE FROM slots s
     WHERE s.branch_id = p_branch_id
       AND s.slot_date BETWEEN v_from AND v_to
       AND s.booked_count = 0
       AND NOT EXISTS (
         SELECT 1 FROM slot_holds h WHERE h.slot_id = s.id AND h.expires_at > NOW()
       )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM doomed;

  -- The generator owns capacity and spacing. It is additive, which is exactly
  -- right now that the stale rows are gone.
  SELECT generate_branch_slots(p_branch_id, v_from, v_to) INTO v_created;

  INSERT INTO branch_profile_history (branch_id, old_values, new_values, changed_by)
  VALUES (
    p_branch_id,
    jsonb_build_object('instahealth_slot_allocation', v_old_alloc),
    jsonb_build_object('instahealth_slot_allocation', p_allocation,
                       'slots_deleted', v_deleted, 'slots_created', v_created),
    v_uid
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'from_date', v_from, 'to_date', v_to,
    'previewed_empty_slots', (v_preview ->> 'empty_slots_rebuilt')::INTEGER,
    'slots_deleted', v_deleted,
    'slots_created', v_created,
    'standing_bookings_untouched', (v_preview ->> 'standing_bookings')::INTEGER
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ③ preview_provider_deactivation — the escalated confirm's numbers.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.preview_provider_deactivation(p_provider_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_today DATE := (NOW() AT TIME ZONE 'Africa/Cairo')::DATE;
  v_names TEXT[];
  v_count INTEGER;
  v_bookings INTEGER;
  v_slots INTEGER;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT array_agg(b.name_ar ORDER BY b.name_ar), COUNT(*)
    INTO v_names, v_count
    FROM branches b WHERE b.provider_id = p_provider_id AND b.is_active = TRUE;

  -- «حجزاً قائماً لا تتأثر» — confirmed/arrived bookings from today forward.
  -- They are still served: deactivation hides the branch from DISCOVERY, it
  -- does not cancel anything.
  SELECT COUNT(*) INTO v_bookings
    FROM bookings bk
    JOIN branches b ON b.id = bk.branch_id
    JOIN slots s ON s.id = bk.slot_id
   WHERE b.provider_id = p_provider_id
     AND bk.status IN ('confirmed', 'arrived')
     AND s.slot_date >= v_today;

  SELECT COUNT(*) INTO v_slots
    FROM slots s JOIN branches b ON b.id = s.branch_id
   WHERE b.provider_id = p_provider_id
     AND s.slot_date >= v_today AND s.booked_count = 0;

  RETURN jsonb_build_object(
    'success', TRUE,
    'branch_count', COALESCE(v_count, 0),
    'branch_names', COALESCE(to_jsonb(v_names), '[]'::JSONB),
    'standing_bookings', COALESCE(v_bookings, 0),
    'empty_slots_hidden', COALESCE(v_slots, 0)
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ④ Onboarding. A provider CANNOT exist without a rate.
--
-- ⚠ THE INITIAL RATE IS EFFECTIVE TODAY, NOT IN THE FUTURE — the one deliberate
-- exception to `set_provider_commission_rate`'s future-only rule. That rule
-- exists to stop a rate change RE-PRICING bookings whose commission already
-- attached; a provider created seconds ago has no bookings, so there is nothing
-- to re-price. Requiring a future date here instead would create a window in
-- which the provider exists, can be booked, and has no rate — and A02's
-- `commission_rate_at` THROWS on a missing rate, so that window would be a
-- statement that cannot be computed at all.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_create_provider(
  p_name_ar TEXT,
  p_name_en TEXT,
  p_percent NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_today DATE := (NOW() AT TIME ZONE 'Africa/Cairo')::DATE;
  v_id    UUID;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF COALESCE(TRIM(p_name_ar), '') = '' OR COALESCE(TRIM(p_name_en), '') = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'name_required');
  END IF;
  IF p_percent IS NULL OR p_percent <= 0 OR p_percent > 100 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_percent');
  END IF;

  INSERT INTO providers (name_ar, name_en, is_active)
  VALUES (p_name_ar, p_name_en, TRUE)
  RETURNING id INTO v_id;

  INSERT INTO provider_commission_rates (provider_id, percent, effective_from, note, created_by)
  VALUES (v_id, p_percent, v_today, 'Initial agreement rate, set at onboarding.', v_uid);

  INSERT INTO provider_profile_history (provider_id, old_values, new_values, changed_by)
  VALUES (v_id, '{}'::JSONB,
          jsonb_build_object('created', TRUE, 'name_ar', p_name_ar,
                             'commission_percent', p_percent), v_uid);

  RETURN jsonb_build_object('success', TRUE, 'provider_id', v_id,
                            'percent', p_percent, 'effective_from', v_today);
END;
$$;

-- A branch is born INACTIVE. «ظهر للمرضى» is its own consequential confirm,
-- because the moment it flips a real patient can book a real appointment at a
-- branch that may not know it exists yet.
CREATE OR REPLACE FUNCTION public.admin_create_branch(
  p_provider_id UUID,
  p_name_ar TEXT,
  p_name_en TEXT,
  p_district TEXT,
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_allocation INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id  UUID;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM providers WHERE id = p_provider_id) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'provider_not_found');
  END IF;
  IF COALESCE(TRIM(p_name_ar), '') = '' OR COALESCE(TRIM(p_name_en), '') = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'name_required');
  END IF;
  IF p_allocation IS NULL OR p_allocation < 1 OR p_allocation > 60 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_allocation');
  END IF;

  INSERT INTO branches (provider_id, name_ar, name_en, district, lat, lng,
                        instahealth_slot_allocation, is_active)
  VALUES (p_provider_id, p_name_ar, p_name_en, p_district, p_lat, p_lng,
          p_allocation, FALSE)
  RETURNING id INTO v_id;

  INSERT INTO branch_profile_history (branch_id, old_values, new_values, changed_by)
  VALUES (v_id, '{}'::JSONB,
          jsonb_build_object('created', TRUE, 'name_ar', p_name_ar,
                             'instahealth_slot_allocation', p_allocation,
                             'is_active', FALSE), v_uid);

  -- No slots are generated: `generate_branch_slots` returns 0 for an inactive
  -- branch by design. Activation is what makes it real, and activation goes
  -- through admin_update_branch + apply_branch_slot_shape.
  RETURN jsonb_build_object('success', TRUE, 'branch_id', v_id, 'is_active', FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.preview_branch_slot_shape(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_branch_slot_shape(UUID, INTEGER) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.apply_branch_slot_shape(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_branch_slot_shape(UUID, INTEGER) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.preview_provider_deactivation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_provider_deactivation(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_create_provider(TEXT, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_provider(TEXT, TEXT, NUMERIC) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_create_branch(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_branch(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER) TO authenticated, service_role;;
