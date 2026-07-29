-- ═══════════════════════════════════════════════════════════════════════════
-- Server-side search, status filter and pagination for the dashboard tables.
--
-- Filtering in the CLIENT only works while a day is small. A branch day is
-- capped by `instahealth_slot_allocation` today (5 at launch), but the desk's
-- tables are the pattern every later P-series table copies, and "fetch
-- everything then filter in React" is exactly the habit that does not survive
-- a busy branch or a date RANGE view. So the database filters, counts and
-- paginates, and the client asks for one page.
--
-- Everything is a DEFAULTED parameter, so existing callers keep working
-- unchanged: `get_branch_bookings_for_date(branch, date)` still means "the
-- whole day, unfiltered".
--
-- The authorization check is unchanged and still runs FIRST — a search term
-- must never become a way to probe another branch's patients.
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_branch_bookings_for_date(uuid, date);

CREATE FUNCTION public.get_branch_bookings_for_date(
  p_branch_id uuid,
  p_date date,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT NULL,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  booking_ref character varying,
  status character varying,
  payment_status character varying,
  payment_method character varying,
  total_amount numeric,
  patient_notes text,
  slot_id uuid,
  slot_date date,
  slot_time time without time zone,
  created_at timestamp with time zone,
  confirmed_at timestamp with time zone,
  arrived_at timestamp with time zone,
  completed_at timestamp with time zone,
  no_show_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  cancelled_by character varying,
  cancellation_reason text,
  closed_by character varying,
  patient_name_ar text,
  patient_phone text,
  services jsonb,
  -- Total matching the FILTER, before the page window. The client needs this
  -- for "٣ من ٤٧" and to know whether another page exists; deriving it from
  -- the returned rows would only ever describe the page.
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_search TEXT;
BEGIN
  IF NOT (
       is_internal_caller()
    OR COALESCE(p_branch_id = ANY (get_provider_branch_ids()), FALSE)
    OR (get_user_role() = 'admin')
  ) THEN
    -- Not staff for this branch: zero rows, not an error. A patient calling
    -- this learns nothing about the branch's day.
    RETURN;
  END IF;

  -- Normalise the search term ONCE. Arabic-Indic digits are folded to Western
  -- so a receptionist typing ٠١٠ finds a phone stored as 010 — the same rule
  -- core's convertArabicDigits applies on the patient side. `%` and `_` are
  -- escaped so a stray wildcard cannot widen the match.
  v_search := NULLIF(BTRIM(COALESCE(p_search, '')), '');
  IF v_search IS NOT NULL THEN
    v_search := translate(v_search, '٠١٢٣٤٥٦٧٨٩', '0123456789');
    v_search := replace(replace(replace(v_search, '\', '\'), '%', '\%'), '_', '\_');
    v_search := '%' || v_search || '%';
  END IF;

  RETURN QUERY
  WITH matched AS (
    SELECT
      b.id, b.booking_ref, b.status, b.payment_status, b.payment_method,
      b.total_amount, b.patient_notes, b.slot_id, s.slot_date, s.slot_time,
      b.created_at, b.confirmed_at, b.arrived_at, b.completed_at, b.no_show_at,
      b.cancelled_at, b.cancelled_by, b.cancellation_reason, b.closed_by,
      u.name_ar::TEXT AS patient_name_ar,
      u.phone::TEXT   AS patient_phone,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', sv.id, 'nameAr', sv.name_ar, 'nameEn', sv.name_en,
            'priceEgp', bsv.price_at_booking,
            'preparationNotesAr', sv.preparation_notes_ar,
            'preparationNotesEn', sv.preparation_notes_en
          ) ORDER BY sv.name_ar
        ) FILTER (WHERE sv.id IS NOT NULL),
        '[]'::jsonb
      ) AS services
    FROM bookings b
    JOIN slots s ON s.id = b.slot_id
    LEFT JOIN users u ON u.id = b.user_id
    LEFT JOIN booking_services bsv ON bsv.booking_id = b.id
    LEFT JOIN branch_services  xbs ON xbs.id = bsv.branch_service_id
    LEFT JOIN services         sv  ON sv.id  = xbs.service_id
    WHERE b.branch_id = p_branch_id
      AND s.slot_date = p_date
      -- Abandoned checkout rows are flow debris, never a booking the desk acts
      -- on. Cancellations DO show: the desk must see them, not have rows vanish.
      AND b.status <> 'pending_payment'
      AND (p_status IS NULL OR b.status::text = p_status)
      AND (
        v_search IS NULL
        OR u.name_ar ILIKE v_search ESCAPE '\'
        OR translate(u.phone, '٠١٢٣٤٥٦٧٨٩', '0123456789') ILIKE v_search ESCAPE '\'
        OR b.booking_ref ILIKE v_search ESCAPE '\'
      )
    GROUP BY b.id, s.slot_date, s.slot_time, u.name_ar, u.phone
  )
  SELECT m.*, COUNT(*) OVER () AS total_count
  FROM matched m
  -- id breaks ties so paging is STABLE: two bookings can share a slot_time,
  -- and an unstable sort silently repeats or drops rows across pages.
  ORDER BY m.slot_time, m.id
  LIMIT NULLIF(p_limit, 0)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_branch_bookings_for_date(uuid, date, text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_branch_bookings_for_date(uuid, date, text, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_branch_bookings_for_date(uuid, date, text, text, integer, integer)
  TO authenticated, service_role;

-- Search hits name/phone on `users` and ref on `bookings`; the day filter is
-- already served by the slots join. This index makes the branch+day scan cheap
-- as history grows, which is what pagination exists for.
CREATE INDEX IF NOT EXISTS idx_bookings_branch_status ON bookings (branch_id, status);
