-- ============================================================
-- create_slot_hold: the caller is DERIVED, never DECLARED.
--
-- THE LAST OPEN INSTANCE OF THE GENERAL LAW (ENGINEERING-WORKFLOW §5): any fact
-- with money, state or identity consequences is server-derived; clients supply
-- identities, never values. `create_slot_hold(p_slot_id, p_user_id)` took the
-- holder's identity as an ARGUMENT and never compared it to auth.uid(), and it
-- additionally carried a PUBLIC + anon EXECUTE grant. Two consequences, both
-- reachable with nothing but the public anon key that ships in the Expo bundle:
--
--   1. HOLD DESTRUCTION. The body ends every call with
--      `DELETE FROM slot_holds WHERE user_id = p_user_id` (the one-hold-per-
--      patient self-heal). Passing a VICTIM's id deletes the hold they are
--      currently checking out against, freeing their slot mid-payment. Called
--      in a loop it denies that patient any hold at all.
--   2. HOLD FORGERY. The INSERT wrote `p_user_id` verbatim, so a hold could be
--      attributed to someone who never made it — consuming a slot's capacity in
--      a third party's name.
--
-- Dropping the parameter is the fix, not checking it. A `p_user_id = auth.uid()`
-- guard would leave a parameter whose only correct value is one the server
-- already knows — the same shape §5 rejects for read functions
-- (`get_patient_bookings()` deliberately takes no user id). With the parameter
-- gone, impersonation is impossible BY CONSTRUCTION: there is no longer any
-- channel through which a caller can name a different user.
--
-- The signature therefore CHANGES. The old two-argument function is DROPPED
-- rather than left beside the new one — an overload retaining the hole is the
-- "RPC beside an open INSERT policy" mistake in another costume.
--
-- Also fixed here, in the function being rewritten anyway:
--   · `SET search_path = public` — this was the only SECURITY DEFINER function
--     left with a mutable search_path (matches the sweep pattern).
--   · COALESCE on the nullable capacity columns. `capacity`, `booked_count` and
--     `is_blocked` are all NULLable; `IF (booked_count + hold_count) >= capacity`
--     is NULL when either side is NULL, and plpgsql treats a NULL IF as FALSE —
--     which FALLS THROUGH TO ALLOW an unbounded hold. Latent today (0 of 5,134
--     slot rows carry a NULL) but it is the exact NULL-unsafe shape §5 names.
--
-- Behaviour is otherwise unchanged: same 10-minute expiry, same one-active-
-- hold-per-patient self-heal, same error vocabulary. `not_authenticated` is the
-- only new outcome, and only anon/internal callers can reach it.
-- ============================================================

DROP FUNCTION IF EXISTS public.create_slot_hold(UUID, UUID);

CREATE OR REPLACE FUNCTION public.create_slot_hold(p_slot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_caller     UUID := auth.uid();
  v_slot       slots;
  v_hold_count INT;
  v_hold_id    UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- A hold belongs to a signed-in patient. `auth.uid() IS NULL` is anon OR an
  -- internal caller (it is NOT "service_role") — neither of those holds a slot,
  -- and treating NULL as trusted is precisely the mistake cancel_booking made.
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_slot FROM slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_not_found');
  END IF;

  IF COALESCE(v_slot.is_blocked, FALSE) THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_blocked');
  END IF;

  -- The caller's OWN holds are excluded so re-picking a slot you already hold
  -- is not self-blocking (migration 20260726170254).
  SELECT COUNT(*) INTO v_hold_count
  FROM slot_holds
  WHERE slot_id = p_slot_id AND expires_at > NOW() AND user_id <> v_caller;

  IF (COALESCE(v_slot.booked_count, 0) + v_hold_count) >= COALESCE(v_slot.capacity, 0) THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_full');
  END IF;

  -- One active hold per patient: starting a new hold releases EVERY other hold
  -- this caller has (not just same-slot) — leaked holds self-heal here. Scoped
  -- to v_caller, so it can only ever touch the caller's own rows.
  DELETE FROM slot_holds WHERE user_id = v_caller;

  v_expires_at := NOW() + INTERVAL '10 minutes';
  INSERT INTO slot_holds (slot_id, user_id, expires_at)
  VALUES (p_slot_id, v_caller, v_expires_at)
  RETURNING id INTO v_hold_id;

  RETURN jsonb_build_object(
    'success', true,
    'hold_id', v_hold_id,
    'slot_id', p_slot_id,
    'expires_at', v_expires_at
  );
END;
$function$;

-- Explicit grants, per the sweep pattern. Postgres grants EXECUTE to PUBLIC by
-- default, so a bare CREATE FUNCTION would re-open the anon door this migration
-- exists to close.
REVOKE ALL ON FUNCTION public.create_slot_hold(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_slot_hold(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_slot_hold(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_slot_hold(UUID) TO service_role;
