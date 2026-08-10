-- A03 · the admin's write path for the network and its commercial terms.
--
-- A03's opening decision, exactly as A02's was: it BUILDS the writer functions
-- for `providers` and `branches`, so it CLOSES the column-blind admin `ALL`
-- policies on both — plus `slots`, which no human should ever write by hand.
-- Three more of the nine A01 flagged. See ⑥ at the bottom.

-- ───────────────────────────────────────────────────────────────────────────
-- ① Provider-level audit — the table SPEC-A03 assumed already existed.
--
-- ⚠ IT DID NOT. The spec says to write "audit rows into the existing branch
-- history … same for provider fields", and a survey of the live catalog found
-- only `branch_profile_history` and `branch_service_price_history` — both
-- branch-scoped. Provider edits, INCLUDING RATE CHANGES, had nowhere to land.
-- A rate change is the single most consequential edit in the admin panel; it
-- cannot be the one with no trail. Mirrors branch_profile_history exactly so
-- the shared audit panel can read either with one component.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE public.provider_profile_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  old_values  JSONB NOT NULL,
  new_values  JSONB NOT NULL,
  changed_by  UUID REFERENCES auth.users(id),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX provider_profile_history_by_provider
  ON public.provider_profile_history (provider_id, changed_at DESC);

COMMENT ON TABLE public.provider_profile_history IS
  'Admin edits to a provider, including commission-rate changes. Read-only, append-only, never pruned — mirrors branch_profile_history.';

ALTER TABLE public.provider_profile_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider history: admin reads"
  ON public.provider_profile_history FOR SELECT
  USING (public.get_user_role() = 'admin');

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
  ON public.provider_profile_history FROM anon, authenticated;
REVOKE ALL ON public.provider_profile_history FROM anon;

-- ───────────────────────────────────────────────────────────────────────────
-- ② THE RATE EDITOR — the writer A02 built the truth for.
--
-- Append-only is already enforced by a trigger, so this function cannot UPDATE
-- even by accident. What it adds is the two rules the DESIGN states and the
-- database cannot know:
--
--   · «لا يمكن أن يكون التاريخ في الماضي» — effective_from must be strictly
--     FUTURE. A back-dated rate would silently re-price bookings whose
--     commission already attached, and A02's statements are computed from
--     `commission_rate_at(provider, event_date)` — so a past date changes what
--     a partner is owed for a month that may already be SETTLED. Refused here,
--     server-side, not merely disabled in the UI.
--   · Every change writes an audit row naming who did it.
--
-- ⚠ The written-acknowledgment checkbox from the approved frame is a UI
-- concern and is NOT enforced here — the spec says so explicitly. What IS
-- enforced is the audit row, so the record of who changed the rate and when
-- exists whether or not the UI behaved.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_provider_commission_rate(
  p_provider_id UUID,
  p_percent NUMERIC,
  p_effective_from DATE,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_today   DATE := (NOW() AT TIME ZONE 'Africa/Cairo')::DATE;
  v_current NUMERIC;
  v_name    TEXT;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT name_ar INTO v_name FROM providers WHERE id = p_provider_id;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'provider_not_found');
  END IF;

  IF p_percent IS NULL OR p_percent <= 0 OR p_percent > 100 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_percent');
  END IF;

  -- STRICTLY future. Today is refused too: a rate effective "today" would apply
  -- to completions recorded earlier this morning, which is the same retroactive
  -- re-pricing by a smaller margin.
  IF p_effective_from IS NULL OR p_effective_from <= v_today THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'effective_from_must_be_future',
                              'today', v_today);
  END IF;

  IF EXISTS (
    SELECT 1 FROM provider_commission_rates
     WHERE provider_id = p_provider_id AND effective_from = p_effective_from
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'rate_already_set_for_that_date');
  END IF;

  SELECT percent INTO v_current
    FROM provider_commission_rates
   WHERE provider_id = p_provider_id AND effective_from <= v_today
   ORDER BY effective_from DESC LIMIT 1;

  INSERT INTO provider_commission_rates (provider_id, percent, effective_from, note, created_by)
  VALUES (p_provider_id, p_percent, p_effective_from, p_note, v_uid);

  INSERT INTO provider_profile_history (provider_id, old_values, new_values, changed_by)
  VALUES (
    p_provider_id,
    jsonb_build_object('commission_percent', v_current),
    jsonb_build_object('commission_percent', p_percent, 'effective_from', p_effective_from),
    v_uid
  );

  RETURN jsonb_build_object('success', TRUE, 'previous_percent', v_current,
                            'percent', p_percent, 'effective_from', p_effective_from);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ③ admin_update_provider — the admin-owned provider fields.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_provider(
  p_provider_id UUID,
  p_name_ar TEXT,
  p_name_en TEXT,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.providers%ROWTYPE;
  v_old JSONB := '{}'::JSONB;
  v_new JSONB := '{}'::JSONB;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_row FROM providers WHERE id = p_provider_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'provider_not_found');
  END IF;

  IF COALESCE(TRIM(p_name_ar), '') = '' OR COALESCE(TRIM(p_name_en), '') = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'name_required');
  END IF;

  -- Only CHANGED keys enter the audit row — the same diffing
  -- `update_branch_profile` does, so the panel never shows a no-op edit.
  IF v_row.name_ar IS DISTINCT FROM p_name_ar THEN
    v_old := v_old || jsonb_build_object('name_ar', v_row.name_ar);
    v_new := v_new || jsonb_build_object('name_ar', p_name_ar);
  END IF;
  IF v_row.name_en IS DISTINCT FROM p_name_en THEN
    v_old := v_old || jsonb_build_object('name_en', v_row.name_en);
    v_new := v_new || jsonb_build_object('name_en', p_name_en);
  END IF;
  IF v_row.is_active IS DISTINCT FROM p_is_active THEN
    v_old := v_old || jsonb_build_object('is_active', v_row.is_active);
    v_new := v_new || jsonb_build_object('is_active', p_is_active);
  END IF;

  IF v_new = '{}'::JSONB THEN
    RETURN jsonb_build_object('success', TRUE, 'unchanged', TRUE);
  END IF;

  UPDATE providers
     SET name_ar = p_name_ar, name_en = p_name_en,
         is_active = p_is_active, updated_at = NOW()
   WHERE id = p_provider_id;

  INSERT INTO provider_profile_history (provider_id, old_values, new_values, changed_by)
  VALUES (p_provider_id, v_old, v_new, v_uid);

  RETURN jsonb_build_object('success', TRUE, 'changed', v_new);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ④ admin_update_branch — the fields the partner portal LOCKS.
--
-- ⚠ ALLOCATION AND HOURS ARE DELIBERATELY NOT HERE. Both reshape the slot grid,
-- and the approved dialog promises a count of what will be deleted and rebuilt
-- before anything happens. They go through the preview/apply pair in the next
-- migration, so there is no way to change them without producing those numbers.
--
-- ⚠ AND `rating` / `review_count` ARE NOT WRITABLE BY ANYONE. They were the
-- worst of the branches hole — a partner setting their own rating is fraud
-- against patients choosing a provider. `recalculate_branch_rating()` owns them.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_branch(
  p_branch_id UUID,
  p_name_ar TEXT,
  p_name_en TEXT,
  p_district TEXT,
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.branches%ROWTYPE;
  v_old JSONB := '{}'::JSONB;
  v_new JSONB := '{}'::JSONB;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_row FROM branches WHERE id = p_branch_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'branch_not_found');
  END IF;

  IF COALESCE(TRIM(p_name_ar), '') = '' OR COALESCE(TRIM(p_name_en), '') = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'name_required');
  END IF;

  -- A pin outside Egypt is a typo, and it silently corrupts every distance the
  -- patient app shows. Bounds are generous on purpose.
  IF p_lat IS NOT NULL AND (p_lat < 21 OR p_lat > 32) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'lat_out_of_range');
  END IF;
  IF p_lng IS NOT NULL AND (p_lng < 24 OR p_lng > 37) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'lng_out_of_range');
  END IF;

  IF v_row.name_ar IS DISTINCT FROM p_name_ar THEN
    v_old := v_old || jsonb_build_object('name_ar', v_row.name_ar);
    v_new := v_new || jsonb_build_object('name_ar', p_name_ar);
  END IF;
  IF v_row.name_en IS DISTINCT FROM p_name_en THEN
    v_old := v_old || jsonb_build_object('name_en', v_row.name_en);
    v_new := v_new || jsonb_build_object('name_en', p_name_en);
  END IF;
  IF v_row.district IS DISTINCT FROM p_district THEN
    v_old := v_old || jsonb_build_object('district', v_row.district);
    v_new := v_new || jsonb_build_object('district', p_district);
  END IF;
  IF v_row.lat IS DISTINCT FROM p_lat OR v_row.lng IS DISTINCT FROM p_lng THEN
    v_old := v_old || jsonb_build_object('lat', v_row.lat, 'lng', v_row.lng);
    v_new := v_new || jsonb_build_object('lat', p_lat, 'lng', p_lng);
  END IF;
  IF v_row.is_active IS DISTINCT FROM p_is_active THEN
    v_old := v_old || jsonb_build_object('is_active', v_row.is_active);
    v_new := v_new || jsonb_build_object('is_active', p_is_active);
  END IF;

  IF v_new = '{}'::JSONB THEN
    RETURN jsonb_build_object('success', TRUE, 'unchanged', TRUE);
  END IF;

  UPDATE branches
     SET name_ar = p_name_ar, name_en = p_name_en, district = p_district,
         lat = p_lat, lng = p_lng, is_active = p_is_active, updated_at = NOW()
   WHERE id = p_branch_id;

  INSERT INTO branch_profile_history (branch_id, old_values, new_values, changed_by)
  VALUES (p_branch_id, v_old, v_new, v_uid);

  RETURN jsonb_build_object('success', TRUE, 'changed', v_new);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ⑤ Grants. Postgres gives EXECUTE to PUBLIC by default.
-- ───────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.set_provider_commission_rate(UUID, NUMERIC, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_provider_commission_rate(UUID, NUMERIC, DATE, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_update_provider(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_provider(UUID, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_update_branch(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_branch(UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- ⑥ ⚠ A03'S OPENING DECISION — three more of A01's nine.
--
--   branches:  admin full access  → an admin's BROWSER could set `rating`,
--                                   `review_count` and `instahealth_slot_allocation`
--   providers: admin full access  → full row writes, unaudited
--   slots:     admin full access  → INSERT rows and raise `capacity`
--
-- All three are `ALL` policies with a NULL with_check — column-blind — over
-- tables carrying the full Supabase DML grant to `anon` and `authenticated`
-- (verified in the live catalog: SELECT/INSERT/UPDATE/DELETE/TRUNCATE for both
-- roles on all three). RLS was the only gate.
--
-- They close because A03 REPLACES them: `admin_update_provider` and
-- `admin_update_branch` above, the slot-shaping pair in the next migration, and
-- `generate_branch_slots` (service_role) for slots. Every one derives its
-- values server-side and writes an audit row, which a policy can never do.
--
-- Admin READS are unaffected — `providers: public read active`,
-- `branches: public read active` and `slots: patient sees available only` all
-- OR in the admin role and stay. Verified there are NO client writes to any of
-- the three anywhere in apps/, packages/ or supabase/functions/: every write is
-- an RPC or an Edge Function on the service role.
--
-- Six of the eleven A01 flagged are now closed. Remaining for A04/A05/F08:
-- service_categories, services, branch_services, provider_users, notifications,
-- users, and the reviews moderation gap.
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "branches: admin full access" ON public.branches;
DROP POLICY IF EXISTS "providers: admin full access" ON public.providers;
DROP POLICY IF EXISTS "slots: admin full access" ON public.slots;;
