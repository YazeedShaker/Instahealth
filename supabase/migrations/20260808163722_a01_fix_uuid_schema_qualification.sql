-- FIX to 20260808161645, found by RUNNING the function rather than reading it:
-- uuid-ossp also lives in the `extensions` schema, so a bare uuid_generate_v4()
-- inside a body pinned to `search_path = public` raises 42883. The pgcrypto
-- calls in the same migration were already qualified; this one was missed.
--
-- ⚠ A column DEFAULT is IMMUNE to this — its expression is stored with the
-- function OID already resolved — which is exactly why admin_recovery_codes
-- inserted fine while the function that inserts into it did not. That
-- asymmetry is what makes the bug survive a read of the migration.
--
-- Superseded in full by 20260808231917 (recovery-code acknowledgement), which
-- rewrites this function again; kept for the history and the lesson.
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
  RETURN jsonb_build_object('success', TRUE, 'codes', to_jsonb(v_codes), 'batch_id', v_batch);
END;
$function$;

REVOKE ALL ON FUNCTION public.generate_admin_recovery_codes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_admin_recovery_codes() TO authenticated, service_role;
