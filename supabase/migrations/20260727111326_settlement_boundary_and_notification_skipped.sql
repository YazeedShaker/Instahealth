-- ============================================================
-- F06 settlement boundary.
--
-- 1 · confirm_booking() is SECURITY DEFINER and, like every function, had
--     EXECUTE granted to PUBLIC — so any authenticated patient could confirm
--     their own pending booking straight from the client, skipping payment
--     entirely and skipping the hold-validity check the settlement path
--     performs. SPEC-F06 requires confirm_booking be reachable ONLY through
--     the `settle-payment` Edge Function. Revoke it from every client role;
--     service_role (which is what the Edge Function uses) keeps EXECUTE.
--
--     NOTE: cancel_booking KEEPS its client grant on purpose — the app calls
--     it directly to cancel abandoned/stale pending bookings (F05), and it
--     can never confirm anything or move money.
--
-- 2 · notifications.status gains 'skipped'. The confirmation SMS is
--     deliberately NOT sent to the static test numbers (+201000000001/2),
--     which are not real phones — CI and dev must never text them. Recording
--     that as 'failed' would be a lie and would pollute delivery metrics, so
--     the audit row gets an honest status instead.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.confirm_booking(UUID, VARCHAR, VARCHAR, VARCHAR, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_booking(UUID, VARCHAR, VARCHAR, VARCHAR, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.confirm_booking(UUID, VARCHAR, VARCHAR, VARCHAR, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_booking(UUID, VARCHAR, VARCHAR, VARCHAR, JSONB) TO service_role;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_status_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_status_check
  CHECK (status IN ('pending', 'sent', 'failed', 'skipped'));
