-- ═══════════════════════════════════════════════════════════════════════════
-- P03 — provider-managed service prices, with an audit trail.
--
-- The launch-blocker "replace the placeholder prices" stops being a code task
-- and becomes a data-entry task for partners.
--
-- MONEY CONTRACT (verified before writing any of this, SPEC-P03 pre-work):
-- editing a price CANNOT alter an existing booking. `booking_services`
-- snapshots `price_at_booking`; both read functions use that snapshot;
-- `settle-payment` joins `branch_services` only for names and preparation
-- notes; `booking-reminder` reads no price at all. The design says as much to
-- the user — «الحجوزات القائمة تحتفظ بسعرها القديم» — and it is true.
--
-- Everything the client can influence is validated server-side, per the law in
-- ENGINEERING-WORKFLOW §5: the client supplies an identity and a proposed
-- price; the server decides whether that price is allowed and records who
-- changed it.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── the audit trail ────────────────────────────────────────────────────────
-- Dispute insurance, and the data behind "آخر تحديث" per row. Append-only:
-- there is no UPDATE or DELETE policy, and no client grant at all — rows are
-- written by the SECURITY DEFINER function below and read through it.
CREATE TABLE IF NOT EXISTS public.branch_service_price_history (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_service_id UUID NOT NULL REFERENCES branch_services(id) ON DELETE CASCADE,
  old_price         NUMERIC,
  new_price         NUMERIC NOT NULL,
  old_is_available  BOOLEAN,
  new_is_available  BOOLEAN NOT NULL,
  changed_by        UUID REFERENCES auth.users(id),
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bsph_service_time
  ON public.branch_service_price_history (branch_service_id, changed_at DESC);

ALTER TABLE public.branch_service_price_history ENABLE ROW LEVEL SECURITY;

-- Staff of the owning branch (and admins) may READ their own history. No
-- INSERT/UPDATE/DELETE policy exists for anyone: the function owns writes.
DROP POLICY IF EXISTS "price history: branch staff read own" ON public.branch_service_price_history;
CREATE POLICY "price history: branch staff read own"
  ON public.branch_service_price_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM branch_services bs
       WHERE bs.id = branch_service_price_history.branch_service_id
         AND (COALESCE(bs.branch_id = ANY (get_provider_branch_ids()), FALSE)
              OR get_user_role() = 'admin')
    )
  );

-- ── the editor's read ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_branch_services_for_editor(p_branch_id uuid)
RETURNS TABLE(
  branch_service_id uuid,
  service_id uuid,
  name_ar text,
  name_en text,
  category_slug text,
  category_name_ar text,
  price numeric,
  is_available boolean,
  preparation_notes_ar text,
  -- NULL when the price has never been edited. Empty means absent: the UI
  -- shows «لم يُحدَّث بعد», never a fabricated date.
  last_changed_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
    AND COALESCE(s.is_active, FALSE)
  -- Grouped by category in the SAME order the patient app groups them, so the
  -- desk and the patient see one catalogue, not two orderings.
  ORDER BY sc.sort_order NULLS LAST, sc.name_ar, s.sort_order NULLS LAST, s.name_ar;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_branch_services_for_editor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_branch_services_for_editor(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_branch_services_for_editor(uuid)
  TO authenticated, service_role;

-- ── the write ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_branch_service(
  p_branch_service_id uuid,
  p_price_egp integer,
  p_is_available boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row       branch_services;
  v_old_price NUMERIC;
  v_old_avail BOOLEAN;
BEGIN
  SELECT * INTO v_row FROM branch_services WHERE id = p_branch_service_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'service_not_found');
  END IF;

  IF NOT (
       is_internal_caller()
    OR COALESCE(v_row.branch_id = ANY (get_provider_branch_ids()), FALSE)
    OR (get_user_role() = 'admin')
  ) THEN
    -- Indistinguishable from a missing row: never confirm to a stranger that
    -- a given branch_service id exists.
    RETURN jsonb_build_object('success', false, 'error', 'service_not_found');
  END IF;

  IF p_price_egp IS NULL OR p_is_available IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  -- Sane bounds. A price of 0 is not "free", it is a typo — a genuinely free
  -- service is modelled by making it unavailable, not by pricing it at zero.
  IF p_price_egp <= 0 OR p_price_egp > 100000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'price_out_of_bounds',
                              'min', 1, 'max', 100000);
  END IF;

  v_old_price := v_row.price;
  v_old_avail := COALESCE(v_row.is_available, FALSE);

  -- The absurd-jump guard. The client's type-to-confirm handles ordinary big
  -- changes as UX; THIS is the real boundary, and it is deliberately far wider
  -- than the UI's 50% so a legitimate correction is never blocked — only a
  -- fat-fingered extra digit is. Symmetric: 10x up and 10x down are both
  -- absurd on a price list.
  IF v_old_price > 0 AND (
       p_price_egp::NUMERIC > v_old_price * 10
    OR p_price_egp::NUMERIC < v_old_price / 10
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'price_change_too_large',
                              'old_price', v_old_price, 'attempted', p_price_egp);
  END IF;

  -- Nothing actually changed: succeed without writing an audit row, so the
  -- trail records CHANGES rather than clicks.
  IF v_old_price = p_price_egp::NUMERIC AND v_old_avail = p_is_available THEN
    RETURN jsonb_build_object('success', true, 'unchanged', true,
                              'price', v_old_price, 'is_available', v_old_avail);
  END IF;

  UPDATE branch_services
     SET price = p_price_egp, is_available = p_is_available, updated_at = NOW()
   WHERE id = p_branch_service_id;

  INSERT INTO branch_service_price_history
    (branch_service_id, old_price, new_price, old_is_available, new_is_available, changed_by)
  VALUES (p_branch_service_id, v_old_price, p_price_egp, v_old_avail, p_is_available, auth.uid());

  RETURN jsonb_build_object(
    'success', true, 'unchanged', false,
    'price', p_price_egp, 'is_available', p_is_available,
    'changed_at', NOW()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.update_branch_service(uuid, integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_branch_service(uuid, integer, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_branch_service(uuid, integer, boolean)
  TO authenticated, service_role;

-- ── close the direct-write door ────────────────────────────────────────────
-- Same discipline as the booking-money fix: an RPC beside an open UPDATE
-- policy is decoration. Check what exists and remove any client write path.
DROP POLICY IF EXISTS "branch_services: provider updates own" ON public.branch_services;
DROP POLICY IF EXISTS "branch_services: provider manages own" ON public.branch_services;
