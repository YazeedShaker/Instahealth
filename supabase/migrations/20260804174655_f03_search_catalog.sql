-- ═══════════════════════════════════════════════════════════════════════════
-- F03 — global search: Arabic normalization + the catalog search reader.
--
-- `normalize_arabic()` MIRRORS core's `normalizeArabicQuery`
-- (packages/core/src/business/search.ts — the unit-tested authority). Change
-- both sides in the same PR. Keyboard variance folds to one form: hamza seats
-- → bare alif, ى→ي, ة→ه, diacritics/tatweel stripped, lowercased, whitespace
-- collapsed. NO generated columns or indexes yet — the catalog is ~26 services
-- and ~24 branches, a normalized seq scan is microseconds; add expression
-- indexes when catalog scale demands them, not before.
--
-- `search_catalog()` is SECURITY INVOKER on purpose: everything it touches is
-- public-read under RLS (services, categories, branch_services, active
-- branches/providers), so running as the caller adds ZERO definer surface.
-- The active-law predicates are the SAME ones Home enforces (useHomeBranches):
-- active service + active category + available branch_service + active branch
-- + active provider. Nothing else — no parallel definitions.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.normalize_arabic(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT
SET search_path TO 'public'
AS $$
  SELECT lower(trim(regexp_replace(
    translate(
      regexp_replace(p_text, '[ًٌٍَُِّْٰـ]', '', 'g'),
      'أإآٱىة',
      'اااايه'
    ),
    '\s+', ' ', 'g')))
$$;

CREATE OR REPLACE FUNCTION public.search_catalog(
  p_query         text,
  p_category_slug text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
WITH flags AS (
  -- esc: LIKE-escaped so a stray % or _ in the query cannot widen the match
  -- (the P02 search lesson, applied here from birth).
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
  -- inner join below — «متوفر في ٠ فرع» must never render.
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
    JOIN branch_services bs ON bs.service_id = ms.id AND COALESCE(bs.is_available, FALSE)
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
             -- The F04/P03 prep-chip predicate, mirrored: notes that BEGIN
             -- with «لا يشترط» mean "no preparation".
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
$$;

-- The app always has an OTP session; the anon key needs no search access.
REVOKE ALL ON FUNCTION public.normalize_arabic(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.normalize_arabic(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.normalize_arabic(text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.search_catalog(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_catalog(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_catalog(text, text) TO authenticated, service_role;
