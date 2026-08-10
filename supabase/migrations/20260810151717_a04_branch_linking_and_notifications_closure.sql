-- A04 (ruling) · branch-service LINKING is an admin act — and the eleventh
-- policy closes.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⓪ THE RULING, AND WHAT IT CHANGES ABOUT «بلا سعر»
-- ═══════════════════════════════════════════════════════════════════════════
-- Founder ruling (2026-08-10) on the un-actionable-rows risk A04 opened: no
-- 624-pair backfill. Linking a service to a branch becomes an explicit ADMIN
-- act — «أضف فرعاً» on the service detail's price table — creating the pairing
-- row UNPRICED AND HIDDEN, landing directly in the drawn
-- «بلا سعر — لن تظهر» state with its nudge. The partner then prices it via P03
-- to surface it. No unlink in v1.
--
-- The ownership map, for the record:
--   definition = admin · link = admin (an onboarding act,
--   DECISION-provider-data-model §2) · price = partner.
--
-- ⚠ THAT REDEFINES WHAT THE PRICE TABLE SHOWS, and the redefinition is the
-- point rather than a side effect. Until now `service_branch_pricing` LEFT
-- JOINed from every active branch, so a branch that had never been linked
-- rendered as «بلا سعر» beside one that was linked and merely unpriced. The two
-- look identical and are not: the second is actionable (the partner has a row
-- to edit), the FIRST IS NOT — the nudge reaches the partner and there is
-- nothing in their editor to price. That is exactly the risk this ruling
-- closes, so the join becomes INNER and an unlinked branch simply is not
-- offering the service. Every «بلا سعر» row on the screen is now one a partner
-- can actually act on.
--
-- The unlinked branches do not disappear — they become the «أضف فرعاً» picker's
-- contents, returned as `linkableBranches` by the same function, so the table
-- and the picker cannot disagree about which branch is which.

-- ───────────────────────────────────────────────────────────────────────────
-- ① The writer. Standing pattern: DEFINER, own admin check, audit row,
--    explicit grants.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_link_service_to_branch(
  p_service_id UUID,
  p_branch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_service  TEXT;
  v_branch   TEXT;
  v_provider TEXT;
  v_new_id   UUID;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT name_ar INTO v_service FROM services WHERE id = p_service_id;
  IF v_service IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'service_not_found');
  END IF;

  -- The branch must be live AND its provider live: linking a service to a
  -- delisted branch would create a row nobody can ever reach, and the picker
  -- never offers one, so arriving here means a stale page.
  SELECT b.name_ar, p.name_ar INTO v_branch, v_provider
    FROM branches b JOIN providers p ON p.id = b.provider_id
   WHERE b.id = p_branch_id
     AND COALESCE(b.is_active, FALSE) AND COALESCE(p.is_active, FALSE);
  IF v_branch IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'branch_not_found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM branch_services WHERE service_id = p_service_id AND branch_id = p_branch_id
  ) THEN
    -- Idempotent rather than an error: two clicks, or a stale picker, must not
    -- produce a second row for a pair that is already linked.
    RETURN jsonb_build_object('success', TRUE, 'unchanged', TRUE, 'error', 'already_linked');
  END IF;

  -- ⚠ UNPRICED AND HIDDEN, per the ruling. `price` NULL is what makes the row
  -- «بلا سعر — لن تظهر»; `is_available` FALSE means the partner has not yet
  -- agreed to offer it either. Both gates are the partner's to open, and P03's
  -- editor sets them together in one save.
  INSERT INTO branch_services (branch_id, service_id, price, is_available)
  VALUES (p_branch_id, p_service_id, NULL, FALSE)
  RETURNING id INTO v_new_id;

  INSERT INTO service_catalog_history (service_id, action, old_values, new_values, changed_by)
  VALUES (p_service_id, 'service_linked_to_branch', '{}'::JSONB,
          jsonb_build_object('branch_id', p_branch_id, 'branch_name_ar', v_branch,
                             'provider_name_ar', v_provider),
          v_uid);

  RETURN jsonb_build_object('success', TRUE, 'branchServiceId', v_new_id,
                            'branchNameAr', v_branch, 'providerNameAr', v_provider);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_link_service_to_branch(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_link_service_to_branch(UUID, UUID) TO authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- ② The price table shows LINKED branches; the picker gets the rest.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.service_branch_pricing(p_service_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
WITH linked AS (
  SELECT b.id AS branch_id,
         b.name_ar AS branch_name_ar,
         b.district,
         b.phone,
         b.whatsapp,
         p.name_ar AS provider_name_ar,
         bs.price,
         COALESCE(bs.is_available, FALSE) AS is_available,
         bs.updated_at AS priced_at,
         -- ONE definition of what a row means, so the table, the header and
         -- every dialog classify the same branch identically.
         CASE WHEN bs.price IS NULL THEN 'unpriced'
              WHEN NOT COALESCE(bs.is_available, FALSE) THEN 'switched_off'
              ELSE 'live' END AS state
    FROM branch_services bs
    JOIN branches b ON b.id = bs.branch_id
    JOIN providers p ON p.id = b.provider_id
   WHERE bs.service_id = p_service_id
     AND COALESCE(b.is_active, FALSE) AND COALESCE(p.is_active, FALSE)
),
linkable AS (
  SELECT b.id AS branch_id, b.name_ar AS branch_name_ar, p.name_ar AS provider_name_ar
    FROM branches b
    JOIN providers p ON p.id = b.provider_id
   WHERE COALESCE(b.is_active, FALSE) AND COALESCE(p.is_active, FALSE)
     AND NOT EXISTS (
       SELECT 1 FROM branch_services bs
        WHERE bs.branch_id = b.id AND bs.service_id = p_service_id
     )
)
SELECT jsonb_build_object(
  'branches', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'branchId', l.branch_id,
             'branchNameAr', l.branch_name_ar,
             'district', l.district,
             'phone', l.phone,
             'whatsapp', l.whatsapp,
             'providerNameAr', l.provider_name_ar,
             'priceEgp', l.price,
             'state', l.state,
             'pricedAt', l.priced_at
           ) ORDER BY l.provider_name_ar, l.branch_name_ar)
      FROM linked l), '[]'::jsonb),
  -- «أضف فرعاً». Same shape as a table row so the picker and the table cannot
  -- disagree about which branch is which.
  'linkableBranches', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'branchId', k.branch_id,
             'branchNameAr', k.branch_name_ar,
             'providerNameAr', k.provider_name_ar
           ) ORDER BY k.provider_name_ar, k.branch_name_ar)
      FROM linkable k), '[]'::jsonb),
  'pricedCount',      (SELECT COUNT(*)::INT FROM linked WHERE state = 'live'),
  'unpricedCount',    (SELECT COUNT(*)::INT FROM linked WHERE state = 'unpriced'),
  'switchedOffCount', (SELECT COUNT(*)::INT FROM linked WHERE state = 'switched_off'),
  'branchCount',      (SELECT COUNT(*)::INT FROM linked),
  'linkableCount',    (SELECT COUNT(*)::INT FROM linkable),
  'providerCount',    (SELECT COUNT(DISTINCT provider_name_ar)::INT FROM linked WHERE state = 'live'),
  'minPriceEgp',      (SELECT MIN(price) FROM linked WHERE state = 'live'),
  'maxPriceEgp',      (SELECT MAX(price) FROM linked WHERE state = 'live'),
  'unpricedNames', COALESCE((
    SELECT jsonb_agg(l.branch_name_ar ORDER BY l.branch_name_ar)
      FROM linked l WHERE l.state = 'unpriced'), '[]'::jsonb)
)
$$;

REVOKE ALL ON FUNCTION public.service_branch_pricing(UUID) FROM PUBLIC, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- ③ Creation links the whole network, and now agrees with ② about the state
--    it leaves behind.
--
-- ⚠ It previously inserted `is_available = TRUE` with a NULL price ("the branch
-- is willing, the number is missing"). The ruling defines a linked-but-unpriced
-- row as unpriced AND hidden, so the two paths that create the same row must
-- create the SAME row — otherwise a service created today and a branch linked
-- tomorrow behave differently the moment a partner prices them, and «بلا سعر»
-- hides the difference until then. Aligned to FALSE.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_create_service(
  p_name_ar TEXT,
  p_name_en TEXT,
  p_code TEXT,
  p_category_id UUID,
  p_preparation_notes_ar TEXT DEFAULT NULL,
  p_preparation_notes_en TEXT DEFAULT NULL,
  p_tat_hours INT DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_code    TEXT := NULLIF(UPPER(TRIM(COALESCE(p_code, ''))), '');
  v_err     TEXT;
  v_id      UUID;
  v_offered INT;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_err := validate_service_definition(p_name_ar, p_name_en, v_code, p_category_id,
                                       p_preparation_notes_ar, p_preparation_notes_en, p_tat_hours);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', v_err);
  END IF;

  IF v_code IS NOT NULL AND EXISTS (SELECT 1 FROM services WHERE code = v_code) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'code_taken');
  END IF;

  INSERT INTO services (name_ar, name_en, code, category_id,
                        preparation_notes_ar, preparation_notes_en,
                        default_tat_hours, status)
  VALUES (TRIM(p_name_ar), TRIM(p_name_en), v_code, p_category_id,
          NULLIF(TRIM(COALESCE(p_preparation_notes_ar, '')), ''),
          NULLIF(TRIM(COALESCE(p_preparation_notes_en, '')), ''),
          p_tat_hours, 'draft')
  RETURNING id INTO v_id;

  -- Linking the whole live network at creation is itself the onboarding act
  -- DECISION-provider-data-model §2 describes — «onboard the FULL menu» — and
  -- it is what the frame draws, listing every network branch for a service
  -- still in draft. «أضف فرعاً» then covers the branches that did not exist
  -- yet, and the services that predate this feature.
  INSERT INTO branch_services (branch_id, service_id, price, is_available)
  SELECT b.id, v_id, NULL, FALSE
    FROM branches b
    JOIN providers p ON p.id = b.provider_id
   WHERE COALESCE(b.is_active, FALSE) AND COALESCE(p.is_active, FALSE);
  GET DIAGNOSTICS v_offered = ROW_COUNT;

  INSERT INTO service_catalog_history (service_id, action, old_values, new_values, changed_by)
  VALUES (v_id, 'service_created', '{}'::JSONB,
          jsonb_build_object('name_ar', TRIM(p_name_ar), 'code', v_code, 'status', 'draft',
                             'linked_branches', v_offered),
          v_uid);

  RETURN jsonb_build_object('success', TRUE, 'service_id', v_id, 'linkedBranches', v_offered);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ④ ⚠ THE ELEVENTH AND LAST OF A01'S LIST — `notifications`.
--
-- Founder ruling: close it in this PR. It is A03's own closing note's eleventh
-- entry, dropped from the hand-off's list of five, and it is the same shape as
-- the other ten: `FOR ALL USING (get_user_role() = 'admin')` with a NULL
-- with_check — column-blind — over a table still carrying the blanket Supabase
-- DML grant. RLS was the only gate.
--
-- ⚠ MEASURED, and it is the widest grant left in the schema: `notifications`
-- carries INSERT **and** UPDATE on ALL ELEVEN COLUMNS to `authenticated` AND to
-- `anon`. Compare `users`, whose grants were narrowed on 2026-08-03 and which
-- has no anon write grant at all:
--
--   | table         | anon        | authenticated                    |
--   | ------------- | ----------- | -------------------------------- |
--   | notifications | 11/11 I+U   | 11/11 I+U                        |
--   | users         | none        | 2/11 INSERT · 6/11 UPDATE        |
--
-- No policy today is satisfiable by anon (both notification policies need
-- auth.uid() or the admin role), so the anon grant is not currently reachable —
-- but it is one permissive policy away from being, and that is the arrangement
-- REFACTOR 1/N exists to stop: policy and grant are independent mechanisms and
-- this table needs both shut.
--
-- What it let an admin's BROWSER do: INSERT or rewrite any notification row —
-- `recipient`, `message`, `status`, `sent_at`, `booking_id` — i.e. forge the
-- record of what was sent to a patient and when, or mark an unsent reminder
-- `sent`. That is the delivery audit trail for a booking, and the only reason
-- it looks harmless is that nothing reads it back for money. It is still a
-- record of what we told a patient.
--
-- It closes with NO replacement, exactly as `branch_services` did, because the
-- admin has no business writing it at all. Verified the only writers anywhere
-- in apps/, packages/ or supabase/functions/ are `booking-reminder` and
-- `settle-payment`, both Edge Functions on the SERVICE ROLE, which bypasses RLS
-- and needs no policy.
--
-- Admin READS survive: the escape hatch is in «notifications: user sees own»
-- («(user_id = auth.uid()) OR (get_user_role() = 'admin')»), which stays.
--
-- ⚠ ELEVEN OF ELEVEN — and the arithmetic is worth stating because it is not
-- "eleven policies dropped". TEN were dropped or replaced by writers. The
-- eleventh, `users`, still HAS its admin `ALL` policy and is nonetheless closed:
-- its GRANT was narrowed to 2 insertable and 6 updatable columns on 2026-08-03,
-- and the grant is the ceiling a policy can never raise. So every one of A01's
-- eleven column-blind admin write surfaces is now shut — nine of them by
-- deleting the door, one by replacing it with a writer, one by shrinking it.
--
-- Also revoke the grants, so this table stops being a policy away from open.
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notifications: admin full access" ON public.notifications;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
  ON public.notifications FROM anon, authenticated;
REVOKE ALL ON public.notifications FROM anon;
