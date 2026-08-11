-- ============================================================
-- Seed 007: the DEDICATED FIDELITY ADMIN — an admin the screenshot harness
-- can sign into as a human would, TOTP and all.
--
-- ⚠ WHY A THIRD ADMIN ROW EXISTS. There are now three, and mixing them up is
-- the failure this file is shaped to prevent:
--
--   admin@instahealth.eg           the FOUNDER's. Seeded ONCE by 005. Never touched.
--   admin-e2e@instahealth.eg       CI's. Seed 006 RESETS it to a pristine
--                                  first-login state before every run, because
--                                  `admin.spec.ts` drives the once-per-account
--                                  enrollment flow.
--   admin-fidelity@instahealth.eg  THIS ONE. The opposite state: already past
--                                  first login, already enrolled, so
--                                  `fidelity.spec.ts` can go password → TOTP →
--                                  in, and spend its time capturing screens
--                                  instead of re-enrolling.
--
-- Pointing the fidelity harness at 006's account would have the two suites
-- fighting over one account's enrollment state: 006 deletes the authenticator,
-- the harness needs one to exist. Whoever ran second would fail for a reason
-- that names neither suite.
--
-- ⚠ THIS IS NOT AN AUTH BYPASS, AND MUST NEVER BECOME ONE. The harness signs in
-- through the REAL `/admin/login` form and satisfies the REAL gate
-- (`get_admin_auth_state()` in `apps/web/lib/auth/admin.ts`) — password, then a
-- genuine RFC-6238 code that GoTrue validates against the secret below. What
-- this seed provisions is the AUTHENTICATOR, exactly as scanning the QR into a
-- phone would. There is no bypass endpoint, no test-only branch in the gate,
-- and nothing here weakens a single check. If a future session is tempted to
-- add "just a flag to skip TOTP in dev", the flag is the vulnerability and this
-- file is the alternative that already works.
--
-- ⚠ DEV ONLY. Do not run in production. An always-enrolled admin whose
-- authenticator secret sits in an env file is a standing key to the portal; on
-- dev that is a screenshot tool, in production it is an incident.
--
-- ⚠ THE TOTP SECRET IS A CREDENTIAL. The repo is PUBLIC (CLAUDE.md §8), so it
-- lives in the environment and NOTHING here may become a literal. Variable
-- NAMES only:
--
--   FIDELITY_ADMIN_EMAIL         must be admin-fidelity@instahealth.eg
--   FIDELITY_ADMIN_PASSWORD      the password this seed hashes
--   FIDELITY_ADMIN_TOTP_SECRET   base32, 32 chars — the authenticator secret
--
-- Run it (bash):
--
--   psql "$DATABASE_URL" \
--     -v fidelity_password="$FIDELITY_ADMIN_PASSWORD" \
--     -v fidelity_totp_secret="$FIDELITY_ADMIN_TOTP_SECRET" \
--     -f supabase/seeds/007_admin_fidelity_account.sql
--
-- ⚠ Both values are passed RAW and quoted by psql via :'name'. Quoting them in
-- the SHELL corrupts any value containing a quote, a dollar sign or a backslash
-- — psql then hashes a different string and sign-in fails with nothing naming
-- the cause. That happened with 006; do not reintroduce it.
--
-- ⚠ `crypt`/`gen_salt` are SCHEMA-QUALIFIED (`extensions.`). pgcrypto lives in
-- the `extensions` schema, and a bare call resolves only because seeds run under
-- the default search_path — which is a coincidence, not a guarantee
-- (ENGINEERING-WORKFLOW §5).
--
-- IDEMPOTENT: fixed UUID + upserts, and it RESETS rather than appends.
-- ============================================================

WITH creds(uid, email, name) AS (
  VALUES
    ('cccc0000-0000-4000-8000-0000000000f1'::uuid, 'admin-fidelity@instahealth.eg', 'حساب لقطات — الإدارة')
),
ins_auth AS (
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  SELECT '00000000-0000-0000-0000-000000000000', c.uid, 'authenticated', 'authenticated',
         c.email,
         extensions.crypt(:'fidelity_password', extensions.gen_salt('bf')),
         NOW(),
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
-- ⚠ The two flags are the OPPOSITE of seed 006's, and that is the whole point:
-- `must_change_password = FALSE` and `recovery_codes_acknowledged = TRUE` are
-- what let the gate return `needsTotp` rather than routing to the
-- change-password or recovery-codes screens. Read them against the four gate
-- states in `apps/web/lib/auth/admin.ts` before changing either.
INSERT INTO public.admin_users (auth_user_id, name, must_change_password, is_active, recovery_codes_acknowledged)
SELECT c.uid, c.name, FALSE, TRUE, TRUE FROM creds c
ON CONFLICT (auth_user_id) DO UPDATE
  SET name = EXCLUDED.name,
      must_change_password = FALSE,
      recovery_codes_acknowledged = TRUE,
      is_active = TRUE;

-- Sessions and lockouts are cleared so a previous run's five wrong codes cannot
-- lock a capture run out. Scoped to this uid by LITERAL — there is no lookup
-- here that could ever resolve to the founder's row or CI's.
DELETE FROM auth.sessions         WHERE user_id      = 'cccc0000-0000-4000-8000-0000000000f1';
DELETE FROM public.admin_lockouts WHERE auth_user_id = 'cccc0000-0000-4000-8000-0000000000f1';

-- ── The authenticator ──────────────────────────────────────────────────────
-- A `verified` TOTP factor holding the secret the harness computes codes from.
-- This is the same row `mfa.enroll()` + `mfa.verify()` would leave behind; the
-- only difference is that the secret was chosen by us rather than by GoTrue, so
-- a script can act as the phone. GoTrue validates the submitted code against
-- this column exactly as it does for a real authenticator.
DELETE FROM auth.mfa_factors WHERE user_id = 'cccc0000-0000-4000-8000-0000000000f1';

INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
VALUES (
  'ffff0000-0000-4000-8000-0000000000f1',
  'cccc0000-0000-4000-8000-0000000000f1',
  'instahealth-fidelity-harness',
  'totp',
  'verified',
  NOW(), NOW(),
  :'fidelity_totp_secret'
);

-- Recovery codes: NONE, deliberately. The harness never needs them, and eight
-- more standing credentials for a screenshot account is surface with no
-- purpose. `recovery_codes_acknowledged = TRUE` above means the gate does not
-- ask for them; `recoveryCodesRemaining` simply renders ٠ in the shell.
DELETE FROM public.admin_recovery_codes WHERE auth_user_id = 'cccc0000-0000-4000-8000-0000000000f1';
