-- ============================================================
-- Seed 006: reset the genesis admin to a PRISTINE FIRST-LOGIN state.
--
-- ⚠⚠ DEV AND CI ONLY. NEVER RUN THIS IN PRODUCTION. It DELETES the enrolled
-- authenticator and every recovery code, which in prod means locking the
-- founder out of the admin panel until someone repeats the bootstrap.
--
-- WHY IT EXISTS: `apps/web/e2e/admin.spec.ts` drives the FIRST-LOGIN flow —
-- forced password change, TOTP enrollment, one-time recovery codes. That flow
-- can only happen once per account state, so without a reset the second CI run
-- would find an already-enrolled admin and the first-login assertions would
-- skip themselves. **A skipped suite and a passing suite look identical in the
-- summary line** (workflow §4, §9), and the codes-shown-once regression guard
-- is exactly the assertion that must never quietly stop running.
--
-- Same shape as `004_dashboard_e2e_fixtures.sql`: it RESETS rather than
-- appends, so the suite starts from a known state every time.
--
-- Run it AFTER 005 (which owns the account and its temp password):
--
--   psql "$DATABASE_URL" -v admin_password="'$ADMIN_TEST_PASSWORD'" \
--     -f supabase/seeds/005_admin_users.sql
--   psql "$DATABASE_URL" -f supabase/seeds/006_admin_e2e_reset.sql
--
-- This file takes NO variables and contains NO credentials — 005 owns the
-- password, this owns the state around it.
-- ============================================================

DO $$
DECLARE
  v_uid UUID;
BEGIN
  SELECT auth_user_id INTO v_uid
    FROM public.admin_users au
    JOIN auth.users u ON u.id = au.auth_user_id
   WHERE u.email = 'admin@instahealth.eg';

  IF v_uid IS NULL THEN
    -- Loud, not silent: if 005 has not run, the admin suite is about to fail
    -- on sign-in and the cause should be named here rather than guessed at.
    RAISE EXCEPTION
      'No genesis admin found. Run supabase/seeds/005_admin_users.sql first.';
  END IF;

  -- The authenticator and everything downstream of it.
  DELETE FROM auth.mfa_factors            WHERE user_id      = v_uid;
  DELETE FROM auth.sessions               WHERE user_id      = v_uid;
  DELETE FROM public.admin_recovery_codes WHERE auth_user_id = v_uid;
  DELETE FROM public.admin_lockouts       WHERE auth_user_id = v_uid;

  -- Back to "temp password, nothing acknowledged". 005 has just re-hashed the
  -- password itself; these are the two flags the gate reads.
  UPDATE public.admin_users
     SET must_change_password        = TRUE,
         recovery_codes_acknowledged = FALSE,
         is_active                   = TRUE
   WHERE auth_user_id = v_uid;

  RAISE NOTICE 'Genesis admin reset to first-login state (%).', v_uid;
END $$;
