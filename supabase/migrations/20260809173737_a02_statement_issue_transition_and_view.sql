-- A02 · the issuance lifecycle: مسودة → أُرسلت → تمت التسوية.
--
-- A statement is a DOCUMENT A PARTNER DISPUTES. Three properties follow, and
-- every guard below exists to hold one of them:
--   ① once issued, the numbers FREEZE — later booking activity must not
--      silently rewrite what a partner was sent;
--   ② a correction is a NEW VERSION, never an edit — v1 stays readable,
--      marked superseded;
--   ③ settled is TERMINAL — money has changed hands, so drift after that is a
--      credit-forward NOTE against next month, not a re-issue.

-- ───────────────────────────────────────────────────────────────────────────
-- issue_statement — snapshot the live draft into an immutable version.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.issue_statement(p_provider_id UUID, p_month DATE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_month     DATE := date_trunc('month', p_month)::DATE;
  v_draft     JSONB;
  v_totals    JSONB;
  v_latest    public.commission_statements%ROWTYPE;
  v_version   INTEGER;
  v_new_id    UUID;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_latest FROM commission_statements
   WHERE provider_id = p_provider_id AND month = v_month
   ORDER BY version DESC LIMIT 1;

  -- ③ SETTLED IS TERMINAL. Refused rather than versioned: re-issuing a
  -- statement the partner has already paid against would mean two documents
  -- both claiming to be final for the same month.
  IF v_latest.id IS NOT NULL AND v_latest.status = 'settled' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'already_settled');
  END IF;

  v_draft  := compute_commission_draft(p_provider_id, v_month);
  v_totals := v_draft -> 'totals';

  -- DOUBLE-ISSUE GUARD. Re-issuing an unchanged month would produce a v2 that
  -- differs from v1 only by a timestamp, and hand the partner a "correction"
  -- correcting nothing.
  IF v_latest.id IS NOT NULL
     AND v_latest.gmv_piasters              = (v_totals ->> 'gmv_piasters')::BIGINT
     AND v_latest.commission_total_piasters = (v_totals ->> 'commission_total_piasters')::BIGINT
     AND v_latest.commissionable_count      = (v_totals ->> 'commissionable_count')::INTEGER
     AND v_latest.excluded_count            = (v_totals ->> 'excluded_count')::INTEGER
  THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_changes_since_last_issue',
                              'statement_id', v_latest.id, 'version', v_latest.version);
  END IF;

  v_version := COALESCE(v_latest.version, 0) + 1;

  INSERT INTO commission_statements (
    provider_id, month, version, status, issued_by,
    gmv_piasters, commissionable_count, commission_total_piasters,
    excluded_count, excluded_amount_piasters
  ) VALUES (
    p_provider_id, v_month, v_version, 'issued', v_uid,
    (v_totals ->> 'gmv_piasters')::BIGINT,
    (v_totals ->> 'commissionable_count')::INTEGER,
    (v_totals ->> 'commission_total_piasters')::BIGINT,
    (v_totals ->> 'excluded_count')::INTEGER,
    (v_totals ->> 'excluded_amount_piasters')::BIGINT
  ) RETURNING id INTO v_new_id;

  -- ① THE FREEZE. Lines are copied, not referenced — including the EXCLUDED
  -- ones, because the export must print them with their reason and a zero.
  INSERT INTO commission_statement_lines (
    statement_id, booking_id, booking_ref, booking_date, method,
    event_date, event_kind, amount_piasters, rate_percent, commission_piasters,
    excluded, excluded_reason
  )
  SELECT v_new_id,
         (l ->> 'booking_id')::UUID,
         l ->> 'booking_ref',
         (l ->> 'booking_date')::DATE,
         l ->> 'method',
         (l ->> 'event_date')::DATE,
         l ->> 'event_kind',
         (l ->> 'amount_piasters')::BIGINT,
         (l ->> 'rate_percent')::NUMERIC,
         (l ->> 'commission_piasters')::BIGINT,
         (l ->> 'excluded')::BOOLEAN,
         l ->> 'excluded_reason'
  FROM jsonb_array_elements(v_draft -> 'lines') AS l;

  -- ② The predecessor is SUPERSEDED, never deleted — «نسخة ملغاة» stays
  -- viewable and exportable for the record.
  IF v_latest.id IS NOT NULL THEN
    UPDATE commission_statements
       SET status = 'superseded', superseded_by = v_new_id
     WHERE id = v_latest.id;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'statement_id', v_new_id,
                            'version', v_version, 'supersedes', v_latest.id);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- transition_statement — the manual toggle the founder drives. v1 truth is
-- that «أُرسلت» and «تمت التسوية» are human facts, not automated ones.
--
-- DISPLAY = ENFORCEMENT: the buttons the screen offers are exactly the
-- transitions this function accepts. Anything else is refused here, so the UI
-- can never present an action the server will reject.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.transition_statement(p_statement_id UUID, p_to TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.commission_statements%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_row FROM commission_statements WHERE id = p_statement_id;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'statement_not_found');
  END IF;

  IF p_to NOT IN ('sent', 'settled') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unsupported_transition');
  END IF;

  -- The only legal walk is issued → sent → settled, on the CURRENT version.
  -- A superseded version is history and cannot move; settled is terminal.
  IF v_row.status = 'superseded' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'superseded_is_read_only');
  END IF;
  IF v_row.status = 'settled' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'already_settled');
  END IF;
  IF p_to = 'sent'    AND v_row.status <> 'issued' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'illegal_transition');
  END IF;
  IF p_to = 'settled' AND v_row.status <> 'sent' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'illegal_transition');
  END IF;

  UPDATE commission_statements
     SET status     = p_to,
         sent_at    = CASE WHEN p_to = 'sent'    THEN NOW() ELSE sent_at    END,
         sent_by    = CASE WHEN p_to = 'sent'    THEN v_uid ELSE sent_by    END,
         settled_at = CASE WHEN p_to = 'settled' THEN NOW() ELSE settled_at END,
         settled_by = CASE WHEN p_to = 'settled' THEN v_uid ELSE settled_by END
   WHERE id = p_statement_id;

  RETURN jsonb_build_object('success', TRUE, 'status', p_to);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- get_commission_statement_view — everything ONE screen render needs, in one
-- round trip: the version history, the rows to show (snapshot if issued, live
-- draft if not), and the CHANGE DETECTION that drives the warning strip.
--
-- The comparison is live-recompute vs frozen-snapshot. It is what turns
-- "the data moved after we sent this" from something nobody notices into a
-- red strip with a number on it.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_commission_statement_view(
  p_provider_id UUID, p_month DATE, p_version INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid      UUID := auth.uid();
  v_month    DATE := date_trunc('month', p_month)::DATE;
  v_draft    JSONB;
  v_live     JSONB;
  v_sel      public.commission_statements%ROWTYPE;
  v_versions JSONB;
  v_lines    JSONB;
  v_changed  BOOLEAN := FALSE;
  v_delta    BIGINT  := 0;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_draft := compute_commission_draft(p_provider_id, v_month);
  v_live  := v_draft -> 'totals';

  SELECT * INTO v_sel FROM commission_statements
   WHERE provider_id = p_provider_id AND month = v_month
     AND (p_version IS NULL OR version = p_version)
   ORDER BY version DESC LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', s.id, 'version', s.version, 'status', s.status,
           'issued_at', s.issued_at, 'sent_at', s.sent_at, 'settled_at', s.settled_at,
           'superseded_by', s.superseded_by,
           'commission_total_piasters', s.commission_total_piasters
         ) ORDER BY s.version DESC), '[]'::JSONB)
    INTO v_versions
    FROM commission_statements s
   WHERE s.provider_id = p_provider_id AND s.month = v_month;

  IF v_sel.id IS NULL THEN
    -- Never issued: the screen is a LIVE DRAFT and says so.
    v_lines := v_draft -> 'lines';
  ELSE
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'booking_id', l.booking_id, 'booking_ref', l.booking_ref,
             'booking_date', l.booking_date, 'method', l.method,
             'event_date', l.event_date, 'event_kind', l.event_kind,
             'amount_piasters', l.amount_piasters, 'rate_percent', l.rate_percent,
             'commission_piasters', l.commission_piasters,
             'excluded', l.excluded, 'excluded_reason', l.excluded_reason
           ) ORDER BY COALESCE(l.event_date, l.booking_date), l.booking_ref), '[]'::JSONB)
      INTO v_lines
      FROM commission_statement_lines l WHERE l.statement_id = v_sel.id;

    -- Change detection only means anything for the CURRENT version. A
    -- superseded one is history; of course it differs from today.
    IF v_sel.status <> 'superseded' THEN
      v_changed := v_sel.commission_total_piasters <> (v_live ->> 'commission_total_piasters')::BIGINT
                OR v_sel.gmv_piasters              <> (v_live ->> 'gmv_piasters')::BIGINT
                OR v_sel.commissionable_count      <> (v_live ->> 'commissionable_count')::INTEGER;
      v_delta := (v_live ->> 'commission_total_piasters')::BIGINT - v_sel.commission_total_piasters;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'provider_id', p_provider_id,
    'month',       v_month,
    'statement',   CASE WHEN v_sel.id IS NULL THEN NULL ELSE jsonb_build_object(
                     'id', v_sel.id, 'version', v_sel.version, 'status', v_sel.status,
                     'issued_at', v_sel.issued_at, 'sent_at', v_sel.sent_at,
                     'settled_at', v_sel.settled_at, 'superseded_by', v_sel.superseded_by,
                     'totals', jsonb_build_object(
                       'gmv_piasters', v_sel.gmv_piasters,
                       'commissionable_count', v_sel.commissionable_count,
                       'commission_total_piasters', v_sel.commission_total_piasters,
                       'excluded_count', v_sel.excluded_count,
                       'excluded_amount_piasters', v_sel.excluded_amount_piasters)) END,
    'is_draft',    v_sel.id IS NULL,
    'lines',       v_lines,
    'live_totals', v_live,
    -- The warning strip on an issued/sent statement; the credit-forward note
    -- on a settled one. Same fact, two different remedies.
    'changed_since_issue', v_changed,
    'delta_commission_piasters', v_delta,
    'credit_forward', v_changed AND v_sel.status = 'settled',
    'versions', v_versions
  );
END;
$$;

REVOKE ALL ON FUNCTION public.issue_statement(UUID, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_statement(UUID, DATE) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.transition_statement(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_statement(UUID, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_commission_statement_view(UUID, DATE, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_commission_statement_view(UUID, DATE, INTEGER) TO authenticated, service_role;
