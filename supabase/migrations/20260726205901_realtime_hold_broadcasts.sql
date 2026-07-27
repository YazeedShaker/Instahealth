-- ============================================================
-- Realtime slot availability (replaces fast polling with push):
--
-- Every slot_holds INSERT/DELETE broadcasts a minimal payload to the private
-- topic `branch-holds:{branch_id}`. Clients viewing that branch's picker
-- subscribe and refetch availability on any event. The payload carries ONLY
-- slot identifiers — never user ids — so nothing leaks that RLS hides.
-- Confirmations propagate too: confirm_booking deletes the hold → DELETE
-- broadcast → viewers refetch and see the incremented booked_count.
-- ============================================================

CREATE OR REPLACE FUNCTION broadcast_slot_hold_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_row       slot_holds;
  v_branch_id UUID;
BEGIN
  v_row := COALESCE(NEW, OLD);
  SELECT branch_id INTO v_branch_id FROM slots WHERE id = v_row.slot_id;
  IF v_branch_id IS NOT NULL THEN
    PERFORM realtime.send(
      jsonb_build_object('slot_id', v_row.slot_id, 'op', TG_OP),
      'holds_changed',
      'branch-holds:' || v_branch_id::text,
      true
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_slot_holds_broadcast ON slot_holds;
CREATE TRIGGER trg_slot_holds_broadcast
AFTER INSERT OR DELETE ON slot_holds
FOR EACH ROW EXECUTE FUNCTION broadcast_slot_hold_change();

-- Private-channel authorization: any signed-in patient may RECEIVE broadcasts
-- on branch hold topics (they carry no sensitive data). No INSERT policy —
-- clients cannot broadcast, only the DB trigger can.
DROP POLICY IF EXISTS "authenticated receive branch hold broadcasts" ON realtime.messages;
CREATE POLICY "authenticated receive branch hold broadcasts"
ON realtime.messages FOR SELECT TO authenticated
USING (realtime.messages.extension = 'broadcast' AND realtime.topic() LIKE 'branch-holds:%');
