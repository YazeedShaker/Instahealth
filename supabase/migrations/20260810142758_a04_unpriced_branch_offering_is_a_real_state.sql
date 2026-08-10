-- A04 (addendum) · «بلا سعر» becomes a real state, so the create flow has an end.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠ THE DEAD END THIS CLOSES, found while wiring the catalog's create action
-- ═══════════════════════════════════════════════════════════════════════════
-- `admin_create_service` makes a draft. The approved frame then shows that
-- draft's per-branch price table, with «٦ فروع مُسعِّرة · ٢ بلا سعر», and the
-- publish confirm counts the priced ones. For any of that to be reachable a
-- PARTNER has to be able to price a brand-new service. They cannot:
--
--   · `update_branch_service` (P03) takes an EXISTING branch_service id and
--     has no insert path — verified in the live catalog.
--   · Nothing else writes `branch_services` at all: the admin `ALL` policy was
--     the only other door and A04 just closed it.
--   · `branch_services.price` was NOT NULL, so "offered but not yet priced"
--     could not even be REPRESENTED.
--
-- So a newly created service had no route to a price, from anybody, ever. It
-- would sit at «٢٤ فرعاً بلا سعر» permanently and could never be published into
-- anything a patient could see. The catalog's primary action was a dead end.
--
-- ⚠ AND THE DESIGN KNEW. The audit panel in the frame draws a price row as
-- «سعر فرع المهندسين — من — إلى ١٨٠ ج.م»: an em-dash for the OLD price. That
-- is a first price on a row that had none, which is exactly a NULL. The
-- nullable column is not an invention here, it is the state the frame was
-- already drawing and the schema could not hold.
--
-- Three honest states, where there were two and a half:
--   price IS NULL                        → «بلا سعر — لن تظهر». Nudge the partner.
--   price IS NOT NULL, is_available=false → priced, and the partner has it
--                                           switched off. Their P03 dial.
--   price IS NOT NULL, is_available=true  → live.

-- ───────────────────────────────────────────────────────────────────────────
-- ① The column.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.branch_services ALTER COLUMN price DROP NOT NULL;

COMMENT ON COLUMN public.branch_services.price IS
  'NULL means the branch is OFFERED this service but has never priced it — «بلا سعر — لن تظهر». Never bookable and never counted in a price range; only update_branch_service (the partner''s own RPC) can set the first price.';

-- ───────────────────────────────────────────────────────────────────────────
-- ② ⚠ EVERY PREDICATE THAT READS A PRICE NOW HAS TO EXCLUDE THE NULL.
--
-- This is the dangerous half of the change and the reason it is its own
-- migration. `create_pending_booking` does `SUM(bs.price)` into `total_amount`
-- — the server-derived money fact that migration 20260729160519 exists to
-- protect. A NULL in that sum makes the whole total NULL, and a booking with a
-- NULL total is a booking nobody can be invoiced for. It is guarded twice: the
-- row is excluded here, AND `is_available` was already required.
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

  -- Every requested line must be bookable AT THIS BRANCH: right branch, the
  -- partner has it switched on, the admin has it published, its category is
  -- launched, AND it has a price. The count check closes the cross-branch hole
  -- and DISTINCT stops a repeated id inflating the total.
  SELECT COUNT(DISTINCT bs.id), COALESCE(SUM(bs.price), 0)
    INTO v_count, v_total
    FROM branch_services bs
    JOIN services s ON s.id = bs.service_id
    JOIN service_categories sc ON sc.id = s.category_id
   WHERE bs.id = ANY (p_branch_service_ids)
     AND bs.branch_id = v_slot.branch_id
     AND COALESCE(bs.is_available, FALSE)
     AND bs.price IS NOT NULL
     AND COALESCE(s.is_active, FALSE)
     AND COALESCE(sc.is_active, FALSE);

  IF v_count <> (SELECT COUNT(DISTINCT x) FROM unnest(p_branch_service_ids) AS x) THEN
    RETURN jsonb_build_object('success', false, 'error', 'service_unavailable');
  END IF;

  v_notes := NULLIF(BTRIM(COALESCE(p_notes, '')), '');

  INSERT INTO bookings (user_id, branch_id, slot_id, status, total_amount, patient_notes)
  VALUES (v_caller, v_slot.branch_id, p_slot_id, 'pending_payment', v_total, v_notes)
  RETURNING id, booking_ref INTO v_booking_id, v_ref;

  -- ⚠ The same price filter, again. This INSERT re-selects rather than reusing
  -- the count above, so a row that failed the predicate must fail it here too —
  -- otherwise a NULL price would reach `price_at_booking`, which is the other
  -- half of the money fact 20260729160519 made server-derived.
  INSERT INTO booking_services (booking_id, branch_service_id, price_at_booking, quantity)
  SELECT DISTINCT v_booking_id, bs.id, bs.price, 1
    FROM branch_services bs
   WHERE bs.id = ANY (p_branch_service_ids)
     AND bs.branch_id = v_slot.branch_id
     AND bs.price IS NOT NULL;

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

-- ③ Search: an unpriced offering must not set a service's «يبدأ من» floor, and
--    must not count toward «متوفر في N فرع».
CREATE OR REPLACE FUNCTION public.search_catalog(p_query text, p_category_slug text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
WITH flags AS (
  SELECT nq,
         replace(replace(replace(nq, '\', '\\'), '%', '\%'), '_', '\_') AS esc,
         length(nq) >= 2 AS has_query
    FROM (SELECT normalize_arabic(COALESCE(p_query, '')) AS nq) q
),
matched_services AS (
  SELECT s.id, s.name_ar, s.name_en, sc.slug AS category_slug,
         COALESCE(sc.icon, '🧪') AS category_icon,
         s.preparation_notes_ar
    FROM services s
    JOIN service_categories sc ON sc.id = s.category_id
    CROSS JOIN flags f
   WHERE COALESCE(s.is_active, FALSE)
     AND COALESCE(sc.is_active, FALSE)
     AND (p_category_slug IS NULL OR sc.slug = p_category_slug)
     AND (
           (f.has_query AND (
                normalize_arabic(s.name_ar) LIKE '%' || f.esc || '%'
             OR normalize_arabic(s.name_en) LIKE '%' || f.esc || '%'))
        OR (NOT f.has_query AND p_category_slug IS NOT NULL)
         )
),
service_offerings AS (
  -- A service with ZERO active offerings is a dead end and is dropped by the
  -- inner join below — «متوفر في ٠ فرع» must never render. A04: an offering
  -- with no price yet is not an offering.
  SELECT ms.id AS service_id,
         count(*)::int AS branch_count,
         min(bs.price) AS min_price,
         jsonb_agg(jsonb_build_object(
           'branchId', b.id,
           'branchServiceId', bs.id,
           'branchNameAr', b.name_ar,
           'lat', b.lat,
           'lng', b.lng,
           'priceEgp', bs.price
         ) ORDER BY bs.price, b.name_ar) AS branches
    FROM matched_services ms
    JOIN branch_services bs ON bs.service_id = ms.id
                           AND COALESCE(bs.is_available, FALSE)
                           AND bs.price IS NOT NULL
    JOIN branches b ON b.id = bs.branch_id AND COALESCE(b.is_active, FALSE)
    JOIN providers p ON p.id = b.provider_id AND COALESCE(p.is_active, FALSE)
   GROUP BY ms.id
),
matched_branches AS (
  SELECT b.id
    FROM branches b
    JOIN providers p ON p.id = b.provider_id AND COALESCE(p.is_active, FALSE)
    CROSS JOIN flags f
   WHERE COALESCE(b.is_active, FALSE)
     AND f.has_query
     AND (
          normalize_arabic(b.name_ar) LIKE '%' || f.esc || '%'
       OR normalize_arabic(b.name_en) LIKE '%' || f.esc || '%'
       OR normalize_arabic(p.name_ar) LIKE '%' || f.esc || '%'
       OR normalize_arabic(p.name_en) LIKE '%' || f.esc || '%'
         )
)
SELECT jsonb_build_object(
  'services', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'serviceId', ms.id,
             'nameAr', ms.name_ar,
             'nameEn', ms.name_en,
             'categorySlug', ms.category_slug,
             'categoryIcon', ms.category_icon,
             'requiresPreparation',
               ms.preparation_notes_ar IS NOT NULL
               AND ms.preparation_notes_ar NOT LIKE 'لا يشترط%',
             'branchCount', so.branch_count,
             'minPriceEgp', so.min_price,
             'branches', so.branches
           ) ORDER BY so.branch_count DESC, ms.name_ar)
      FROM matched_services ms
      JOIN service_offerings so ON so.service_id = ms.id
  ), '[]'::jsonb),
  'branchIds', COALESCE((SELECT jsonb_agg(mb.id) FROM matched_branches mb), '[]'::jsonb)
)
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- ④ The partner's editor shows DRAFTS — that is the whole point of a draft.
--
-- It filtered on `s.is_active`, which is now generated from the admin's dial,
-- so a draft had silently become invisible to the very people who have to price
-- it before it can be published. Suspended stays hidden: the confirm promises
-- prices are KEPT, not that the partner keeps editing something no patient can
-- book.
--
-- ⚠ And a NULL price is what the editor must render as «بلا سعر» rather than
-- as a zero, so it is returned as-is.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_branch_services_for_editor(p_branch_id uuid)
RETURNS TABLE(branch_service_id uuid, service_id uuid, name_ar text, name_en text,
              category_slug text, category_name_ar text, price numeric, is_available boolean,
              preparation_notes_ar text, last_changed_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
       is_internal_caller()
    OR COALESCE(p_branch_id = ANY (get_provider_branch_ids()), FALSE)
    OR (get_user_role() = 'admin')
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    bs.id, s.id, s.name_ar::TEXT, s.name_en::TEXT,
    sc.slug::TEXT, sc.name_ar::TEXT,
    bs.price, COALESCE(bs.is_available, FALSE),
    s.preparation_notes_ar::TEXT,
    (SELECT MAX(h.changed_at) FROM branch_service_price_history h
      WHERE h.branch_service_id = bs.id)
  FROM branch_services bs
  JOIN services s ON s.id = bs.service_id
  JOIN service_categories sc ON sc.id = s.category_id
  WHERE bs.branch_id = p_branch_id
    AND s.status <> 'suspended'
  -- Grouped by category in the SAME order the patient app groups them, so the
  -- desk and the patient see one catalogue, not two orderings.
  ORDER BY sc.sort_order NULLS LAST, sc.name_ar, s.sort_order NULLS LAST, s.name_ar;
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- ⑤ Creating a service now creates the OFFERING at every live branch.
--
-- That is what gives the partner a row to price and the founder a table to
-- nudge from — and it is what the frame draws, which lists «كل فروع الشبكة
-- الثمانية» for a service still in draft.
--
-- `is_available` starts TRUE and the price starts NULL: the branch is willing,
-- the number is missing. So the moment a partner enters their price the service
-- goes live there with no second step, which is exactly the promise the publish
-- confirm makes — «تظهر في الفروع التي سجّل شركاؤها سعراً». A branch that does
-- not offer it at all switches its own toggle off, which is their dial and not
-- ours to guess.
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
  v_uid      UUID := auth.uid();
  v_code     TEXT := NULLIF(UPPER(TRIM(COALESCE(p_code, ''))), '');
  v_err      TEXT;
  v_id       UUID;
  v_offered  INT;
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

  INSERT INTO branch_services (branch_id, service_id, price, is_available)
  SELECT b.id, v_id, NULL, TRUE
    FROM branches b
    JOIN providers p ON p.id = b.provider_id
   WHERE COALESCE(b.is_active, FALSE) AND COALESCE(p.is_active, FALSE);
  GET DIAGNOSTICS v_offered = ROW_COUNT;

  INSERT INTO service_catalog_history (service_id, action, old_values, new_values, changed_by)
  VALUES (v_id, 'service_created', '{}'::JSONB,
          jsonb_build_object('name_ar', TRIM(p_name_ar), 'code', v_code, 'status', 'draft',
                             'offered_at_branches', v_offered),
          v_uid);

  RETURN jsonb_build_object('success', TRUE, 'service_id', v_id, 'offeredAtBranches', v_offered);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ⑥ The pricing picture learns the third state.
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
         COALESCE(bs.is_available, FALSE) AS is_available,
         bs.updated_at AS priced_at,
         -- ONE definition of what a row means, so the table, the header and
         -- both dialogs cannot classify the same branch differently.
         CASE WHEN bs.id IS NULL OR bs.price IS NULL THEN 'unpriced'
              WHEN NOT COALESCE(bs.is_available, FALSE) THEN 'switched_off'
              ELSE 'live' END AS state
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
             'state', r.state,
             'pricedAt', r.priced_at
           ) ORDER BY r.provider_name_ar, r.branch_name_ar)
      FROM rows r), '[]'::jsonb),
  'pricedCount',   (SELECT COUNT(*)::INT FROM rows WHERE state = 'live'),
  'unpricedCount', (SELECT COUNT(*)::INT FROM rows WHERE state = 'unpriced'),
  'switchedOffCount', (SELECT COUNT(*)::INT FROM rows WHERE state = 'switched_off'),
  'branchCount',   (SELECT COUNT(*)::INT FROM rows),
  'providerCount', (SELECT COUNT(DISTINCT provider_name_ar)::INT FROM rows WHERE state = 'live'),
  'minPriceEgp',   (SELECT MIN(price) FROM rows WHERE state = 'live'),
  'maxPriceEgp',   (SELECT MAX(price) FROM rows WHERE state = 'live'),
  'unpricedNames', COALESCE((
    SELECT jsonb_agg(r.branch_name_ar ORDER BY r.branch_name_ar)
      FROM rows r WHERE r.state = 'unpriced'), '[]'::jsonb)
)
$$;

REVOKE ALL ON FUNCTION public.service_branch_pricing(UUID) FROM PUBLIC, anon, authenticated;

-- ⑦ And the list's price range must agree with the detail's.
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
       AND bs.price IS NOT NULL
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
