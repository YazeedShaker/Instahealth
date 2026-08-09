-- ═══════════════════════════════════════════════════════════════════════════
-- A01 — the admin authentication surface: recovery codes, TOTP lockout, and
-- closing admin_users to client writes.
--
-- SCHEMA ONLY. The genesis admin account is NOT here — it is
-- `supabase/seeds/005_admin_users.sql`, because a migration cannot deliver two
-- properties the genesis account needs: MCP `apply_migration` takes no
-- variables (so the temp password could only arrive as a literal, in a PUBLIC
-- repo), and migrations run once per version, which is the opposite of the
-- replayable bootstrap prod needs. Founder ruling ①.
--
-- ⚠ pgcrypto lives in the `extensions` schema on Supabase, so every crypt() /
-- gen_salt() / gen_random_bytes() call below is SCHEMA-QUALIFIED. A pinned
-- `SET search_path = public` would otherwise fail to resolve them at runtime —
-- seed 003 gets away with a bare crypt() only because it runs under the default
-- search_path.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1 · admin_users gains the state the first-login flow needs
-- ───────────────────────────────────────────────────────────────────────────
-- must_change_password: the design's forced change on first login. It lives
-- HERE and not in auth.users.raw_user_meta_data, because a user can write their
-- own metadata — a self-clearing "you must change your password" flag is not a
-- flag. Cleared only by complete_admin_password_change() below.
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE;

-- is_active: admin_users had no way to disable an account short of deleting the
-- row. provider_users has carried is_active since day one and get_user_role()
-- already honours it for providers; this makes the admin branch symmetric.
ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- ⚠ get_user_role() must actually RESPECT is_active or the column is a lie.
-- One-line change, mirroring the provider branch exactly.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT 'admin'    FROM admin_users    WHERE auth_user_id = auth.uid() AND is_active = TRUE LIMIT 1),
    (SELECT 'provider' FROM provider_users WHERE auth_user_id = auth.uid() AND is_active = TRUE LIMIT 1),
    'patient'
  );
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2 · admin_users is no longer client-writable  (A01 DECISION 1)
-- ───────────────────────────────────────────────────────────────────────────
-- The table carried `FOR ALL USING (get_user_role() = 'admin')`. Dormant while
-- the table was empty — but A01 creates the first admin, and the moment it
-- does, ANY admin could INSERT another admin straight from the browser. That is
-- client-reachable privilege escalation, and it is the write-path rule (§8)
-- verbatim: a domain table should have NO client INSERT/UPDATE policy.
--
-- Adding or removing an admin is a runbook/service-role act in v1 (re-run seed
-- 005). Reading stays — the shell renders the admin's name.
--
-- ⚠ The policy alone is not the whole gate. Supabase grants every column of
-- every table to anon+authenticated by default, so the GRANTs are revoked too;
-- policy and grant are two independent mechanisms and this table needs both
-- shut (REFACTOR 1/N's whole lesson).
DROP POLICY IF EXISTS "admin_users: admin only" ON public.admin_users;

CREATE POLICY "admin_users: admin reads, nobody writes"
  ON public.admin_users FOR SELECT
  USING (get_user_role() = 'admin');

REVOKE INSERT, UPDATE, DELETE ON public.admin_users FROM anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 3 · Recovery codes  (A01 DECISION: no client path of ANY kind)
-- ───────────────────────────────────────────────────────────────────────────
-- RLS is enabled with ZERO policies, which denies every client outright, and
-- the grants are revoked as well. Only SECURITY DEFINER functions and
-- service_role reach this table. The spec's "no client read path at all" is
-- literal: a hash is still a credential-equivalent for offline attack.
CREATE TABLE IF NOT EXISTS public.admin_recovery_codes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash     TEXT NOT NULL,
  batch_id      UUID NOT NULL,
  used_at       TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arc_live
  ON public.admin_recovery_codes (auth_user_id)
  WHERE used_at IS NULL AND superseded_at IS NULL;

ALTER TABLE public.admin_recovery_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_recovery_codes FROM anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 4 · TOTP lockout  (A01 DECISION 2: service-role/definer only, decided up
--     front so `pnpm authz:check` has a recorded answer before the build)
-- ───────────────────────────────────────────────────────────────────────────
-- One row per admin. A counter rather than an attempt log: the design's promise
-- is "5 failures → 15 minutes, auto-clearing", which is a state, not a history.
CREATE TABLE IF NOT EXISTS public.admin_lockouts (
  auth_user_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  failed_count   INTEGER NOT NULL DEFAULT 0,
  last_failed_at TIMESTAMPTZ,
  locked_until   TIMESTAMPTZ,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_lockouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_lockouts FROM anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 5 · The auth-state reader — ONE round trip, and the gate's only source
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠ THE GATE HAS FOUR STATES, NOT THREE. Proven from Node during the A01 spike:
-- Supabase access tokens are stateless with a 60-MINUTE TTL, so deleting a
-- factor and killing every session does NOT revoke an access token already
-- issued. A stale token therefore keeps its `aal2` claim for up to an hour
-- after a recovery reset — which is exactly the window the reset exists to
-- close. So the gate may never trust the aal claim alone:
--
--   aal1 + verified factor   → the TOTP verify step only
--   aal1 + NO factor         → the ENROLLMENT screen only (first login, or
--                              after a recovery reset). Gate on aal2 here and
--                              the account BRICKS: no factor → never aal2 →
--                              never able to enrol.
--   aal2 + verified factor   → everything
--   aal2 + NO factor         → a STALE token that outlived a reset. Treated as
--                              the enrollment state, never as access.
--
-- has_verified_factor is read live from auth.mfa_factors, which only a SECURITY
-- DEFINER function can see. That is the §1.4 display-predicate law: the screen
-- decides on the same fact the server enforces.
CREATE OR REPLACE FUNCTION public.get_admin_auth_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid    UUID := auth.uid();
  v_admin  public.admin_users%ROWTYPE;
  v_lock   public.admin_lockouts%ROWTYPE;
  v_factor BOOLEAN;
  v_codes  INTEGER;
  v_locked BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('is_admin', FALSE, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_admin FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('is_admin', FALSE, 'reason', 'not_admin');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM auth.mfa_factors
    WHERE user_id = v_uid AND status = 'verified' AND factor_type = 'totp'
  ) INTO v_factor;

  SELECT * INTO v_lock FROM admin_lockouts WHERE auth_user_id = v_uid;
  -- The lock AUTO-CLEARS: it is a timestamp comparison, never a swept row.
  v_locked := COALESCE(v_lock.locked_until > NOW(), FALSE);

  SELECT count(*) INTO v_codes
  FROM admin_recovery_codes
  WHERE auth_user_id = v_uid AND used_at IS NULL AND superseded_at IS NULL;

  RETURN jsonb_build_object(
    'is_admin',             TRUE,
    'name',                 v_admin.name,
    'must_change_password', v_admin.must_change_password,
    'has_verified_factor',  v_factor,
    'aal',                  auth.jwt() ->> 'aal',
    'is_locked',            v_locked,
    'locked_until',         CASE WHEN v_locked THEN v_lock.locked_until END,
    -- attempts_remaining is what the design's «بقيت لك ٣ محاولات» renders. It
    -- is derived from the same counter the lock is, so copy cannot drift from
    -- enforcement.
    'attempts_remaining',   GREATEST(0, 5 - COALESCE(v_lock.failed_count, 0)),
    -- The design shows the recovery link only when codes exist unconsumed.
    'recovery_codes_remaining', v_codes
  );
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6 · Attempt tracking
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠ HONEST LIMIT, stated where it will be read: mfa.verify() is a PLATFORM
-- endpoint reachable with the public anon key, so we cannot intercept every
-- attempt. What this lock actually protects is ACCESS TO /admin — the gate
-- refuses to serve while locked_until is in the future, whatever produced the
-- session. Supabase's own auth rate limiting is the backstop on the endpoint
-- itself. Enforcing at the gate rather than at the verify is the only version
-- of this that is true.
CREATE OR REPLACE FUNCTION public.record_admin_totp_failure()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid   UUID := auth.uid();
  v_count INTEGER;
  v_until TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    -- Never disclose whether the account exists to an unverifiable caller.
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_authorized');
  END IF;

  -- ⚠ Already locked → record NOTHING and do not extend. Without this, someone
  -- hammering a locked account keeps pushing locked_until forward and the lock
  -- never "opens by itself" — which is precisely what the design promises
  -- («يُقفل الدخول ١٥ دقيقة ثم يُفتح وحده»). A lock that a stranger can extend
  -- indefinitely is a denial-of-service against the founder's own account.
  SELECT locked_until INTO v_until FROM admin_lockouts WHERE auth_user_id = v_uid;
  IF COALESCE(v_until > NOW(), FALSE) THEN
    RETURN jsonb_build_object(
      'success', TRUE, 'attempts_remaining', 0, 'is_locked', TRUE, 'locked_until', v_until
    );
  END IF;
  v_until := NULL;

  INSERT INTO admin_lockouts (auth_user_id, failed_count, last_failed_at, updated_at)
  VALUES (v_uid, 1, NOW(), NOW())
  ON CONFLICT (auth_user_id) DO UPDATE
    SET failed_count = CASE
          -- An expired lock resets the count; that IS the auto-clear.
          WHEN admin_lockouts.locked_until IS NOT NULL AND admin_lockouts.locked_until <= NOW()
            THEN 1
          ELSE admin_lockouts.failed_count + 1
        END,
        last_failed_at = NOW(),
        updated_at     = NOW()
  RETURNING failed_count INTO v_count;

  IF v_count >= 5 THEN
    UPDATE admin_lockouts
      SET locked_until = NOW() + INTERVAL '15 minutes', updated_at = NOW()
      WHERE auth_user_id = v_uid
      RETURNING locked_until INTO v_until;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'attempts_remaining', GREATEST(0, 5 - v_count),
    'is_locked', v_until IS NOT NULL,
    'locked_until', v_until
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.clear_admin_totp_failures()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_authenticated');
  END IF;
  DELETE FROM admin_lockouts WHERE auth_user_id = v_uid AND COALESCE(locked_until, NOW()) <= NOW();
  RETURN jsonb_build_object('success', TRUE);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 7 · Recovery-code generation — the SERVER makes the codes
-- ───────────────────────────────────────────────────────────────────────────
-- The plaintext is returned exactly ONCE, to the caller, and never stored,
-- logged or re-derivable. Requires aal2, which both the first enrollment (the
-- factor is verified moments earlier) and the design's «ولّد مجموعة جديدة بعد
-- الدخول» regeneration satisfy.
--
-- Alphabet is Crockford-ish — no O/I/L/U/0/1 — because these get copied off
-- paper under stress. The design's placeholder codes ("QW21-9HZ4") include a 1;
-- the SHAPE (XXXX-XXXX, 8 chars) is the design, the alphabet is a legibility
-- choice and is noted as a deviation.
CREATE OR REPLACE FUNCTION public.generate_admin_recovery_codes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      UUID := auth.uid();
  v_batch    UUID := extensions.uuid_generate_v4();
  v_alphabet TEXT := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_codes    TEXT[] := '{}';
  v_code     TEXT;
  i          INTEGER;
  j          INTEGER;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_authorized');
  END IF;

  IF COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'aal2_required');
  END IF;

  -- Regeneration invalidates the whole previous set, used or not.
  UPDATE admin_recovery_codes
    SET superseded_at = NOW()
    WHERE auth_user_id = v_uid AND superseded_at IS NULL;

  FOR i IN 1..8 LOOP
    v_code := '';
    FOR j IN 1..8 LOOP
      -- gen_random_bytes is CSPRNG; random() is not, and these are credentials.
      v_code := v_code || substr(
        v_alphabet,
        1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(v_alphabet)),
        1
      );
    END LOOP;
    v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
    v_codes := array_append(v_codes, v_code);

    INSERT INTO admin_recovery_codes (auth_user_id, code_hash, batch_id)
    VALUES (v_uid, extensions.crypt(v_code, extensions.gen_salt('bf')), v_batch);
  END LOOP;

  RETURN jsonb_build_object('success', TRUE, 'codes', to_jsonb(v_codes), 'batch_id', v_batch);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 8 · Recovery-code consumption — authorizes a SUPERVISED TOTP RESET
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠ FOUNDER RULING ②, FALLBACK BRANCH. A recovery code does NOT log anyone in
-- and does NOT produce aal2. Proven from Node against the live project:
-- Supabase exposes deleteFactor and listFactors on the admin MFA namespace and
-- nothing else — no challenge, no verify, no elevation of any kind — and its
-- own reference states "Recovery codes are not supported". The only way a
-- server could satisfy mfa.verify is to read auth.mfa_factors.secret (stored in
-- PLAINTEXT) and compute the user's own code, which is forging the second
-- factor, not recovering it.
--
-- So a code authorizes exactly one thing: unenroll the factor, kill the
-- sessions, force re-enrollment. This function does the CONSUMPTION half; the
-- `admin-recovery-reset` Edge Function does the service-role half.
--
-- ⚠ NO IDENTITY PARAMETER. The admin has already passed the password, so they
-- are authenticated at aal1 and the account comes from auth.uid() — the
-- create_slot_hold law applied at birth rather than retrofitted.
CREATE OR REPLACE FUNCTION public.consume_admin_recovery_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       UUID := auth.uid();
  v_row       public.admin_recovery_codes%ROWTYPE;
  v_normal    TEXT;
  v_remaining INTEGER;
  v_locked    BOOLEAN;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_authorized');
  END IF;

  -- The lockout covers the recovery path too, or it is a way around the lock.
  SELECT COALESCE(locked_until > NOW(), FALSE) INTO v_locked
  FROM admin_lockouts WHERE auth_user_id = v_uid;
  IF COALESCE(v_locked, FALSE) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'locked');
  END IF;

  -- Typed off paper: tolerate case and stray spaces, and accept a missing dash.
  v_normal := upper(regexp_replace(COALESCE(p_code, ''), '\s', '', 'g'));
  IF v_normal !~ '^[0-9A-Z]{4}-?[0-9A-Z]{4}$' THEN
    PERFORM record_admin_totp_failure();
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_code');
  END IF;
  IF position('-' IN v_normal) = 0 THEN
    v_normal := substr(v_normal, 1, 4) || '-' || substr(v_normal, 5, 4);
  END IF;

  -- bcrypt is deliberately slow, and there are at most 8 live rows per admin.
  SELECT * INTO v_row
  FROM admin_recovery_codes
  WHERE auth_user_id = v_uid
    AND used_at IS NULL
    AND superseded_at IS NULL
    AND code_hash = extensions.crypt(v_normal, code_hash)
  LIMIT 1;

  IF NOT FOUND THEN
    PERFORM record_admin_totp_failure();
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_code');
  END IF;

  -- SINGLE USE. The guarded UPDATE is the atomic claim: a concurrent second
  -- call finds used_at already set and consumes nothing.
  UPDATE admin_recovery_codes
    SET used_at = NOW()
    WHERE id = v_row.id AND used_at IS NULL;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'invalid_code');
  END IF;

  SELECT count(*) INTO v_remaining
  FROM admin_recovery_codes
  WHERE auth_user_id = v_uid AND used_at IS NULL AND superseded_at IS NULL;

  -- A successful recovery clears the failure counter; the reset itself is the
  -- Edge Function's job.
  DELETE FROM admin_lockouts WHERE auth_user_id = v_uid;

  RETURN jsonb_build_object('success', TRUE, 'codes_remaining', v_remaining);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 9 · Clearing the forced-password-change flag
-- ───────────────────────────────────────────────────────────────────────────
-- Called after supabase.auth.updateUser({password}) succeeds. The flag is the
-- only thing this can touch, and only for the caller's own row — which is why
-- admin_users needs no client UPDATE policy to support the flow.
CREATE OR REPLACE FUNCTION public.complete_admin_password_change()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_authenticated');
  END IF;
  UPDATE admin_users SET must_change_password = FALSE
    WHERE auth_user_id = v_uid AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_authorized');
  END IF;
  RETURN jsonb_build_object('success', TRUE);
END;
$function$;

-- ───────────────────────────────────────────────────────────────────────────
-- 10 · GRANTS — Postgres gives EXECUTE to PUBLIC by default (§5). Revoke, then
--      grant deliberately. Every one of these is reachable only by a signed-in
--      admin; none is useful to anon, and consume_admin_recovery_code in
--      particular must never be.
-- ───────────────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.get_admin_auth_state()            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_admin_totp_failure()       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clear_admin_totp_failures()       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.generate_admin_recovery_codes()   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.consume_admin_recovery_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_admin_password_change()  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_admin_auth_state()            TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_admin_totp_failure()       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.clear_admin_totp_failures()       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_admin_recovery_codes()   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.consume_admin_recovery_code(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_admin_password_change()  TO authenticated, service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- 11 · Recovery-code ACKNOWLEDGEMENT  (added same-day, migration
--      20260808_a01_recovery_codes_acknowledgement — kept here as the reason)
-- ───────────────────────────────────────────────────────────────────────────
-- ⚠ FOUND BY RUNNING THE FLOW, NOT BY READING IT.
--
-- Enrollment succeeded, the session became aal2 — and Next.js revalidated the
-- route after the server action, which re-ran the enroll page's gate, saw a
-- fully-authorised admin, and redirected to /admin/overview. The eight codes
-- had been generated and were shown to NOBODY. They exist only as bcrypt
-- hashes, so they were unrecoverable: «تُعرض مرة واحدة» would have displayed
-- them zero times.
--
-- The gate cannot be told "hold on, the client is holding codes" — the server
-- has no way to know. So the fact becomes SERVER STATE, which is the same law
-- as everywhere else here: if the UI depends on it, the database holds it.
-- While `recovery_codes_acknowledged` is FALSE the gate keeps routing to the
-- enrollment screen; on a reload the plaintext really is gone, so that screen
-- says so and offers a regenerate.
--
-- See the acknowledgement migration for the full DDL. Summary:
--   ALTER TABLE admin_users ADD COLUMN recovery_codes_acknowledged BOOLEAN
--     NOT NULL DEFAULT FALSE;
--   generate_admin_recovery_codes()  → resets the flag to FALSE in the same
--                                      statement that mints a batch
--   acknowledge_admin_recovery_codes() → sets it TRUE, and refuses when no
--                                      live codes exist (acknowledging an
--                                      empty set would satisfy the gate with
--                                      no recovery path at all)
--   get_admin_auth_state()           → returns it
