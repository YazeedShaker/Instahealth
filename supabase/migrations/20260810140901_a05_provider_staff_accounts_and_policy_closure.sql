-- A05 · PROVIDER STAFF ACCOUNTS — who may open the partner portal, and for
-- which branch.
--
-- A05 closes `provider_users: admin full access`, the tenth of A01's eleven,
-- by building the writers that replace it. Creation and disablement need the
-- Auth Admin API (an auth.users row, a ban, a session kill), which Postgres
-- cannot reach — so the WRITERS live in the `admin-staff-accounts` Edge
-- Function on the service role, and this migration owns the schema, the audit
-- trail, the previews and the READ side. See ⑦.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ⓪ WHAT THE LIVE TABLE ACTUALLY HAD
-- ═══════════════════════════════════════════════════════════════════════════
-- `provider_users` carried id, auth_user_id, provider_id, branch_ids, role,
-- is_active, created_at. The frame needs four more facts and only two of them
-- are new columns:
--
--   اسم المستخدم   → NEW COLUMN. There was nowhere to put a staff member's
--                     name; the portal fell back to `user_metadata.full_name`
--                     or the email address.
--   البريد          → auth.users.email. NOT a new column — duplicating an
--                     identity into a second table is how they drift.
--   آخر دخول        → auth.users.last_sign_in_at. Same reasoning. This is also
--                     what makes the «لم يُستخدم بعد» state real rather than
--                     inferred: it is NULL exactly when nobody has ever
--                     signed in.
--   كلمة مؤقتة      → NEW COLUMNS: must_change_password + temp_password_issued_at.
--
-- ⚠ BACKFILL: the three existing provider_users rows get must_change_password
-- = FALSE. They are the dev logins the Playwright dashboard suite signs in
-- with (PROVIDER_TEST_*); defaulting them to TRUE would route every one of
-- those tests into a forced password change and turn the whole suite red for a
-- reason that looks nothing like its cause.

-- ───────────────────────────────────────────────────────────────────────────
-- ① The columns.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.provider_users
  ADD COLUMN name TEXT,
  ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN temp_password_issued_at TIMESTAMPTZ;

UPDATE public.provider_users SET must_change_password = FALSE;

COMMENT ON COLUMN public.provider_users.must_change_password IS
  'TRUE while a temp password issued by the admin has not been replaced. Set by the admin-staff-accounts Edge Function, cleared only by complete_provider_password_change().';
COMMENT ON COLUMN public.provider_users.temp_password_issued_at IS
  'When the current temp password was issued. With must_change_password it is the whole 72-hour staleness rule — no cron, evaluated at login.';

-- ───────────────────────────────────────────────────────────────────────────
-- ② The audit trail — and why it has a `source` column.
--
-- The frame's panel says «على هذا الحساب — يشمل الدخول والتعطيل» and badges
-- each row «الإدارة» or «بوابة الشركاء»: the partner's own first-login password
-- change appears in the admin's panel. That badge cannot be derived at read
-- time by asking whether `changed_by` is an admin, because one person can
-- legitimately act in both capacities — the §5 discriminator law. Each writer
-- states which portal it is, because each writer is only ever one of them.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE public.provider_user_history (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_user_id UUID NOT NULL REFERENCES public.provider_users(id) ON DELETE CASCADE,
  action           TEXT NOT NULL,
  source           TEXT NOT NULL CHECK (source IN ('admin', 'partner')),
  old_values       JSONB NOT NULL DEFAULT '{}'::JSONB,
  new_values       JSONB NOT NULL DEFAULT '{}'::JSONB,
  changed_by       UUID REFERENCES auth.users(id),
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX provider_user_history_by_account
  ON public.provider_user_history (provider_user_id, changed_at DESC);

COMMENT ON TABLE public.provider_user_history IS
  'Every event on a staff account from EITHER portal: account_created, temp_password_issued, password_changed, account_disabled, account_enabled, account_updated. Read-only, append-only, never pruned.';

ALTER TABLE public.provider_user_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff history: admin reads"
  ON public.provider_user_history FOR SELECT
  USING (public.get_user_role() = 'admin');

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
  ON public.provider_user_history FROM anon, authenticated;
REVOKE ALL ON public.provider_user_history FROM anon;

-- ───────────────────────────────────────────────────────────────────────────
-- ③ THE PROVIDER PORTAL'S GATE.
--
-- Mirrors get_admin_auth_state(): ONE round trip answers every question the
-- gate has, so the answers cannot disagree with each other. It takes NO
-- parameters — the account is `auth.uid()` and nothing else (§5: a read
-- function with a p_user_id is the cancel_booking hole for reads).
--
-- ⚠ THE 72-HOUR RULE IS EVALUATED HERE, AT LOGIN, AND IT IS INDEPENDENT OF THE
-- FLAG BEING CLEARED. "Unused" is precisely `must_change_password` still TRUE:
-- once the staff member has replaced the temp it is not a temp any more and
-- never expires. No cron, no background job — the only moment the answer
-- matters is the moment someone tries to get in.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_provider_login_state()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.provider_users%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('is_provider', FALSE, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_row FROM provider_users WHERE auth_user_id = v_uid;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('is_provider', FALSE, 'reason', 'not_provider');
  END IF;

  -- A disabled account is reported as not-a-provider rather than as a disabled
  -- provider: the portal has nothing useful to say to it and the login screen
  -- already refuses it. The BAN on auth.users is the real lockout; this is the
  -- backstop for a session that was already open when the admin disabled it.
  IF NOT COALESCE(v_row.is_active, FALSE) THEN
    RETURN jsonb_build_object('is_provider', FALSE, 'reason', 'account_disabled');
  END IF;

  RETURN jsonb_build_object(
    'is_provider', TRUE,
    'provider_user_id', v_row.id,
    'name', v_row.name,
    'must_change_password', v_row.must_change_password,
    'temp_password_issued_at', v_row.temp_password_issued_at,
    'temp_password_expired',
      v_row.must_change_password
      AND v_row.temp_password_issued_at IS NOT NULL
      AND v_row.temp_password_issued_at < NOW() - INTERVAL '72 hours',
    'branch_ids', to_jsonb(COALESCE(v_row.branch_ids, '{}'::UUID[]))
  );
END;
$$;

-- Cleared ONLY here, and only from the flag being set — so it is idempotent and
-- it is not a general-purpose switch.
--
-- ⚠ RESIDUAL, STATED RATHER THAN HIDDEN: like its A01 sibling
-- complete_admin_password_change(), this trusts that the client called
-- auth.updateUser({password}) successfully immediately before it. Postgres
-- cannot see a GoTrue password change — auth.users has no password_changed_at,
-- and `updated_at` moves for other reasons too. The exposure is self-inflicted
-- by an already-authenticated staff member keeping their own temp password,
-- not privilege escalation. What it does NOT weaken is the 72-hour rule: an
-- unused temp stays refused whatever this function is called with, because the
-- expiry in ③ reads the same flag this one clears.
CREATE OR REPLACE FUNCTION public.complete_provider_password_change()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_authenticated');
  END IF;

  UPDATE provider_users
     SET must_change_password = FALSE,
         temp_password_issued_at = NULL
   WHERE auth_user_id = v_uid
     AND is_active = TRUE
     AND must_change_password = TRUE
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    -- Either not staff, disabled, or the flag was already clear. All three are
    -- "nothing to do" for the caller and none of them is worth distinguishing
    -- to a client.
    RETURN jsonb_build_object('success', TRUE, 'unchanged', TRUE);
  END IF;

  -- «بوابة الشركاء» — the badge the frame draws on this exact row.
  INSERT INTO provider_user_history (provider_user_id, action, source, new_values, changed_by)
  VALUES (v_id, 'password_changed', 'partner',
          jsonb_build_object('must_change_password', FALSE), v_uid);

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ④ THE ADMIN READ SIDE.
--
-- These MUST be functions rather than plain SELECTs, unlike A03's network
-- screen: every column the list draws except the branch lives in `auth.users`,
-- which no client can read at all. A SECURITY DEFINER function owned by
-- postgres is the only way to join it — and each one carries its own admin
-- check, because the definer's rights are exactly what makes it dangerous.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_provider_staff_accounts()
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

  SELECT jsonb_build_object(
    'accounts', COALESCE(jsonb_agg(a ORDER BY a->>'providerNameAr', a->>'branchNameAr', a->>'nameAr'), '[]'::jsonb),
    'counts', jsonb_build_object(
      'total',    COUNT(*)::INT,
      'active',   COUNT(*) FILTER (WHERE (a->>'state') = 'active')::INT,
      'neverUsed',COUNT(*) FILTER (WHERE (a->>'state') = 'never_used')::INT,
      'disabled', COUNT(*) FILTER (WHERE (a->>'state') = 'disabled')::INT
    )
  ) INTO v_out
  FROM (
    SELECT jsonb_build_object(
             'providerUserId', pu.id,
             'nameAr', pu.name,
             'email', u.email,
             'providerId', pu.provider_id,
             'providerNameAr', p.name_ar,
             'branchId', b.id,
             'branchNameAr', b.name_ar,
             'lastSignInAt', u.last_sign_in_at,
             'createdAt', pu.created_at,
             'isActive', COALESCE(pu.is_active, FALSE),
             'mustChangePassword', pu.must_change_password,
             -- The frame's three states, computed in ONE place. «لم يُستخدم
             -- بعد» is last_sign_in_at IS NULL — a fact, not a guess.
             'state', CASE
                        WHEN NOT COALESCE(pu.is_active, FALSE) THEN 'disabled'
                        WHEN u.last_sign_in_at IS NULL         THEN 'never_used'
                        ELSE 'active'
                      END
           ) AS a
      FROM provider_users pu
      JOIN auth.users u ON u.id = pu.auth_user_id
      JOIN providers p ON p.id = pu.provider_id
      LEFT JOIN branches b ON b.id = pu.branch_ids[1]
  ) rows;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_provider_staff_detail(p_provider_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_account JSONB;
  v_audit   JSONB;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT jsonb_build_object(
           'providerUserId', pu.id,
           'nameAr', pu.name,
           'email', u.email,
           'providerId', pu.provider_id,
           'providerNameAr', p.name_ar,
           'branchId', b.id,
           'branchNameAr', b.name_ar,
           'lastSignInAt', u.last_sign_in_at,
           'createdAt', pu.created_at,
           'isActive', COALESCE(pu.is_active, FALSE),
           'mustChangePassword', pu.must_change_password,
           'tempPasswordIssuedAt', pu.temp_password_issued_at,
           'state', CASE
                      WHEN NOT COALESCE(pu.is_active, FALSE) THEN 'disabled'
                      WHEN u.last_sign_in_at IS NULL         THEN 'never_used'
                      ELSE 'active'
                    END
         ) INTO v_account
    FROM provider_users pu
    JOIN auth.users u ON u.id = pu.auth_user_id
    JOIN providers p ON p.id = pu.provider_id
    LEFT JOIN branches b ON b.id = pu.branch_ids[1]
   WHERE pu.id = p_provider_user_id;

  IF v_account IS NULL THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'action', h.action,
           'source', h.source,
           'oldValues', h.old_values,
           'newValues', h.new_values,
           'changedAt', h.changed_at,
           'who', COALESCE(au.name, pu.name, 'الإدارة')
         ) ORDER BY h.changed_at DESC), '[]'::jsonb) INTO v_audit
    FROM provider_user_history h
    LEFT JOIN admin_users au ON au.auth_user_id = h.changed_by
    LEFT JOIN provider_users pu ON pu.auth_user_id = h.changed_by
   WHERE h.provider_user_id = p_provider_user_id;

  RETURN jsonb_build_object('found', TRUE, 'account', v_account, 'audit', v_audit);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ⑤ THE DISABLE CONFIRM — and the escalation the frame draws.
--
-- SPEC-A05: "The last-account escalation is ENFORCED, not just drawn: the
-- confirm's data comes from a preview fn (active accounts remaining, upcoming
-- bookings count), and the escalated variant renders when remaining == 0."
-- So the escalation is a NUMBER this function returns, not a judgement the
-- screen makes — same rule A03's dialogs follow.
--
-- ⚠ AND THE ESCALATED COPY IS THE HONEST ONE: «الفرع يبقى ظاهراً للمرضى
-- وقابلاً للحجز — التعطيل لا يوقف الحجز». Disabling the last account does NOT
-- hide the branch and does NOT stop bookings; it only removes everyone who
-- could see them. That is why the dialog offers «أوقف الفرع بدلاً من ذلك» as
-- the actual remedy, and why `openSlots` is reported — those slots stay
-- bookable.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.preview_staff_disable(p_provider_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_auth_id    UUID;
  v_branch_id  UUID;
  v_name       TEXT;
  v_branch     TEXT;
  v_remaining  INT;
  v_others     JSONB;
  v_upcoming   INT;
  v_nearest    JSONB;
  v_open_slots INT;
  v_session    TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT pu.auth_user_id, pu.branch_ids[1], pu.name, b.name_ar
    INTO v_auth_id, v_branch_id, v_name, v_branch
    FROM provider_users pu
    LEFT JOIN branches b ON b.id = pu.branch_ids[1]
   WHERE pu.id = p_provider_user_id;
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('found', FALSE);
  END IF;

  -- Everyone else still able to open the portal for THIS branch.
  SELECT COUNT(*)::INT,
         COALESCE(jsonb_agg(jsonb_build_object('nameAr', pu.name, 'email', u.email)
                            ORDER BY pu.name), '[]'::jsonb)
    INTO v_remaining, v_others
    FROM provider_users pu
    JOIN auth.users u ON u.id = pu.auth_user_id
   WHERE pu.id <> p_provider_user_id
     AND COALESCE(pu.is_active, FALSE)
     AND v_branch_id = ANY (COALESCE(pu.branch_ids, '{}'::UUID[]));

  SELECT COUNT(*)::INT INTO v_upcoming
    FROM bookings bk
    JOIN slots sl ON sl.id = bk.slot_id
   WHERE bk.branch_id = v_branch_id
     AND bk.status IN ('pending_payment', 'confirmed', 'arrived')
     AND sl.slot_date >= (NOW() AT TIME ZONE 'Africa/Cairo')::DATE;

  -- «أقربها — اليوم ٣:٠٠ م — سكر صائم»
  SELECT jsonb_build_object('slotDate', sl.slot_date, 'slotTime', sl.slot_time,
                            'serviceNameAr', s.name_ar)
    INTO v_nearest
    FROM bookings bk
    JOIN slots sl ON sl.id = bk.slot_id
    LEFT JOIN booking_services bsv ON bsv.booking_id = bk.id
    LEFT JOIN branch_services bs ON bs.id = bsv.branch_service_id
    LEFT JOIN services s ON s.id = bs.service_id
   WHERE bk.branch_id = v_branch_id
     AND bk.status IN ('pending_payment', 'confirmed', 'arrived')
     AND sl.slot_date >= (NOW() AT TIME ZONE 'Africa/Cairo')::DATE
   ORDER BY sl.slot_date, sl.slot_time
   LIMIT 1;

  -- «مواعيد فارغة تبقى قابلة للحجز» — the point of the escalated variant.
  SELECT COUNT(*)::INT INTO v_open_slots
    FROM slots sl
   WHERE sl.branch_id = v_branch_id
     AND sl.slot_date >= (NOW() AT TIME ZONE 'Africa/Cairo')::DATE
     AND NOT COALESCE(sl.is_blocked, FALSE)
     AND COALESCE(sl.booked_count, 0) < COALESCE(sl.capacity, 0);

  -- «جلسة مفتوحة الآن تُغلَق فوراً · آخر نشاط: قبل ١٢ دقيقة». auth.sessions is
  -- unreadable by any client; a definer function owned by postgres can see it,
  -- which is the only reason this line can be true rather than decorative.
  SELECT MAX(GREATEST(s.updated_at, s.created_at)) INTO v_session
    FROM auth.sessions s
   WHERE s.user_id = v_auth_id
     AND (s.not_after IS NULL OR s.not_after > NOW());

  RETURN jsonb_build_object(
    'found', TRUE,
    'nameAr', v_name,
    'branchId', v_branch_id,
    'branchNameAr', v_branch,
    'activeAccountsRemaining', COALESCE(v_remaining, 0),
    'isLastActiveAccount', COALESCE(v_remaining, 0) = 0,
    'otherAccounts', COALESCE(v_others, '[]'::jsonb),
    'upcomingBookings', COALESCE(v_upcoming, 0),
    'nearestBooking', v_nearest,
    'openSlots', COALESCE(v_open_slots, 0),
    'hasOpenSession', v_session IS NOT NULL,
    'lastSessionActivityAt', v_session
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- ⑥ Grants.
-- ───────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.get_provider_login_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_login_state() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.complete_provider_password_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_provider_password_change() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_provider_staff_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_staff_accounts() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_provider_staff_detail(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_staff_detail(UUID) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.preview_staff_disable(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_staff_disable(UUID) TO authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- ⑦ ⚠ A05'S CLOSURE — the tenth of A01's eleven.
--
--   provider_users: admin full access → an admin's BROWSER could INSERT a
--   provider_users row for ANY auth user, against ANY provider, with ANY
--   branch_ids — i.e. grant portal access to an arbitrary account, unaudited,
--   with a fetch. It could also flip `is_active` back on for an account the
--   founder had just disabled, without touching the ban that is the actual
--   lockout, producing a half-disabled account whose two halves disagree.
--
-- It closes because A05 replaces it. The write path is the
-- `admin-staff-accounts` Edge Function on the SERVICE ROLE, which bypasses RLS
-- and therefore needs no policy: it re-checks the caller is an active admin
-- itself (the §5 law that every boundary carries its own check, never an
-- inherited one), does the auth.users half and the provider_users half
-- together, and writes the audit row. A policy could do none of those things.
--
-- `provider_users: see own record` STAYS — it is what
-- `apps/web/lib/auth/provider.ts` and the login action read, and it is scoped
-- to `auth_user_id = auth.uid()` with an admin OR-branch for reads.
-- Verified there are no client WRITES to provider_users anywhere in apps/,
-- packages/ or supabase/functions/: both call sites are `.select()`.
--
-- Ten of eleven closed. Remaining: `users` (patient self-service, out of scope
-- for the admin panel), `notifications`, and the `reviews` moderation gap that
-- F08 decides.
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "provider_users: admin full access" ON public.provider_users;
