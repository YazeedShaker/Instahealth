-- A04 · THE SERVICE CATALOG — the admin's dial, and the writers behind it.
--
-- A04's opening decision, exactly as A02's and A03's were: it BUILDS the writer
-- functions for `services` and `service_categories`, so it CLOSES the
-- column-blind admin `ALL` policies on both — plus `branch_services`, which the
-- admin deliberately never writes at all (price is the PARTNER's dial; admin
-- price editing is annotated v2 in the bundle). Three more of A01's eleven.
-- See ⑧ at the bottom.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⓪ TWO THINGS THE SPEC ASSUMED AND THE LIVE DATABASE DID NOT HAVE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ① SPEC-A04 says to "map the design's service states (مسودة/منشورة/موقوفة) to
--    the real schema first — read services' columns; if a draft/suspended
--    distinction is missing, add it by migration". It IS missing. `services`
--    carried exactly one boolean, `is_active`, TRUE on all 26 rows. The design
--    needs three states and its list header counts them separately
--    («١٤ خدمة · ١١ منشورة · ٢ مسودة · ١ موقوفة»).
--
-- ② ⚠ AND A HOLE THE SPEC DID NOT KNOW ABOUT: `create_pending_booking` checks
--    `services.is_active` but NOT `service_categories.is_active`. So the
--    category flag — which DECISION-provider-data-model calls THE launch switch,
--    and which A04 is meant to turn into a real dial — is today a DISPLAY
--    FILTER ONLY. Search filters on it, the branch profile filters on it, and
--    booking creation does not: a client holding a branch_service id it cached
--    seconds before the flip still books. Every one of the 6 `scans` services
--    has a live branch_services row today, so the flip is reachable with real
--    data. Closed in ④.
--
-- The same shape as every entry in ENGINEERING-WORKFLOW §5: the guard that
-- should have caught it was somewhere else entirely (a policy about display, a
-- function about the service).

-- ───────────────────────────────────────────────────────────────────────────
-- ① Catalog audit — one table, two subjects.
--
-- A service edit and a CATEGORY FLIP are both catalog history and both belong
-- in the panel the design draws, but a category flip is not about one service,
-- so a service-scoped table could not hold it. Exactly one of the two ids is
-- set; the CHECK is what stops a row that means nothing. Mirrors
-- provider_profile_history's {old_values, new_values} shape so the shared audit
-- component reads it with no changes.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE public.service_catalog_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id  UUID REFERENCES public.services(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.service_categories(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  old_values  JSONB NOT NULL DEFAULT '{}'::JSONB,
  new_values  JSONB NOT NULL DEFAULT '{}'::JSONB,
  changed_by  UUID REFERENCES auth.users(id),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT service_catalog_history_one_subject
    CHECK (num_nonnulls(service_id, category_id) = 1)
);

CREATE INDEX service_catalog_history_by_service
  ON public.service_catalog_history (service_id, changed_at DESC);
CREATE INDEX service_catalog_history_by_category
  ON public.service_catalog_history (category_id, changed_at DESC);

COMMENT ON TABLE public.service_catalog_history IS
  'Admin edits to the catalog: service definitions, service status changes, and category activation (THE launch switch). Read-only, append-only, never pruned.';
COMMENT ON COLUMN public.service_catalog_history.action IS
  'Its own label per action so the panel can name the deed: service_created, service_updated, service_published, service_suspended, category_activated, category_deactivated.';

ALTER TABLE public.service_catalog_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog history: admin reads"
  ON public.service_catalog_history FOR SELECT
  USING (public.get_user_role() = 'admin');

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
  ON public.service_catalog_history FROM anon, authenticated;
REVOKE ALL ON public.service_catalog_history FROM anon;

-- ───────────────────────────────────────────────────────────────────────────
-- ② THE THREE STATES — and why `is_active` becomes a MIRROR rather than dying.
--
-- `status` is the one dial. But `is_active` is read by four proven predicates
-- (the public-read policy, `search_catalog`, `create_pending_booking`, and the
-- mobile branch-profile filter), and the single most repeated mistake in this
-- schema is two facts that are supposed to agree and can drift apart. So
-- `is_active` is not deleted and it is not maintained — it is GENERATED from
-- `status`. It cannot be written by anyone, including a writer function with a
-- bug, and it cannot disagree with the dial BY CONSTRUCTION. Every reader that
-- already filters on it keeps working and stays correct for free.
--
-- draft     → never seen by a patient, never bookable
-- published → the only state that is is_active
-- suspended → hidden and unbookable, but keeps prices and prep notes so that
--             republishing restores it exactly (the confirm promises this)
--
-- Backfill: all 26 existing rows are live in the app today, so they are
-- 'published'. Defaulting them to draft would delist the entire catalog.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.services ADD COLUMN status TEXT;
UPDATE public.services SET status = CASE WHEN COALESCE(is_active, FALSE) THEN 'published' ELSE 'draft' END;
ALTER TABLE public.services
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'draft',
  ADD CONSTRAINT services_status_check CHECK (status IN ('draft', 'published', 'suspended'));

-- The policy depends on the column, so it goes first and comes back at the end
-- of this block reading the identical expression.
DROP POLICY IF EXISTS "services: public read active" ON public.services;
ALTER TABLE public.services DROP COLUMN is_active;
ALTER TABLE public.services
  ADD COLUMN is_active BOOLEAN
  GENERATED ALWAYS AS (status = 'published') STORED;

CREATE POLICY "services: public read active"
  ON public.services FOR SELECT
  USING ((is_active = TRUE) OR (public.get_user_role() = 'admin'));

COMMENT ON COLUMN public.services.status IS
  'THE admin dial: draft | published | suspended. Set only via admin_set_service_status.';
COMMENT ON COLUMN public.services.is_active IS
  'GENERATED from status — patient-facing mirror, not writable. Kept so every predicate that already reads it stays correct and can never drift from the dial.';

-- ───────────────────────────────────────────────────────────────────────────
-- ③ The definition fields the frame draws that the table did not have.
--
-- `code` (الرمز, e.g. VIT-D-01) is searchable in the list — «ابحث باسم الخدمة
-- أو رمزها». It is NULLABLE on purpose: the 26 seeded services have no real
-- codes, and inventing 26 of them here would be fabricated data in a table the
-- founder reads as truth. New services get one; the existing ones show «—»
-- until someone enters the real code.
--
-- `updated_at` backs «آخر تعديل» in the list. Backfilled to created_at rather
-- than NOW(), so the column does not open by claiming every service was edited
-- the moment this migration ran.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.services
  ADD COLUMN code TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.services SET updated_at = created_at WHERE created_at IS NOT NULL;

CREATE UNIQUE INDEX services_code_key ON public.services (code) WHERE code IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- ④ ⚠ THE HOLE FROM ⓪② — booking creation learns what discovery already knew.
--
-- One added JOIN. Everything else in this function is untouched, including the
-- deliberately-single `service_unavailable` error: distinguishing "category
-- off" from "service suspended" from "not at this branch" would tell a caller
-- things about the catalog it has no business learning, and the app re-fetches
-- the branch either way.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_pending_booking(
  p_slot_id uuid,
  p_branch_service_ids uuid[],
  p_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller     UUID := auth.uid();
  v_slot       slots;
  v_branch     branches;
  v_provider   providers;
  v_total      NUMERIC := 0;
  v_count      INT;
  v_booking_id UUID;
  v_ref        VARCHAR;
  v_notes      TEXT;
  v_lines      JSONB;
BEGIN
  -- A booking belongs to a signed-in patient. `auth.uid() IS NULL` is anon OR
  -- an internal caller; neither creates a patient booking, and treating NULL
  -- as trusted is the exact mistake cancel_booking made.
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  IF p_branch_service_ids IS NULL OR array_length(p_branch_service_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_services');
  END IF;

  SELECT * INTO v_slot FROM slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_not_found');
  END IF;
  IF COALESCE(v_slot.is_blocked, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_blocked');
  END IF;
  IF COALESCE(v_slot.booked_count, 0) >= COALESCE(v_slot.capacity, 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_full');
  END IF;

  -- The slot must be HELD by this caller. The hold is what reserves capacity
  -- between picking a time and paying for it; without this check a patient
  -- could create bookings on slots they never held.
  IF NOT EXISTS (
    SELECT 1 FROM slot_holds h
     WHERE h.slot_id = p_slot_id AND h.user_id = v_caller AND h.expires_at > NOW()
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_active_hold');
  END IF;

  SELECT * INTO v_branch FROM branches WHERE id = v_slot.branch_id;
  IF NOT FOUND OR NOT COALESCE(v_branch.is_active, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'branch_unavailable');
  END IF;

  SELECT * INTO v_provider FROM providers WHERE id = v_branch.provider_id;
  IF NOT FOUND OR NOT COALESCE(v_provider.is_active, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'provider_unavailable');
  END IF;

  -- Every requested line must be bookable AT THIS BRANCH. The count check is
  -- what closes the cross-branch hole: a branch_service belonging to another
  -- branch simply does not match, so the count comes up short and nothing is
  -- written. Duplicate ids collapse via DISTINCT, so a repeated id cannot
  -- inflate the total either.
  --
  -- ⚠ A04: the service_categories join is NEW. `s.is_active` is now generated
  -- from `services.status`, so draft and suspended fail here for free; the
  -- category flag is the part that had no server-side enforcement at all.
  SELECT COUNT(DISTINCT bs.id), COALESCE(SUM(bs.price), 0)
    INTO v_count, v_total
    FROM branch_services bs
    JOIN services s ON s.id = bs.service_id
    JOIN service_categories sc ON sc.id = s.category_id
   WHERE bs.id = ANY (p_branch_service_ids)
     AND bs.branch_id = v_slot.branch_id
     AND COALESCE(bs.is_available, FALSE)
     AND COALESCE(s.is_active, FALSE)
     AND COALESCE(sc.is_active, FALSE);

  IF v_count <> (SELECT COUNT(DISTINCT x) FROM unnest(p_branch_service_ids) AS x) THEN
    -- Deliberately one error for "not yours / not here / not active": the app
    -- re-fetches the branch either way, and distinguishing them would tell a
    -- caller which branch a service id belongs to.
    RETURN jsonb_build_object('success', false, 'error', 'service_unavailable');
  END IF;

  v_notes := NULLIF(BTRIM(COALESCE(p_notes, '')), '');

  -- total_amount is DERIVED. The client's displayed total is advisory: if a
  -- price moved mid-session the server's number wins and the app re-renders.
  INSERT INTO bookings (user_id, branch_id, slot_id, status, total_amount, patient_notes)
  VALUES (v_caller, v_slot.branch_id, p_slot_id, 'pending_payment', v_total, v_notes)
  RETURNING id, booking_ref INTO v_booking_id, v_ref;

  INSERT INTO booking_services (booking_id, branch_service_id, price_at_booking, quantity)
  SELECT DISTINCT v_booking_id, bs.id, bs.price, 1
    FROM branch_services bs
   WHERE bs.id = ANY (p_branch_service_ids)
     AND bs.branch_id = v_slot.branch_id;

  SELECT jsonb_agg(jsonb_build_object('branchServiceId', bsv.branch_service_id,
                                      'priceEgp', bsv.price_at_booking))
    INTO v_lines
    FROM booking_services bsv WHERE bsv.booking_id = v_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'booking_ref', v_ref,
    'total_egp', v_total,
    'lines', COALESCE(v_lines, '[]'::jsonb)
  );
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- ⑤ The pricing picture — ONE definition, four consumers.
--
-- «٦ فروع مُسعِّرة · ٢ بلا سعر» appears in the list row, in the detail card's
-- subtitle, and twice inside the publish dialog. A03's rule is that the dialog
-- numbers ARE the function numbers; the way to keep that true across four
-- renderings is for there to be one query, not four. Internal-only: it is
-- called from inside SECURITY DEFINER bodies, where the effective user is the
-- owner, so it needs no grant to anybody (same posture as A02's commission
-- helpers, migration 20260809161034).
--
-- ⚠ "بلا سعر" IS THE ABSENCE OF A ROW, not a NULL price: branch_services.price
-- is NOT NULL, so a branch that has never priced a service simply has no
-- branch_services row for it. That is why this is a LEFT JOIN from branches and
-- not a filter on branch_services — a query written the other way round can
-- never see the two branches the design is asking us to chase.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.service_branch_pricing(p_service_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
WITH rows AS (
  SELECT b.id AS branch_id,
         b.name_ar AS branch_name_ar,
         b.district,
         b.phone,
         b.whatsapp,
         p.name_ar AS provider_name_ar,
         bs.price,
         bs.is_available,
         bs.updated_at AS priced_at
    FROM branches b
    JOIN providers p ON p.id = b.provider_id
    LEFT JOIN branch_services bs
           ON bs.branch_id = b.id AND bs.service_id = p_service_id
   WHERE COALESCE(b.is_active, FALSE) AND COALESCE(p.is_active, FALSE)
)
SELECT jsonb_build_object(
  'branches', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'branchId', r.branch_id,
             'branchNameAr', r.branch_name_ar,
             'district', r.district,
             'phone', r.phone,
             'whatsapp', r.whatsapp,
             'providerNameAr', r.provider_name_ar,
             'priceEgp', r.price,
             'isAvailable', r.is_available,
             'pricedAt', r.priced_at
           ) ORDER BY r.provider_name_ar, r.branch_name_ar)
      FROM rows r), '[]'::jsonb),
  -- "Live now" is priced AND the partner has it switched on: both dials must
  -- agree before the design may promise the service appears at that branch.
  'pricedCount',   (SELECT COUNT(*)::INT FROM rows WHERE price IS NOT NULL AND COALESCE(is_available, FALSE)),
  'unpricedCount', (SELECT COUNT(*)::INT FROM rows WHERE price IS NULL OR NOT COALESCE(is_available, FALSE)),
  'branchCount',   (SELECT COUNT(*)::INT FROM rows),
  'providerCount', (SELECT COUNT(DISTINCT provider_name_ar)::INT FROM rows WHERE price IS NOT NULL AND COALESCE(is_available, FALSE)),
  'minPriceEgp',   (SELECT MIN(price) FROM rows WHERE price IS NOT NULL AND COALESCE(is_available, FALSE)),
  'maxPriceEgp',   (SELECT MAX(price) FROM rows WHERE price IS NOT NULL AND COALESCE(is_available, FALSE)),
  'unpricedNames', COALESCE((
    SELECT jsonb_agg(r.branch_name_ar ORDER BY r.branch_name_ar)
      FROM rows r WHERE r.price IS NULL OR NOT COALESCE(r.is_available, FALSE)), '[]'::jsonb)
)
$$;

REVOKE ALL ON FUNCTION public.service_branch_pricing(UUID) FROM PUBLIC, anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- ⑥ THE ADMIN WRITERS — A03/P03 pattern: DEFINER, own authorization check,
--    diffed audit row, explicit grants.
-- ───────────────────────────────────────────────────────────────────────────

-- Shared shape checks, so create and update cannot disagree about what a valid
-- service is. Returns NULL when everything is fine, an error key when not.
CREATE OR REPLACE FUNCTION public.validate_service_definition(
  p_name_ar TEXT, p_name_en TEXT, p_code TEXT, p_category_id UUID,
  p_prep_ar TEXT, p_prep_en TEXT, p_tat_hours INT
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(TRIM(p_name_ar), '') = '' OR COALESCE(TRIM(p_name_en), '') = '' THEN
    RETURN 'name_required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM service_categories WHERE id = p_category_id) THEN
    RETURN 'category_not_found';
  END IF;
  -- The code is optional, but a code that exists has to be a code: it is shown
  -- LTR beside an Arabic name and it is a search key, so free text would make
  -- both worse.
  IF p_code IS NOT NULL AND p_code !~ '^[A-Z0-9][A-Z0-9-]{1,23}$' THEN
    RETURN 'invalid_code';
  END IF;
  -- 200 is the frame's counter («٩٢ حرفاً من ٢٠٠»). The note is displayed
  -- verbatim in three places — selection, confirmation, SMS — and «تُعرض كما هي
  -- بلا اختصار», so the limit is enforced here rather than truncated later.
  IF LENGTH(COALESCE(p_prep_ar, '')) > 200 OR LENGTH(COALESCE(p_prep_en, '')) > 200 THEN
    RETURN 'preparation_note_too_long';
  END IF;
  IF p_tat_hours IS NOT NULL AND (p_tat_hours < 1 OR p_tat_hours > 168) THEN
    RETURN 'invalid_tat_hours';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_service_definition(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, INT) FROM PUBLIC, anon, authenticated;

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
  v_uid  UUID := auth.uid();
  v_code TEXT := NULLIF(UPPER(TRIM(COALESCE(p_code, ''))), '');
  v_err  TEXT;
  v_id   UUID;
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

  -- ⚠ ALWAYS a draft. There is no create-and-publish path: the empty state
  -- promises «تبقى مسودة حتى يُسعِّرها الشركاء وتنشرها أنت», and publishing is
  -- the moment that gets the confirm with the acknowledgment checkbox. A
  -- create call that could publish would route around it.
  INSERT INTO services (name_ar, name_en, code, category_id,
                        preparation_notes_ar, preparation_notes_en,
                        default_tat_hours, status)
  VALUES (TRIM(p_name_ar), TRIM(p_name_en), v_code, p_category_id,
          NULLIF(TRIM(COALESCE(p_preparation_notes_ar, '')), ''),
          NULLIF(TRIM(COALESCE(p_preparation_notes_en, '')), ''),
          p_tat_hours, 'draft')
  RETURNING id INTO v_id;

  INSERT INTO service_catalog_history (service_id, action, old_values, new_values, changed_by)
  VALUES (v_id, 'service_created', '{}'::JSONB,
          jsonb_build_object('name_ar', TRIM(p_name_ar), 'code', v_code, 'status', 'draft'),
          v_uid);

  RETURN jsonb_build_object('success', TRUE, 'service_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_service(
  p_service_id UUID,
  p_name_ar TEXT,
  p_name_en TEXT,
  p_code TEXT,
  p_category_id UUID,
  p_preparation_notes_ar TEXT DEFAULT NULL,
  p_preparation_notes_en TEXT DEFAULT NULL,
  p_tat_hours INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_code    TEXT := NULLIF(UPPER(TRIM(COALESCE(p_code, ''))), '');
  v_prep_ar TEXT := NULLIF(TRIM(COALESCE(p_preparation_notes_ar, '')), '');
  v_prep_en TEXT := NULLIF(TRIM(COALESCE(p_preparation_notes_en, '')), '');
  v_row     public.services%ROWTYPE;
  v_old     JSONB := '{}'::JSONB;
  v_new     JSONB := '{}'::JSONB;
  v_err     TEXT;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_row FROM services WHERE id = p_service_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'service_not_found');
  END IF;

  v_err := validate_service_definition(p_name_ar, p_name_en, v_code, p_category_id,
                                       v_prep_ar, v_prep_en, p_tat_hours);
  IF v_err IS NOT NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', v_err);
  END IF;

  IF v_code IS NOT NULL AND EXISTS (
    SELECT 1 FROM services WHERE code = v_code AND id <> p_service_id
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'code_taken');
  END IF;

  -- ⚠ THE STATUS IS NOT AN ARGUMENT HERE. Publishing and suspending are
  -- consequential moments with their own confirm and their own audit label;
  -- letting a definition edit carry a status along would be a second, silent
  -- door to the same transition. Same reason A03 kept allocation out of
  -- admin_update_branch.
  IF v_row.name_ar IS DISTINCT FROM TRIM(p_name_ar) THEN
    v_old := v_old || jsonb_build_object('name_ar', v_row.name_ar);
    v_new := v_new || jsonb_build_object('name_ar', TRIM(p_name_ar));
  END IF;
  IF v_row.name_en IS DISTINCT FROM TRIM(p_name_en) THEN
    v_old := v_old || jsonb_build_object('name_en', v_row.name_en);
    v_new := v_new || jsonb_build_object('name_en', TRIM(p_name_en));
  END IF;
  IF v_row.code IS DISTINCT FROM v_code THEN
    v_old := v_old || jsonb_build_object('code', v_row.code);
    v_new := v_new || jsonb_build_object('code', v_code);
  END IF;
  IF v_row.category_id IS DISTINCT FROM p_category_id THEN
    v_old := v_old || jsonb_build_object('category_id', v_row.category_id);
    v_new := v_new || jsonb_build_object('category_id', p_category_id);
  END IF;
  IF v_row.preparation_notes_ar IS DISTINCT FROM v_prep_ar THEN
    v_old := v_old || jsonb_build_object('preparation_notes_ar', v_row.preparation_notes_ar);
    v_new := v_new || jsonb_build_object('preparation_notes_ar', v_prep_ar);
  END IF;
  IF v_row.preparation_notes_en IS DISTINCT FROM v_prep_en THEN
    v_old := v_old || jsonb_build_object('preparation_notes_en', v_row.preparation_notes_en);
    v_new := v_new || jsonb_build_object('preparation_notes_en', v_prep_en);
  END IF;
  IF p_tat_hours IS NOT NULL AND v_row.default_tat_hours IS DISTINCT FROM p_tat_hours THEN
    v_old := v_old || jsonb_build_object('default_tat_hours', v_row.default_tat_hours);
    v_new := v_new || jsonb_build_object('default_tat_hours', p_tat_hours);
  END IF;

  IF v_new = '{}'::JSONB THEN
    RETURN jsonb_build_object('success', TRUE, 'unchanged', TRUE);
  END IF;

  UPDATE services
     SET name_ar = TRIM(p_name_ar), name_en = TRIM(p_name_en), code = v_code,
         category_id = p_category_id,
         preparation_notes_ar = v_prep_ar, preparation_notes_en = v_prep_en,
         default_tat_hours = COALESCE(p_tat_hours, default_tat_hours),
         updated_at = NOW()
   WHERE id = p_service_id;

  INSERT INTO service_catalog_history (service_id, action, old_values, new_values, changed_by)
  VALUES (p_service_id, 'service_updated', v_old, v_new, v_uid);

  RETURN jsonb_build_object('success', TRUE, 'changed', v_new);
END;
$$;

-- ⚠ THE TRANSITION TABLE IS SERVER-SIDE, not merely a disabled toggle.
--   draft     → published   (نشر)
--   published → suspended   (إيقاف)
--   suspended → published   (إعادة نشر — restores the prices it kept)
-- Nothing returns to draft. Draft means "never been live"; a screen that let a
-- published service go back to it would be a third way to hide a service, with
-- different words and no confirm of its own.
CREATE OR REPLACE FUNCTION public.admin_set_service_status(
  p_service_id UUID,
  p_to_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_from TEXT;
  v_name TEXT;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT status, name_ar INTO v_from, v_name FROM services WHERE id = p_service_id FOR UPDATE;
  IF v_from IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'service_not_found');
  END IF;

  IF v_from = p_to_status THEN
    RETURN jsonb_build_object('success', TRUE, 'unchanged', TRUE, 'status', v_from);
  END IF;

  IF NOT (
    (v_from = 'draft'     AND p_to_status = 'published') OR
    (v_from = 'published' AND p_to_status = 'suspended') OR
    (v_from = 'suspended' AND p_to_status = 'published')
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_transition',
                              'from', v_from, 'to', p_to_status);
  END IF;

  UPDATE services SET status = p_to_status, updated_at = NOW() WHERE id = p_service_id;

  INSERT INTO service_catalog_history (service_id, action, old_values, new_values, changed_by)
  VALUES (p_service_id,
          CASE WHEN p_to_status = 'published' THEN 'service_published' ELSE 'service_suspended' END,
          jsonb_build_object('status', v_from),
          jsonb_build_object('status', p_to_status),
          v_uid);

  RETURN jsonb_build_object('success', TRUE, 'from', v_from, 'status', p_to_status);
END;
$$;

-- ⚠ THE LAUNCH SWITCH. One flag, network-wide, and after ④ it is finally a
-- BOOKING gate and not just a display filter. Its own audit label because "the
-- founder turned scans on" is not the same event as "the founder edited a
-- service", and the overview will want to find it.
CREATE OR REPLACE FUNCTION public.admin_set_category_active(
  p_category_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_was  BOOLEAN;
  v_slug TEXT;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_is_active IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'is_active_required');
  END IF;

  SELECT is_active, slug INTO v_was, v_slug
    FROM service_categories WHERE id = p_category_id FOR UPDATE;
  IF v_slug IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'category_not_found');
  END IF;

  IF COALESCE(v_was, FALSE) = p_is_active THEN
    RETURN jsonb_build_object('success', TRUE, 'unchanged', TRUE, 'is_active', p_is_active);
  END IF;

  UPDATE service_categories SET is_active = p_is_active WHERE id = p_category_id;

  INSERT INTO service_catalog_history (category_id, action, old_values, new_values, changed_by)
  VALUES (p_category_id,
          CASE WHEN p_is_active THEN 'category_activated' ELSE 'category_deactivated' END,
          jsonb_build_object('is_active', v_was),
          jsonb_build_object('is_active', p_is_active),
          v_uid);

  RETURN jsonb_build_object('success', TRUE, 'slug', v_slug, 'is_active', p_is_active);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ⑦ READS AND PREVIEWS.
--
-- Admin READS of services/categories/branch_services survive the policy drops
-- in ⑧: the escape hatch lives in each table's PUBLIC READ policy
-- («(is_active = true) OR get_user_role() = 'admin'»), not in the ALL policy —
-- the same asymmetry A03 relied on. What is NOT a plain read is anything that
-- has to count what ISN'T there (an unpriced branch is a MISSING row) or that
-- feeds a confirm dialog, because the A03 rule is that the dialog numbers and
-- the applied effect come from the same expression.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_service_catalog()
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

  WITH priced AS (
    SELECT bs.service_id,
           COUNT(*)::INT AS priced_count,
           MIN(bs.price) AS min_price,
           MAX(bs.price) AS max_price
      FROM branch_services bs
      JOIN branches b ON b.id = bs.branch_id AND COALESCE(b.is_active, FALSE)
      JOIN providers p ON p.id = b.provider_id AND COALESCE(p.is_active, FALSE)
     WHERE COALESCE(bs.is_available, FALSE)
     GROUP BY bs.service_id
  )
  SELECT jsonb_build_object(
    'services', COALESCE(jsonb_agg(jsonb_build_object(
      'serviceId', s.id,
      'nameAr', s.name_ar,
      'nameEn', s.name_en,
      'code', s.code,
      'status', s.status,
      'categoryId', sc.id,
      'categorySlug', sc.slug,
      'categoryNameAr', sc.name_ar,
      'categoryIcon', sc.icon,
      'categoryIsActive', COALESCE(sc.is_active, FALSE),
      'pricedBranchCount', COALESCE(pr.priced_count, 0),
      'minPriceEgp', pr.min_price,
      'maxPriceEgp', pr.max_price,
      'hasPreparationNote', s.preparation_notes_ar IS NOT NULL,
      'updatedAt', s.updated_at
    ) ORDER BY sc.sort_order, s.sort_order, s.name_ar), '[]'::jsonb),
    'counts', jsonb_build_object(
      'total',     COUNT(*)::INT,
      'published', COUNT(*) FILTER (WHERE s.status = 'published')::INT,
      'draft',     COUNT(*) FILTER (WHERE s.status = 'draft')::INT,
      'suspended', COUNT(*) FILTER (WHERE s.status = 'suspended')::INT
    )
  ) INTO v_out
  FROM services s
  JOIN service_categories sc ON sc.id = s.category_id
  LEFT JOIN priced pr ON pr.service_id = s.id;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_service_detail(p_service_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_service JSONB;
  v_audit   JSONB;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT jsonb_build_object(
    'serviceId', s.id,
    'nameAr', s.name_ar,
    'nameEn', s.name_en,
    'code', s.code,
    'status', s.status,
    'categoryId', s.category_id,
    'categoryNameAr', sc.name_ar,
    'categoryIsActive', COALESCE(sc.is_active, FALSE),
    'categoryIcon', sc.icon,
    'preparationNotesAr', s.preparation_notes_ar,
    'preparationNotesEn', s.preparation_notes_en,
    'defaultTatHours', s.default_tat_hours,
    'createdAt', s.created_at,
    'updatedAt', s.updated_at
  ) INTO v_service
  FROM services s
  JOIN service_categories sc ON sc.id = s.category_id
  WHERE s.id = p_service_id;

  IF v_service IS NULL THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;

  -- The panel shows BOTH portals' events on this service: the admin's edits
  -- from service_catalog_history, and the partner's price changes from
  -- branch_service_price_history — «من أي بوابة».
  -- ⚠ Ordered on the real timestamptz, never on the serialised string: the two
  -- legs of the UNION come from different tables and a text sort would depend
  -- on both rendering their offset identically.
  SELECT COALESCE(jsonb_agg(e ORDER BY at DESC), '[]'::jsonb) INTO v_audit
  FROM (
    SELECT h.changed_at AS at, jsonb_build_object(
             'action', h.action,
             'oldValues', h.old_values,
             'newValues', h.new_values,
             'changedAt', h.changed_at,
             'source', 'admin',
             'who', COALESCE(au.name, 'الإدارة')
           ) AS e
      FROM service_catalog_history h
      LEFT JOIN admin_users au ON au.auth_user_id = h.changed_by
     WHERE h.service_id = p_service_id
    UNION ALL
    SELECT ph.changed_at AS at, jsonb_build_object(
             'action', 'branch_price_changed',
             'oldValues', jsonb_build_object('price', ph.old_price, 'is_available', ph.old_is_available),
             'newValues', jsonb_build_object('price', ph.new_price, 'is_available', ph.new_is_available),
             'changedAt', ph.changed_at,
             'source', 'partner',
             'who', b.name_ar
           ) AS e
      FROM branch_service_price_history ph
      JOIN branch_services bs ON bs.id = ph.branch_service_id
      JOIN branches b ON b.id = bs.branch_id
     WHERE bs.service_id = p_service_id
  ) events;

  RETURN jsonb_build_object(
    'found', TRUE,
    'service', v_service,
    'pricing', service_branch_pricing(p_service_id),
    'audit', v_audit
  );
END;
$$;

-- The publish / suspend dialogs. ONE function, because the two dialogs are the
-- same anatomy asking about the same service in opposite directions, and two
-- functions is two chances to compute «٦ فروع» differently.
CREATE OR REPLACE FUNCTION public.preview_service_status_change(
  p_service_id UUID,
  p_to_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_from      TEXT;
  v_cat_ok    BOOLEAN;
  v_prep      TEXT;
  v_pricing   JSONB;
  v_upcoming  INT;
  v_weekly    NUMERIC;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT s.status, COALESCE(sc.is_active, FALSE), s.preparation_notes_ar
    INTO v_from, v_cat_ok, v_prep
    FROM services s JOIN service_categories sc ON sc.id = s.category_id
   WHERE s.id = p_service_id;
  IF v_from IS NULL THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;

  v_pricing := service_branch_pricing(p_service_id);

  -- «٢٣ حجزاً قائماً لا تتأثر» — bookings already taken that must still be
  -- served. Outstanding means not yet closed AND not in the past.
  SELECT COUNT(DISTINCT bk.id)::INT INTO v_upcoming
    FROM bookings bk
    JOIN slots sl ON sl.id = bk.slot_id
    JOIN booking_services bsv ON bsv.booking_id = bk.id
    JOIN branch_services bs ON bs.id = bsv.branch_service_id
   WHERE bs.service_id = p_service_id
     AND bk.status IN ('pending_payment', 'confirmed', 'arrived')
     AND sl.slot_date >= (NOW() AT TIME ZONE 'Africa/Cairo')::DATE;

  -- «متوسط الحجوزات الأسبوعية» — a volume signal, so the founder knows what
  -- suspending costs. 28 days over 4 weeks; counted on when the booking was
  -- TAKEN, which is the same clock A02's statements use
  -- (migration 20260809183734).
  SELECT ROUND(COUNT(DISTINCT bk.id) / 4.0, 1) INTO v_weekly
    FROM bookings bk
    JOIN booking_services bsv ON bsv.booking_id = bk.id
    JOIN branch_services bs ON bs.id = bsv.branch_service_id
   WHERE bs.service_id = p_service_id
     AND bk.status <> 'cancelled'
     AND bk.created_at >= NOW() - INTERVAL '28 days';

  RETURN jsonb_build_object(
    'found', TRUE,
    'from', v_from,
    'to', p_to_status,
    'allowed', (v_from = 'draft'     AND p_to_status = 'published')
            OR (v_from = 'published' AND p_to_status = 'suspended')
            OR (v_from = 'suspended' AND p_to_status = 'published'),
    'pricing', v_pricing,
    -- ⚠ Publishing into an INACTIVE category is allowed on purpose
    -- (DECISION-provider-data-model: onboard the full menu, surface only active
    -- categories) — but the dialog's promise «تظهر في بحث المرضى فوراً» is then
    -- FALSE, so the number that makes it false travels with the preview.
    'categoryIsActive', v_cat_ok,
    'hasPreparationNote', v_prep IS NOT NULL,
    'outstandingBookings', COALESCE(v_upcoming, 0),
    'weeklyBookingAverage', COALESCE(v_weekly, 0)
  );
END;
$$;

-- The category flip's confirm. Network-wide numbers, because that is what the
-- flip is: every provider's services in that category at once.
CREATE OR REPLACE FUNCTION public.preview_category_activation(
  p_category_id UUID,
  p_is_active BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_slug      TEXT;
  v_name      TEXT;
  v_was       BOOLEAN;
  v_published INT;
  v_draft     INT;
  v_branches  INT;
  v_providers INT;
  v_upcoming  INT;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT slug, name_ar, COALESCE(is_active, FALSE) INTO v_slug, v_name, v_was
    FROM service_categories WHERE id = p_category_id;
  IF v_slug IS NULL THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;

  SELECT COUNT(*) FILTER (WHERE status = 'published')::INT,
         COUNT(*) FILTER (WHERE status = 'draft')::INT
    INTO v_published, v_draft
    FROM services WHERE category_id = p_category_id;

  -- What actually lights up (or goes dark): PUBLISHED services in this category
  -- that a live branch has priced and switched on. A draft changes nothing
  -- either way, which is exactly why the two counts are reported separately.
  SELECT COUNT(DISTINCT b.id)::INT, COUNT(DISTINCT b.provider_id)::INT
    INTO v_branches, v_providers
    FROM branch_services bs
    JOIN services s ON s.id = bs.service_id AND s.status = 'published'
    JOIN branches b ON b.id = bs.branch_id AND COALESCE(b.is_active, FALSE)
    JOIN providers p ON p.id = b.provider_id AND COALESCE(p.is_active, FALSE)
   WHERE s.category_id = p_category_id
     AND COALESCE(bs.is_available, FALSE);

  SELECT COUNT(DISTINCT bk.id)::INT INTO v_upcoming
    FROM bookings bk
    JOIN slots sl ON sl.id = bk.slot_id
    JOIN booking_services bsv ON bsv.booking_id = bk.id
    JOIN branch_services bs ON bs.id = bsv.branch_service_id
    JOIN services s ON s.id = bs.service_id
   WHERE s.category_id = p_category_id
     AND bk.status IN ('pending_payment', 'confirmed', 'arrived')
     AND sl.slot_date >= (NOW() AT TIME ZONE 'Africa/Cairo')::DATE;

  RETURN jsonb_build_object(
    'found', TRUE,
    'slug', v_slug,
    'nameAr', v_name,
    'wasActive', v_was,
    'toActive', p_is_active,
    'publishedServices', COALESCE(v_published, 0),
    'draftServices', COALESCE(v_draft, 0),
    'affectedBranches', COALESCE(v_branches, 0),
    'affectedProviders', COALESCE(v_providers, 0),
    'outstandingBookings', COALESCE(v_upcoming, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_service_categories_admin()
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'categoryId', sc.id,
           'slug', sc.slug,
           'nameAr', sc.name_ar,
           'nameEn', sc.name_en,
           'icon', sc.icon,
           'isActive', COALESCE(sc.is_active, FALSE),
           'sortOrder', sc.sort_order,
           'publishedServices', COALESCE(c.published, 0),
           'totalServices', COALESCE(c.total, 0)
         ) ORDER BY sc.sort_order, sc.name_ar), '[]'::jsonb) INTO v_out
    FROM service_categories sc
    LEFT JOIN (
      SELECT category_id,
             COUNT(*)::INT AS total,
             COUNT(*) FILTER (WHERE status = 'published')::INT AS published
        FROM services GROUP BY category_id
    ) c ON c.category_id = sc.id;

  RETURN v_out;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ⑧ Grants. Postgres gives EXECUTE to PUBLIC by default, so every one of these
--    is reachable by any signed-in client the moment it exists (§5).
-- ───────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.admin_create_service(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_service(TEXT, TEXT, TEXT, UUID, TEXT, TEXT, INT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_update_service(UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_service(UUID, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, INT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_set_service_status(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_service_status(UUID, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.admin_set_category_active(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_category_active(UUID, BOOLEAN) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_service_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_service_catalog() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_service_detail(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_service_detail(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_service_categories_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_service_categories_admin() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.preview_service_status_change(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_service_status_change(UUID, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.preview_category_activation(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_category_activation(UUID, BOOLEAN) TO authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- ⑨ ⚠ A04'S OPENING DECISION — three more of A01's eleven.
--
--   services:           admin full access → an admin's BROWSER could rewrite any
--                                           column of any service, unaudited,
--                                           including flipping it live
--   service_categories: admin full access → the launch switch, from a fetch
--   branch_services:    admin full access → ⚠ PRICE. The one field this feature
--                                           deliberately does NOT let the admin
--                                           write («يُسعِّرها الشريك — قراءة فقط»)
--                                           was writable from the browser the
--                                           whole time, along with is_available.
--
-- All three are `ALL` policies with a NULL with_check — column-blind — over
-- tables that still carry the blanket Supabase DML grant to anon/authenticated,
-- so RLS was the only gate.
--
-- `services` and `service_categories` close because A04 REPLACES them: every
-- write above derives its values server-side and writes an audit row, which a
-- policy can never do. `branch_services` closes with NO replacement, because
-- the admin has no business writing it at all — `update_branch_service` (P03,
-- the partner's own RPC, SECURITY DEFINER so it bypasses RLS) remains the only
-- writer. Verified there are no client writes to any of the three anywhere in
-- apps/, packages/ or supabase/functions/: every one is a read.
--
-- Admin READS are unaffected: the escape hatch is in each table's public-read
-- policy, not here.
--
-- Nine of the eleven are now closed. Remaining after A05 takes provider_users:
-- `users`, `notifications` (⚠ NOT in the five the hand-off named — it is a
-- tenth that A03's own note listed and the hand-off dropped), and the `reviews`
-- moderation gap, which is F08's call.
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "services: admin full access" ON public.services;
DROP POLICY IF EXISTS "categories: admin full access" ON public.service_categories;
DROP POLICY IF EXISTS "branch_services: admin full access" ON public.branch_services;
