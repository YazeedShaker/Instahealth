-- ============================================================
-- F08 (reads) — what the branch profile, the full list and the zero state ask
-- the database for.
--
-- ⚠ THESE ARE SECURITY *INVOKER*, DELIBERATELY, AND THEY STILL STATE THE
-- PREDICATE. Every other read this feature needed could have been a DEFINER
-- function; none of them should be. The rows are already publicly readable
-- through the `reviews: public read unflagged` policy, so a DEFINER function
-- would take a privilege it does not need — and §5's law is that a DEFINER body
-- IS the boundary, which is a boundary worth not creating.
--
-- ⚠ BUT INHERITING THE PREDICATE FROM RLS WOULD BE A BUG, AND THIS IS THE
-- SUBTLE ONE. The policy reads
--     (is_flagged = false) OR (get_user_role() = 'admin')
-- so for an ADMIN caller it lets hidden reviews through. An aggregate built on
-- that would compute a DIFFERENT average depending on who asked — the founder
-- would see a branch profile no patient can see, and «hidden reviews vanish
-- from aggregates immediately» would be false for exactly one reader. So every
-- function below filters `is_flagged = FALSE` EXPLICITLY. The predicate is
-- stated, not inherited (§5a①: a dial with N consumers is N predicates until
-- proven otherwise).
-- ============================================================

-- ── ① The branch summary — average, count, distribution ─────────────────────
-- ⚠ The average is NULL, never 0, when there is nothing published. `AVG` over
-- zero rows already returns NULL and it is left that way: a branch with no
-- reviews and a branch rated 0.0 must not be representable by the same value.
-- The frame's zero state keys on the COUNT.
CREATE OR REPLACE FUNCTION public.get_branch_review_summary(p_branch_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH published AS (
    SELECT r.rating FROM reviews r
     WHERE r.branch_id = p_branch_id AND r.is_flagged = FALSE
  ),
  buckets AS (
    SELECT s.stars, COUNT(p.rating) AS n
      FROM generate_series(5, 1, -1) AS s(stars)
      LEFT JOIN published p ON p.rating = s.stars
     GROUP BY s.stars
  )
  SELECT jsonb_build_object(
    'branchId', p_branch_id,
    'average',  (SELECT ROUND(AVG(rating)::NUMERIC, 1) FROM published),
    'count',    (SELECT COUNT(*) FROM published),
    -- The frame draws one bar per star value, always five, newest-highest
    -- first — a missing value is a zero-length bar, not an absent row.
    'distribution', (
      SELECT jsonb_agg(
               jsonb_build_object(
                 'stars', b.stars,
                 'count', b.n,
                 'percent', CASE WHEN (SELECT COUNT(*) FROM published) = 0 THEN 0
                            ELSE ROUND(b.n * 100.0 / (SELECT COUNT(*) FROM published))
                            END
               ) ORDER BY b.stars DESC
             )
        FROM buckets b
    )
  );
$$;

-- ── ② The review rows themselves ────────────────────────────────────────────
-- Newest first, paginated. Powers the three-card preview (limit 3) and the full
-- «كل التقييمات (N)» screen with the same function, so the two can never render
-- a different set.
--
-- ⚠ THE SERVICE NAME IS THE BOOKING'S FIRST SERVICE. A review belongs to a
-- BOOKING, and a booking can carry several services, while the frame draws one
-- name per card. Picking the first by the catalogue's own ordering is a
-- decision, not a fact — recorded here so the next reader does not think it is
-- the only service.
CREATE OR REPLACE FUNCTION public.get_branch_reviews(
  p_branch_id UUID,
  p_limit     INTEGER DEFAULT 3,
  p_offset    INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'createdAt') DESC), '[]'::jsonb)
    FROM (
      SELECT jsonb_build_object(
               'reviewId',    r.id,
               'rating',      r.rating,
               'comment',     r.comment,
               'displayName', COALESCE(r.display_name, 'مريض'),
               'serviceNameAr', (
                 -- booking_services -> branch_services -> services: the
                 -- booking holds the PAIRING row, not the service directly.
                 SELECT s.name_ar
                   FROM booking_services bs
                   JOIN branch_services bsv ON bsv.id = bs.branch_service_id
                   JOIN services s ON s.id = bsv.service_id
                  WHERE bs.booking_id = r.booking_id
                  ORDER BY s.sort_order NULLS LAST, s.name_ar
                  LIMIT 1
               ),
               'createdAt',   r.created_at
             ) AS row
        FROM reviews r
       WHERE r.branch_id = p_branch_id AND r.is_flagged = FALSE
       ORDER BY r.created_at DESC
       LIMIT GREATEST(LEAST(COALESCE(p_limit, 3), 50), 0)
      OFFSET GREATEST(COALESCE(p_offset, 0), 0)
    ) rows;
$$;

-- ── ③ The provider figure, for the zero state ───────────────────────────────
-- ⚠ COMPUTED AT QUERY TIME, NEVER STORED — founder ruling, 2026-08-12. There is
-- no `providers.rating` column and there must not be one: a second stored
-- aggregate is a second thing that can disagree with the review rows, and the
-- branch-level pair already carries that risk under a trigger.
--
-- ⚠ AND IT IS THE WEIGHTED AVERAGE OF REVIEW *ROWS*, NOT THE AVERAGE OF BRANCH
-- AVERAGES. Those are different numbers whenever branches have unequal review
-- counts: a branch with one 5★ review would otherwise weigh as much as a branch
-- with two hundred 4★ ones. The frame says «مختبرات النيل تحمل ٤.٧ من ٥ في
-- فروعها الأخرى» — a claim about the provider's patients, so every patient
-- counts once.
--
-- `p_exclude_branch_id` is what keeps the promise in the frame's disclaimer:
-- «ولا تُخلط في نجمة الفرع». The branch being viewed is removed from the
-- provider figure, so the two numbers can never be the same number twice.
CREATE OR REPLACE FUNCTION public.get_provider_review_summary(
  p_provider_id       UUID,
  p_exclude_branch_id UUID DEFAULT NULL,
  p_limit             INTEGER DEFAULT 3
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH sibling_branches AS (
    SELECT b.id, b.name_ar
      FROM branches b
     WHERE b.provider_id = p_provider_id
       AND (p_exclude_branch_id IS NULL OR b.id <> p_exclude_branch_id)
  ),
  published AS (
    SELECT r.id, r.rating, r.comment, r.display_name, r.created_at, sb.name_ar AS branch_name_ar
      FROM reviews r
      JOIN sibling_branches sb ON sb.id = r.branch_id
     WHERE r.is_flagged = FALSE
  )
  SELECT jsonb_build_object(
    'providerId', p_provider_id,
    'average',    (SELECT ROUND(AVG(rating)::NUMERIC, 1) FROM published),
    'count',      (SELECT COUNT(*) FROM published),
    'branchCount',(SELECT COUNT(*) FROM sibling_branches),
    'reviews', COALESCE((
      SELECT jsonb_agg(row ORDER BY (row->>'createdAt') DESC)
        FROM (
          SELECT jsonb_build_object(
                   'reviewId',     p.id,
                   'rating',       p.rating,
                   'comment',      p.comment,
                   'displayName',  COALESCE(p.display_name, 'مريض'),
                   'branchNameAr', p.branch_name_ar,
                   'createdAt',    p.created_at
                 ) AS row
            FROM published p
           ORDER BY p.created_at DESC
           LIMIT GREATEST(LEAST(COALESCE(p_limit, 3), 50), 0)
        ) rows
    ), '[]'::jsonb)
  );
$$;

-- ── ④ Grants ────────────────────────────────────────────────────────────────
-- ⚠ REVOKE FIRST. Postgres grants EXECUTE to PUBLIC by default (§5). These three
-- are public READ surfaces over rows the RLS policy already publishes, so anon
-- is correct here — the patient app browses branch profiles — but it is granted
-- deliberately rather than inherited.
REVOKE ALL ON FUNCTION public.get_branch_review_summary(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_branch_reviews(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_provider_review_summary(UUID, UUID, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_branch_review_summary(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_branch_reviews(UUID, INTEGER, INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_provider_review_summary(UUID, UUID, INTEGER) TO anon, authenticated, service_role;
