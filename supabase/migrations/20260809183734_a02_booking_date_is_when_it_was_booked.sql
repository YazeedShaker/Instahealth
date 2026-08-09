-- A02 · FIX, caught by READING the fidelity capture rather than the markup.
--
-- The statement's «تاريخ الحجز» column was rendering `slots.slot_date` — the
-- VISIT date, not the date the booking was made. On any screen that would be
-- sloppy; on this one it is a factual mislabel in a document a partner disputes,
-- sitting one column away from «تاريخ الاستحقاق». A partner reconciling a cash
-- visit would see two dates that both describe the visit and neither of which
-- says when the patient actually booked.
--
-- `bookings.created_at`, read in Africa/Cairo, is literally تاريخ الحجز.
--
-- ⚠ THE EXCLUSION WINDOW STILL USES slot_date, deliberately and unchanged. An
-- auto-closed booking belongs to the month of the VISIT that did not happen —
-- the nightly job stamps `no_show_at` 24h+ later, and a booking MADE in June
-- for a visit on 1 July belongs in July's excluded strip, not June's. The two
-- dates answer two different questions, which is exactly why conflating them
-- was wrong.
--
-- ⚠ This is also §9's lesson in its plainest form: the bug was invisible in the
-- markup, in the types and in four passing E2E assertions. It became obvious
-- the moment someone looked at the picture.
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
      -- تاريخ الحجز — when the patient booked, in Cairo.
      (b.created_at AT TIME ZONE 'Africa/Cairo')::DATE AS booked_on,
      CASE
        WHEN pay.method = 'cash'    THEN 'cash'
        WHEN pay.method IS NOT NULL THEN 'prepaid'
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
    SELECT sc.*,
      CASE
        WHEN sc.method = 'prepaid'
             AND sc.payment_row_status = 'completed'
             AND sc.confirmed_at IS NOT NULL
             AND sc.status IN ('confirmed','arrived','completed')
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
    SELECT c.id, c.booking_ref, c.booked_on, c.method, c.event_date, c.event_kind,
           round(c.total_amount * 100)::BIGINT AS amount_piasters, c.is_system_closed
    FROM classified c
    WHERE (NOT c.is_system_closed AND c.event_date BETWEEN v_month_start AND v_month_end)
       OR (c.is_system_closed      AND c.slot_date  BETWEEN v_month_start AND v_month_end)
  ),
  priced AS (
    SELECT r.*, CASE WHEN r.is_system_closed THEN NULL
                     ELSE commission_rate_at(p_provider_id, r.event_date) END AS rate_percent
    FROM rows_in_month r
  ),
  final AS (
    SELECT p.*, CASE WHEN p.is_system_closed THEN 0
                     ELSE commission_piasters(p.amount_piasters, p.rate_percent) END AS commission_piasters
    FROM priced p
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'booking_id', f.id, 'booking_ref', f.booking_ref, 'booking_date', f.booked_on,
      'method', f.method, 'event_date', f.event_date,
      'event_kind', CASE WHEN f.is_system_closed THEN 'excluded' ELSE f.event_kind END,
      'amount_piasters', f.amount_piasters, 'rate_percent', f.rate_percent,
      'commission_piasters', f.commission_piasters, 'excluded', f.is_system_closed,
      'excluded_reason', CASE WHEN f.is_system_closed THEN 'system_closed' END
    ) ORDER BY COALESCE(f.event_date, f.booked_on), f.booking_ref), '[]'::JSONB),
    jsonb_build_object(
      'gmv_piasters',              COALESCE(SUM(f.amount_piasters)     FILTER (WHERE NOT f.is_system_closed), 0),
      'commissionable_count',      COUNT(*)                            FILTER (WHERE NOT f.is_system_closed),
      'commission_total_piasters', COALESCE(SUM(f.commission_piasters) FILTER (WHERE NOT f.is_system_closed), 0),
      'excluded_count',            COUNT(*)                            FILTER (WHERE f.is_system_closed),
      'excluded_amount_piasters',  COALESCE(SUM(f.amount_piasters)     FILTER (WHERE f.is_system_closed), 0),
      'cash_count',                COUNT(*)                            FILTER (WHERE NOT f.is_system_closed AND f.method='cash'),
      'cash_gmv_piasters',         COALESCE(SUM(f.amount_piasters)     FILTER (WHERE NOT f.is_system_closed AND f.method='cash'), 0),
      'cash_commission_piasters',  COALESCE(SUM(f.commission_piasters) FILTER (WHERE NOT f.is_system_closed AND f.method='cash'), 0),
      'prepaid_count',             COUNT(*)                            FILTER (WHERE NOT f.is_system_closed AND f.method='prepaid'),
      'prepaid_gmv_piasters',      COALESCE(SUM(f.amount_piasters)     FILTER (WHERE NOT f.is_system_closed AND f.method='prepaid'), 0),
      'prepaid_commission_piasters', COALESCE(SUM(f.commission_piasters) FILTER (WHERE NOT f.is_system_closed AND f.method='prepaid'), 0),
      'rates_used', COALESCE((SELECT jsonb_agg(DISTINCT f2.rate_percent) FROM final f2
                              WHERE NOT f2.is_system_closed AND f2.rate_percent IS NOT NULL), '[]'::JSONB)
    )
  INTO v_lines, v_totals
  FROM final f;

  RETURN jsonb_build_object('provider_id', p_provider_id, 'month', v_month_start,
                            'lines', v_lines, 'totals', v_totals);
END;
$$;

REVOKE ALL ON FUNCTION public.compute_commission_draft(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_commission_draft(UUID, DATE) TO authenticated, service_role;
