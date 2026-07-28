-- ============================================================
-- Seed 003: dev provider accounts for the partner dashboard (P01)
--
-- DEV ACCOUNTS (dev project only — these do not exist in prod):
--   reception@townhospital.eg    → Town Hospital, New Cairo
--   reception2@townhospital.eg   → Town Hospital (2nd shift)
--   reception@saridarlabs.com    → Saridar — Dokki
--
-- Providers sign in with EMAIL + PASSWORD (patients use phone OTP).
--
-- ⚠ THE PASSWORD IS NOT IN THIS FILE, deliberately. A dev password committed
-- to the repo is still a hardcoded credential (CLAUDE.md §8) and secret
-- scanning flags it. Supply it at run time instead:
--
--   psql "$DATABASE_URL" -v provider_password="'<the-password>'" --        -f supabase/seeds/003_provider_users.sql
--
-- Applying through the Supabase MCP/SQL editor instead? Replace
-- :provider_password with a quoted literal in your editor buffer only — never
-- save it back into this file.
--
-- The shared dev password lives with the team (1Password / founder), and is
-- mirrored into PROVIDER_TEST_PASSWORD for the Playwright suite.
--
-- WHY THE auth.users ROWS ARE HAND-WRITTEN: creating auth users normally goes
-- through the Admin API with the service-role key, which is not available to
-- the dev session that wrote this. Inserting into auth.users + auth.identities
-- directly is equivalent for email/password accounts as long as BOTH rows exist
-- and `email_confirmed_at` is set — an identity-less user cannot sign in.
-- Login was PROVEN from Node against dev after seeding; if you ever regenerate
-- these, prove it again rather than assuming.
--
-- The users-row trigger (20260725165604) deliberately skips email signups, so
-- these do NOT get a patient `public.users` row — verified, not assumed.
-- Role resolution is a TABLE LOOKUP (get_user_role reads provider_users), not a
-- JWT claim, so a provider_users row is all that is needed for the role.
--
-- IDEMPOTENT: fixed UUIDs + upserts. Safe to re-run.
-- ============================================================

WITH creds(uid, email, full_name, provider_id, branch_ids, role) AS (
  VALUES
    ('dddd0000-0000-4000-8000-000000000001'::uuid, 'reception@townhospital.eg',  'مكتب الاستقبال — تاون',  'aaaa0000-0000-4000-8000-000000000001'::uuid, ARRAY['bbbb0000-0000-4000-8000-000000000001']::uuid[], 'receptionist'),
    ('dddd0000-0000-4000-8000-000000000002'::uuid, 'reception2@townhospital.eg', 'وردية ثانية — تاون',     'aaaa0000-0000-4000-8000-000000000001'::uuid, ARRAY['bbbb0000-0000-4000-8000-000000000001']::uuid[], 'receptionist'),
    ('dddd0000-0000-4000-8000-000000000003'::uuid, 'reception@saridarlabs.com',  'مكتب الاستقبال — الدقي', 'aaaa0000-0000-4000-8000-000000000002'::uuid, ARRAY['bbbb0000-0000-4000-8000-000000000101']::uuid[], 'receptionist')
),
ins_auth AS (
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  SELECT '00000000-0000-0000-0000-000000000000', c.uid, 'authenticated', 'authenticated',
         c.email, crypt(:provider_password, gen_salt('bf')), NOW(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         jsonb_build_object('full_name', c.full_name),
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
INSERT INTO provider_users (auth_user_id, provider_id, branch_ids, role, is_active)
SELECT c.uid, c.provider_id, c.branch_ids, c.role, TRUE FROM creds c
ON CONFLICT (auth_user_id) DO UPDATE
  SET provider_id = EXCLUDED.provider_id, branch_ids = EXCLUDED.branch_ids,
      role = EXCLUDED.role, is_active = TRUE;
