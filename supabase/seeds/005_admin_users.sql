-- ============================================================
-- Seed 005: the GENESIS ADMIN account for the admin panel (A01)
--
-- ACCOUNT (the founder's, supplied 2026-08-08):
--   admin@instahealth.eg   → «الإدارة» — full admin, no role tiers in v1
--
-- Admins sign in with EMAIL + PASSWORD, then TOTP (patients use phone OTP,
-- provider staff use email+password with no second factor).
--
-- ⚠ WHY THIS IS A SEED AND NOT A MIGRATION — founder ruling ①. A migration
-- cannot deliver two properties the genesis account needs:
--   ① DDL here is applied through the Supabase MCP `apply_migration`, which
--      takes NO VARIABLES — so a migration could only receive the temp password
--      as a LITERAL, in a repo that is PUBLIC.
--   ② Migrations run ONCE per version. Bootstrapping prod, or re-bootstrapping
--      after a mistake, needs a REPLAYABLE artifact. This file is idempotent.
-- The schema half — admin_recovery_codes, admin_lockouts, closing admin_users
-- to client writes — is migration 20260808161645, where it belongs.
--
-- ⚠ THE PASSWORD IS NOT IN THIS FILE, deliberately, and never will be. THE
-- REPOSITORY IS PUBLIC since 2026-07-29: anything written here is world-readable
-- the moment it is pushed, and deleting it later does NOT un-publish it — git
-- history keeps every version. Removal ≠ rotation. (CLAUDE.md §8, workflow §4.)
--
-- Supply it from the ENVIRONMENT at run time. The variable names are the
-- documented contract; the values live only in the founder's password manager,
-- the local `apps/web/.env.local`, and the GitHub repo secrets:
--
--   ADMIN_TEST_EMAIL     — the admin account to sign in as
--   ADMIN_TEST_PASSWORD  — its TEMP password; ALSO what this seed hashes below
--
-- Run it (bash):
--
--   psql "$DATABASE_URL" \
--     -v admin_password="'$ADMIN_TEST_PASSWORD'" \
--     -f supabase/seeds/005_admin_users.sql
--
-- PowerShell:
--
--   psql $env:DATABASE_URL `
--     -v admin_password="'$env:ADMIN_TEST_PASSWORD'" `
--     -f supabase/seeds/005_admin_users.sql
--
-- Applying through the Supabase MCP / SQL editor instead? Substitute
-- :admin_password in your editor buffer only — never save it back here, and
-- never paste it into a commit message, a PR body or PROGRESS.md.
--
-- ⚠ THE PASSWORD SET HERE IS A TEMP PASSWORD. `must_change_password` is TRUE
-- below, and the /admin gate refuses to serve anything until it is changed —
-- so the value that goes into the environment is expected to be burned on
-- first login, not kept.
--
-- WHY THE auth.users ROWS ARE HAND-WRITTEN: identical to seed 003. Creating
-- auth users normally goes through the Admin API with the service-role key,
-- which is not available to the dev session that wrote this. Inserting into
-- auth.users + auth.identities directly is equivalent for email/password
-- accounts as long as BOTH rows exist and `email_confirmed_at` is set — an
-- identity-less user cannot sign in. Verified 2026-08-08: all existing email
-- users have paired identity rows, and login was proven from Node after
-- seeding. If you regenerate these, prove it again rather than assuming.
--
-- The users-row trigger (20260725165604) deliberately skips email signups, so
-- this does NOT get a patient `public.users` row — the trigger returns early
-- when NEW.phone IS NULL. Verified against the live function body, not assumed.
-- Role resolution is a TABLE LOOKUP (get_user_role reads admin_users FIRST,
-- and since 20260808161645 also requires is_active), not a JWT claim.
--
-- ⚠ THIS SEED DOES NOT TOUCH auth.mfa_factors. Re-running it in PROD must never
-- destroy the founder's enrolled authenticator. To replay the first-login flow
-- in DEV, clear the factor explicitly — see the runbook,
-- docs/runbooks/RUNBOOK-admin-account.md.
--
-- IDEMPOTENT: fixed UUID + upserts. Safe to re-run. Proven by running twice and
-- comparing counts.
-- ============================================================

WITH creds(uid, email, name) AS (
  VALUES
    ('cccc0000-0000-4000-8000-000000000001'::uuid, 'admin@instahealth.eg', 'الإدارة — المؤسس')
),
ins_auth AS (
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  SELECT '00000000-0000-0000-0000-000000000000', c.uid, 'authenticated', 'authenticated',
         c.email, crypt(:admin_password, gen_salt('bf')), NOW(),
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
INSERT INTO public.admin_users (auth_user_id, name, must_change_password, is_active)
SELECT c.uid, c.name, TRUE, TRUE FROM creds c
ON CONFLICT (auth_user_id) DO UPDATE
  SET name = EXCLUDED.name,
      -- Re-running the seed re-issues the TEMP password above, so the forced
      -- change must come back with it. A re-bootstrap that left this FALSE
      -- would hand out a temp password with no obligation to replace it.
      must_change_password = TRUE,
      is_active = TRUE;
