-- ============================================================
-- Seed 006: the DEDICATED E2E ADMIN, created and reset to a pristine
-- first-login state.
--
-- ⚠⚠ THIS EXISTS BECAUSE THE FIRST VERSION POINTED CI AT THE FOUNDER'S REAL
-- ACCOUNT, AND THAT WAS A SERIOUS MISTAKE. `apps/web/e2e/admin.spec.ts` drives
-- the FIRST-LOGIN flow, which is a once-per-account state, so the suite needs
-- the account reset before every run. Pointing that reset at
-- `admin@instahealth.eg` meant every CI run silently:
--   · re-hashed the founder's password to the CI secret,
--   · raised `must_change_password`, and
--   · DELETED their enrolled authenticator and all eight recovery codes.
-- The founder would be locked out by a green build on an unrelated PR. Seed 005
-- (the genesis account) is now NEVER run by CI.
--
-- So the E2E gets its own admin. Same shape, different row:
--   admin-e2e@instahealth.eg   → CI only, reset on every run, disposable
--   admin@instahealth.eg       → the founder's, seeded ONCE by 005, never touched
--
-- ⚠ DEV AND CI ONLY. Do not run in production — there is no reason for an
-- E2E admin to exist there, and `is_active = TRUE` on a disposable account with
-- a CI-known password is exactly what you do not want in prod.
--
-- The password comes from the ENVIRONMENT. Variable NAMES only, never a value
-- (the repo is PUBLIC — CLAUDE.md §8):
--
--   ADMIN_TEST_EMAIL     — must be admin-e2e@instahealth.eg
--   ADMIN_TEST_PASSWORD  — the E2E admin's password; what this seed hashes
--
-- Run it (bash):
--
--   psql "$DATABASE_URL" -v admin_password="$ADMIN_TEST_PASSWORD" \
--     -f supabase/seeds/006_admin_e2e_account.sql
--
-- ⚠ The value is passed RAW and quoted by psql via :'admin_password'. Wrapping
-- it in single quotes in the SHELL corrupts any password containing a quote, a
-- dollar sign or a backslash — psql then hashes a different string, sign-in
-- fails, and the suite times out on a URL with nothing naming the cause. That
-- happened; do not reintroduce it.
--
-- IDEMPOTENT: fixed UUID + upserts, and it RESETS rather than appends — the
-- same discipline as 004_dashboard_e2e_fixtures.sql.
-- ============================================================

WITH creds(uid, email, name) AS (
  VALUES
    ('cccc0000-0000-4000-8000-0000000000e2'::uuid, 'admin-e2e@instahealth.eg', 'حساب اختبار — الإدارة')
),
ins_auth AS (
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  SELECT '00000000-0000-0000-0000-000000000000', c.uid, 'authenticated', 'authenticated',
         c.email, crypt(:'admin_password', gen_salt('bf')), NOW(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('full_name', c.name),
         NOW(), NOW(), '', '', '', ''
  FROM creds c
  ON CONFLICT (id) DO UPDATE
    SET encrypted_password = EXCLUDED.encrypted_password,
        email_confirmed_at = EXCLUDED.email_confirmed_at,
        updated_at = NOW()
  RETURNING id
),
ins_ident AS (
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  SELECT c.uid::text, c.uid,
         jsonb_build_object('sub', c.uid::text, 'email', c.email, 'email_verified', true),
         'email', NOW(), NOW(), NOW()
  FROM creds c
  ON CONFLICT (provider, provider_id) DO NOTHING
  RETURNING user_id
)
INSERT INTO public.admin_users (auth_user_id, name, must_change_password, is_active, recovery_codes_acknowledged)
SELECT c.uid, c.name, TRUE, TRUE, FALSE FROM creds c
ON CONFLICT (auth_user_id) DO UPDATE
  SET name = EXCLUDED.name,
      must_change_password = TRUE,
      recovery_codes_acknowledged = FALSE,
      is_active = TRUE;

-- Clear the authenticator and everything downstream, so the suite always starts
-- from a true first login. Scoped to the E2E uid by literal — there is no
-- lookup here that could ever resolve to the founder's row.
DELETE FROM auth.mfa_factors            WHERE user_id      = 'cccc0000-0000-4000-8000-0000000000e2';
DELETE FROM auth.sessions               WHERE user_id      = 'cccc0000-0000-4000-8000-0000000000e2';
DELETE FROM public.admin_recovery_codes WHERE auth_user_id = 'cccc0000-0000-4000-8000-0000000000e2';
DELETE FROM public.admin_lockouts       WHERE auth_user_id = 'cccc0000-0000-4000-8000-0000000000e2';
