-- A02 · FIX, caught by running the draft against REAL dev data before trusting it.
--
-- The first prepaid rule was `payments.status = 'completed' AND confirmed_at IS
-- NOT NULL` and said nothing about the booking's own status. Money having moved
-- is not the same as a visit having happened, so it counted CANCELLED bookings:
-- Saridar's entire July "statement" was two cancellations (1,050 EGP) and three
-- more inflated Town's. That is an invoice to a partner for services never
-- delivered — the precise failure DECISION-commission-attachment exists to
-- prevent ("we only bill a partner for a visit that actually happened").
--
-- The decision doc is explicit that auto-closed bookings never attach
-- commission, and SPEC-A02's own test list requires human no_show / cancelled
-- to produce ZERO ROWS — not excluded rows, absent ones. Only system-closed
-- no_shows earn a visible struck-through line, because only they are the
-- system GUESSING and the founder ruled that guess must be footnoted in the
-- open rather than hidden.
--
-- So a prepaid booking is commissionable when the money moved AND the booking
-- is still live or fulfilled: status IN ('confirmed','arrived','completed').
-- Cash was already correct — it requires status = 'completed' outright.
--
-- Measured after the fix, against live dev:
--   Town   يوليو  ٢٠٢٦ → 4 cash + 4 prepaid = 8 counted, 2,700 EGP, 324 commission; 3 excluded (1,650)
--   Town   أغسطس ٢٠٢٦ → 2 cash = 2 counted, 300 EGP, 36 commission; 1 excluded (250)
--   Saridar both months → ZERO counted rows (it has only cancellations) — the honest-zero state
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
      b.confirmed_at, b.completed_at, s.slot_date,
      -- ⚠ METHOD IS EVIDENCE, and the evidence is the payments row. A booking
      -- with NO payments row never went through confirm_booking — mock-era seed
      -- rows predating the settlement plumbing. v1 collects cash only, so they
      -- read as CASH and attach at COMPLETION, the only event they have.
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
        -- PREPAID → attaches AT PAYMENT. Money moved AND the booking is live or
        -- fulfilled. A cancellation or a no_show never earns commission.
        WHEN sc.method = 'prepaid'
             AND sc.payment_row_status = 'completed'
             AND sc.confirmed_at IS NOT NULL
             AND sc.status IN ('confirmed','arrived','completed')
          THEN (sc.confirmed_at AT TIME ZONE 'Africa/Cairo')::DATE
        -- CASH → attaches AT COMPLETION, and only a HUMAN's completion counts.
        WHEN sc.method = 'cash'
             AND sc.status = 'completed'
             AND COALESCE(sc.closed_by, '') <> 'system'
             AND sc.completed_at IS NOT NULL
          THEN (sc.completed_at AT TIME ZONE 'Africa/Cairo')::DATE
      END AS event_date,
      CASE WHEN sc.method = 'prepaid' THEN 'payment' ELSE 'completion' END AS event_kind,
      -- The amber strip. In-month by the VISIT date, not no_show_at: the
      -- nightly job runs 24h+ later and would drag a month-end visit forward.
      (sc.status = 'no_show' AND sc.closed_by = 'system') AS is_system_closed
    FROM scoped sc
  ),
  rows_in_month AS (
    SELECT c.id, c.booking_ref, c.slot_date, c.method, c.event_date, c.event_kind,
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
      'booking_id', f.id, 'booking_ref', f.booking_ref, 'booking_date', f.slot_date,
      'method', f.method, 'event_date', f.event_date,
      'event_kind', CASE WHEN f.is_system_closed THEN 'excluded' ELSE f.event_kind END,
      'amount_piasters', f.amount_piasters, 'rate_percent', f.rate_percent,
      'commission_piasters', f.commission_piasters, 'excluded', f.is_system_closed,
      'excluded_reason', CASE WHEN f.is_system_closed THEN 'system_closed' END
    ) ORDER BY COALESCE(f.event_date, f.slot_date), f.booking_ref), '[]'::JSONB),
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
