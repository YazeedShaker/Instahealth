-- A02 · The live draft computation. This is the money contract in SQL.
--
-- It implements DECISION-commission-attachment VERBATIM:
--   prepaid → commission attaches AT PAYMENT      (event = confirmed_at)
--   cash    → commission attaches AT COMPLETION   (event = completed_at),
--             and ONLY when a HUMAN closed it (closed_by <> 'system')
--
-- Everything the screen shows comes from here, so every summary number is a
-- sum over rows the screen also renders — the spec's traceability rule.
--
-- ⚠ THE compute_commission_draft DEFINED HERE IS SUPERSEDED by
-- 20260809155022_a02_draft_excludes_cancelled_and_human_no_show.sql, which
-- fixes a prepaid rule that counted CANCELLED bookings. The two helper
-- functions below are NOT superseded. Kept as applied, per the migration
-- convention — the sequence is the record.

-- ───────────────────────────────────────────────────────────────────────────
-- Rate resolution — shared, because issue_statement must agree with the draft
-- to the piaster or a re-issue would "change" numbers nobody touched.
--
-- ⚠ A MISSING RATE THROWS. It never defaults. `bookings.commission_rate`
-- carries a DEFAULT of 0.1200 and that default is exactly the failure mode this
-- guards against: a silent 12% on a partner we never agreed 12% with.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.commission_rate_at(p_provider_id UUID, p_on DATE)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE v_percent NUMERIC;
BEGIN
  SELECT percent INTO v_percent
  FROM provider_commission_rates
  WHERE provider_id = p_provider_id AND effective_from <= p_on
  ORDER BY effective_from DESC
  LIMIT 1;

  IF v_percent IS NULL THEN
    RAISE EXCEPTION
      'No commission rate is in effect for provider % on %. A rate is DATA — fix it in provider_commission_rates (A03), never default it.',
      p_provider_id, p_on
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_percent;
END;
$$;

-- Money math mirrors packages/core/src/business/pricing.ts exactly: integer
-- piasters, half-up at the boundary. round() on NUMERIC is half-away-from-zero
-- and amounts are non-negative, so it agrees with JS Math.round row for row.
CREATE OR REPLACE FUNCTION public.commission_piasters(p_amount_piasters BIGINT, p_percent NUMERIC)
RETURNS BIGINT
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$ SELECT round((p_amount_piasters::NUMERIC * p_percent) / 100)::BIGINT $$;

-- ───────────────────────────────────────────────────────────────────────────
-- The draft. (Body superseded — see the header note.)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_commission_draft(p_provider_id UUID, p_month DATE)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_month_start DATE;
  v_month_end   DATE;
  v_lines       JSONB;
  v_totals      JSONB;
BEGIN
  -- Its own authorization check. RLS does not protect a SECURITY DEFINER body;
  -- the body IS the boundary (ENGINEERING-WORKFLOW §5). No caller identity is
  -- taken as a parameter — there is no channel to carry a lie.
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_month_start := date_trunc('month', p_month)::DATE;
  v_month_end   := (v_month_start + INTERVAL '1 month - 1 day')::DATE;

  WITH scoped AS (
    SELECT
      b.id, b.booking_ref, b.total_amount, b.status, b.closed_by,
      b.confirmed_at, b.completed_at,
      s.slot_date,
      CASE
        WHEN pay.method = 'cash'     THEN 'cash'
        WHEN pay.method IS NOT NULL  THEN 'prepaid'
        ELSE 'cash'
      END AS method,
      pay.status AS payment_row_status
    FROM bookings b
    JOIN branches br ON br.id = b.branch_id
    JOIN slots    s  ON s.id  = b.slot_id
    LEFT JOIN LATERAL (
      SELECT p.method, p.status FROM payments p
      WHERE p.booking_id = b.id ORDER BY p.created_at DESC LIMIT 1
    ) pay ON TRUE
    WHERE br.provider_id = p_provider_id
  ),
  classified AS (
    SELECT
      sc.*,
      CASE
        WHEN sc.method = 'prepaid'
             AND sc.payment_row_status = 'completed'
             AND sc.confirmed_at IS NOT NULL
          THEN (sc.confirmed_at AT TIME ZONE 'Africa/Cairo')::DATE
        WHEN sc.method = 'cash'
             AND sc.status = 'completed'
             AND COALESCE(sc.closed_by, '') <> 'system'
             AND sc.completed_at IS NOT NULL
          THEN (sc.completed_at AT TIME ZONE 'Africa/Cairo')::DATE
      END AS event_date,
      CASE WHEN sc.method = 'prepaid' THEN 'payment' ELSE 'completion' END AS event_kind,
      (sc.status = 'no_show' AND sc.closed_by = 'system') AS is_system_closed
    FROM scoped sc
  ),
  rows_in_month AS (
    SELECT
      c.id, c.booking_ref, c.slot_date, c.method, c.event_date, c.event_kind,
      round(c.total_amount * 100)::BIGINT AS amount_piasters,
      c.is_system_closed
    FROM classified c
    WHERE (NOT c.is_system_closed AND c.event_date BETWEEN v_month_start AND v_month_end)
       OR (c.is_system_closed      AND c.slot_date  BETWEEN v_month_start AND v_month_end)
  ),
  priced AS (
    SELECT
      r.*,
      CASE WHEN r.is_system_closed THEN NULL
           ELSE commission_rate_at(p_provider_id, r.event_date) END AS rate_percent
    FROM rows_in_month r
  ),
  final AS (
    SELECT
      p.*,
      CASE WHEN p.is_system_closed THEN 0
           ELSE commission_piasters(p.amount_piasters, p.rate_percent) END AS commission_piasters
    FROM priced p
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'booking_id',          f.id,
      'booking_ref',         f.booking_ref,
      'booking_date',        f.slot_date,
      'method',              f.method,
      'event_date',          f.event_date,
      'event_kind',          CASE WHEN f.is_system_closed THEN 'excluded' ELSE f.event_kind END,
      'amount_piasters',     f.amount_piasters,
      'rate_percent',        f.rate_percent,
      'commission_piasters', f.commission_piasters,
      'excluded',            f.is_system_closed,
      'excluded_reason',     CASE WHEN f.is_system_closed THEN 'system_closed' END
    ) ORDER BY COALESCE(f.event_date, f.slot_date), f.booking_ref), '[]'::JSONB),
    jsonb_build_object(
      'gmv_piasters',              COALESCE(SUM(f.amount_piasters)     FILTER (WHERE NOT f.is_system_closed), 0),
      'commissionable_count',      COUNT(*)                            FILTER (WHERE NOT f.is_system_closed),
      'commission_total_piasters', COALESCE(SUM(f.commission_piasters) FILTER (WHERE NOT f.is_system_closed), 0),
      'excluded_count',            COUNT(*)                            FILTER (WHERE f.is_system_closed),
      'excluded_amount_piasters',  COALESCE(SUM(f.amount_piasters)     FILTER (WHERE f.is_system_closed), 0),
      'cash_count',                COUNT(*)                            FILTER (WHERE NOT f.is_system_closed AND f.method = 'cash'),
      'cash_gmv_piasters',         COALESCE(SUM(f.amount_piasters)     FILTER (WHERE NOT f.is_system_closed AND f.method = 'cash'), 0),
      'cash_commission_piasters',  COALESCE(SUM(f.commission_piasters) FILTER (WHERE NOT f.is_system_closed AND f.method = 'cash'), 0),
      'prepaid_count',             COUNT(*)                            FILTER (WHERE NOT f.is_system_closed AND f.method = 'prepaid'),
      'prepaid_gmv_piasters',      COALESCE(SUM(f.amount_piasters)     FILTER (WHERE NOT f.is_system_closed AND f.method = 'prepaid'), 0),
      'prepaid_commission_piasters', COALESCE(SUM(f.commission_piasters) FILTER (WHERE NOT f.is_system_closed AND f.method = 'prepaid'), 0),
      'rates_used', COALESCE((
        SELECT jsonb_agg(DISTINCT f2.rate_percent)
        FROM final f2 WHERE NOT f2.is_system_closed AND f2.rate_percent IS NOT NULL
      ), '[]'::JSONB)
    )
  INTO v_lines, v_totals
  FROM final f;

  RETURN jsonb_build_object(
    'provider_id', p_provider_id,
    'month',       v_month_start,
    'lines',       v_lines,
    'totals',      v_totals
  );
END;
$$;

-- Postgres grants EXECUTE to PUBLIC by default — the hole that made
-- confirm_booking client-callable for four features. Close it explicitly.
REVOKE ALL ON FUNCTION public.compute_commission_draft(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_commission_draft(UUID, DATE) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.commission_rate_at(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commission_rate_at(UUID, DATE) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.commission_piasters(BIGINT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.commission_piasters(BIGINT, NUMERIC) TO authenticated, service_role;
