-- ═══════════════════════════════════════════════════════════════════════════
-- A01 — recovery-code ACKNOWLEDGEMENT.
--
-- ⚠ FOUND BY RUNNING THE FLOW, NOT BY READING IT (§9's whole point).
--
-- Enrollment succeeded, the session became aal2 — and Next.js revalidated the
-- route after the server action, which re-ran the enroll page's gate, saw a
-- fully-authorised admin, and redirected to /admin/overview. The eight recovery
-- codes had been generated and were shown to NOBODY. They exist only as bcrypt
-- hashes, so they were unrecoverable: the design's «تُعرض مرة واحدة» promise
-- would have displayed them ZERO times, and the founder would have had an
-- account whose only recovery path was a set of codes nobody ever saw.
--
-- The gate cannot be told "don't redirect, the client is holding codes" — the
-- server has no way to know that. So the fact becomes SERVER STATE, which is
-- the same law as everywhere else in this schema: if the UI depends on it, the
-- database has to hold it (§1.4).
--
--   generated → acknowledged = FALSE   a fresh batch nobody has confirmed
--   confirmed → acknowledged = TRUE    the design's checkbox, made durable
--
-- While FALSE the gate keeps routing to the enrollment screen. On a reload the
-- plaintext really IS gone, so that screen says so plainly and offers a
-- regenerate — which turns «ولّد مجموعة جديدة بعد الدخول» from decoration into
-- the actual recovery from this situation.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS recovery_codes_acknowledged BOOLEAN NOT NULL DEFAULT FALSE;

-- A new batch is unacknowledged BY CONSTRUCTION — the flag is reset inside the
-- same function that mints the codes, so the two can never disagree.
CREATE OR REPLACE FUNCTION public.generate_admin_recovery_codes()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_batch UUID := extensions.uuid_generate_v4();
  v_alphabet TEXT := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_codes TEXT[] := '{}';
  v_code TEXT;
  i INTEGER;
  j INTEGER;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_authorized');
  END IF;
  IF COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'aal2_required');
  END IF;

  UPDATE admin_recovery_codes SET superseded_at = NOW()
    WHERE auth_user_id = v_uid AND superseded_at IS NULL;

  FOR i IN 1..8 LOOP
    v_code := '';
    FOR j IN 1..8 LOOP
      v_code := v_code || substr(v_alphabet,
        1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(v_alphabet)), 1);
    END LOOP;
    v_code := substr(v_code, 1, 4) || '-' || substr(v_code, 5, 4);
    v_codes := array_append(v_codes, v_code);
    INSERT INTO admin_recovery_codes (auth_user_id, code_hash, batch_id)
    VALUES (v_uid, extensions.crypt(v_code, extensions.gen_salt('bf')), v_batch);
  END LOOP;

  UPDATE admin_users SET recovery_codes_acknowledged = FALSE WHERE auth_user_id = v_uid;

  RETURN jsonb_build_object('success', TRUE, 'codes', to_jsonb(v_codes), 'batch_id', v_batch);
END;
$function$;

-- The checkbox, made durable. Deliberately its own SECURITY DEFINER function
-- rather than a column the client writes: admin_users has no client UPDATE
-- policy at all (20260808161645), and this is the write-path rule (§8).
CREATE OR REPLACE FUNCTION public.acknowledge_admin_recovery_codes()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_authenticated');
  END IF;
  -- Only meaningful once codes actually exist. Acknowledging an empty set would
  -- satisfy the gate while leaving the account with NO recovery path — the
  -- exact state this whole feature exists to prevent.
  IF NOT EXISTS (
    SELECT 1 FROM admin_recovery_codes
     WHERE auth_user_id = v_uid AND used_at IS NULL AND superseded_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_codes');
  END IF;
  UPDATE admin_users SET recovery_codes_acknowledged = TRUE
    WHERE auth_user_id = v_uid AND is_active = TRUE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_authorized');
  END IF;
  RETURN jsonb_build_object('success', TRUE);
END;
$function$;

-- The gate reads the new fact.
CREATE OR REPLACE FUNCTION public.get_admin_auth_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_admin public.admin_users%ROWTYPE;
  v_lock public.admin_lockouts%ROWTYPE;
  v_factor BOOLEAN;
  v_codes INTEGER;
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
  v_locked := COALESCE(v_lock.locked_until > NOW(), FALSE);
  SELECT count(*) INTO v_codes FROM admin_recovery_codes
    WHERE auth_user_id = v_uid AND used_at IS NULL AND superseded_at IS NULL;
  RETURN jsonb_build_object(
    'is_admin', TRUE,
    'name', v_admin.name,
    'must_change_password', v_admin.must_change_password,
    'recovery_codes_acknowledged', v_admin.recovery_codes_acknowledged,
    'has_verified_factor', v_factor,
    'aal', auth.jwt() ->> 'aal',
    'is_locked', v_locked,
    'locked_until', CASE WHEN v_locked THEN v_lock.locked_until END,
    'attempts_remaining', GREATEST(0, 5 - COALESCE(v_lock.failed_count, 0)),
    'recovery_codes_remaining', v_codes
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.acknowledge_admin_recovery_codes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_admin_recovery_codes() TO authenticated, service_role;
