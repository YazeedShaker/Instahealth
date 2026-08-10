-- A05 (addendum) · making «تُغلَق جلستها المفتوحة الآن» literally true.
--
-- ⚠ WHY THIS EXISTS AS ITS OWN FUNCTION, written after the first attempt was
-- WRONG. The obvious way to evict another user's sessions from a service-role
-- Edge Function is the ban/unban round trip, because the JS admin API's
-- signOut() wants the TARGET's own access token — which a server does not have
-- and must never ask for. That trick does not work: GoTrue's ban sets
-- `banned_until` and deletes nothing, and the refresh endpoint re-reads that
-- column at refresh time, so unbanning a second later hands every existing
-- session straight back. Applied after a PERMANENT ban it is worse than
-- useless — it lifts the ban that was the whole point of disabling the account.
--
-- A session ends when its row stops existing. `auth.sessions` is unreachable
-- from any client and from PostgREST, so this is a SECURITY DEFINER function
-- owned by postgres, called by the Edge Function AS THE ADMIN (the caller's own
-- JWT), never on the service role — which is why it can keep the ordinary
-- admin check every other A04/A05 writer carries instead of inventing an
-- internal-caller bypass. `auth.refresh_tokens.session_id` is ON DELETE
-- CASCADE, so the refresh tokens go with the row.
--
-- ⚠ WHAT THIS STILL CANNOT DO, stated rather than implied: A01 measured that
-- Supabase access tokens are STATELESS with a 60-minute TTL. Deleting a session
-- kills the ability to REFRESH; it does not reach back and invalidate a token
-- already issued. The promise of immediate lockout is kept by
-- `provider_users.is_active`, which getProviderContext() re-reads on every
-- dashboard render — the gate is the enforcement, the token never was.

CREATE OR REPLACE FUNCTION public.admin_revoke_provider_sessions(p_provider_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_auth_id UUID;
  v_killed  INT;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM admin_users WHERE auth_user_id = v_uid AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT auth_user_id INTO v_auth_id
    FROM provider_users WHERE id = p_provider_user_id;
  IF v_auth_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'account_not_found');
  END IF;

  -- ⚠ SCOPED TO A PROVIDER STAFF ACCOUNT BY CONSTRUCTION. The parameter is a
  -- provider_users id, not an auth user id, and the auth id is looked up from
  -- it — so there is no argument that could name the founder's own account, or
  -- a patient's. Deleting the parameter's freedom rather than validating it is
  -- the §5 preference (create_slot_hold, 20260801005955).
  DELETE FROM auth.sessions WHERE user_id = v_auth_id;
  GET DIAGNOSTICS v_killed = ROW_COUNT;

  RETURN jsonb_build_object('success', TRUE, 'sessionsRevoked', v_killed);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_revoke_provider_sessions(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_provider_sessions(UUID) TO authenticated, service_role;
