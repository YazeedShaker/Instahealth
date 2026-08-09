-- A02 · least privilege for the two helpers, caught reading the authorization
-- surface before committing it — which is exactly what that file is for.
--
-- `commission_rate_at` and `commission_piasters` were granted to
-- `authenticated` alongside compute_commission_draft. They need no such grant:
-- their only caller is compute_commission_draft, which is SECURITY DEFINER, so
-- privilege checks for functions it calls are made as the function OWNER, not
-- as the caller. The grant was therefore pure surface.
--
-- And it was not harmless. `commission_rate_at(provider, date)` returns a
-- partner's negotiated commission percentage — commercially sensitive, and one
-- partner learning another's rate is precisely the kind of disclosure a
-- marketplace cannot undo. Any signed-in patient could have read it.
--
-- ⚠ VERIFIED AFTER THE REVOKE, not merely reasoned: the draft was re-run
-- through a real admin session and returned the same numbers to the piaster
-- (Town يوليو 8 rows / 2,700 EGP / 324 commission). If the owner-privilege
-- reasoning had been wrong, the draft would have failed with a permission
-- error on its first rate lookup.
REVOKE ALL ON FUNCTION public.commission_rate_at(UUID, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commission_rate_at(UUID, DATE) TO service_role;

REVOKE ALL ON FUNCTION public.commission_piasters(BIGINT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commission_piasters(BIGINT, NUMERIC) TO service_role;
