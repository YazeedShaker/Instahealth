-- ═══════════════════════════════════════════════════════════════════════════
-- P05 — branch-maintained profile fields, through a SECURITY DEFINER writer.
--
-- REFACTOR 2/N dropped the column-blind `branches` UPDATE policy — correctly,
-- it exposed rating and instahealth_slot_allocation — but that also removed
-- the legitimate half: a branch fixing its own phone or address text. This
-- restores exactly that half. The field split is SPEC-P05's:
--   editable : phone, whatsapp, address_ar, address_en
--   gated    : identity, pin, hours, allocation, is_active, holiday_mode
-- (hours + allocation are commercial terms — DECISION-slot-allocation-ownership).
--
-- ⚠ The function takes NO branch id. The branch is DERIVED from the caller's
-- provider_users membership — the create_slot_hold law: delete the parameter,
-- don't validate it. There is NO new UPDATE policy on branches; this function
-- is the only client door (CLAUDE.md §8).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── the audit trail ────────────────────────────────────────────────────────
-- jsonb diff instead of P03's explicit old/new columns: this table covers four
-- fields today and any future profile field tomorrow. Convention: the keys
-- present in old_values/new_values are EXACTLY the fields that changed.
-- Append-only: no client write policy of any kind; the function is the writer.
CREATE TABLE IF NOT EXISTS public.branch_profile_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id  UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  old_values JSONB NOT NULL,
  new_values JSONB NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bph_branch_time
  ON public.branch_profile_history (branch_id, changed_at DESC);

ALTER TABLE public.branch_profile_history ENABLE ROW LEVEL SECURITY;

-- Staff of the owning branch (and admins) read their own history — the data
-- behind «آخر تحديث». Mirrors P03's price-history policy.
DROP POLICY IF EXISTS "profile history: branch staff read own" ON public.branch_profile_history;
CREATE POLICY "profile history: branch staff read own"
  ON public.branch_profile_history FOR SELECT
  USING (
    COALESCE(branch_id = ANY (get_provider_branch_ids()), FALSE)
    OR get_user_role() = 'admin'
  );

-- ── the write ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_branch_profile(
  p_phone      text,
  p_whatsapp   text,
  p_address_ar text,
  p_address_en text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_branch_id   UUID;
  v_row         branches;
  v_phone       TEXT;
  v_whatsapp    TEXT;
  v_address_ar  TEXT;
  v_address_en  TEXT;
  v_digits      TEXT;
  v_old         JSONB := '{}'::jsonb;
  v_new         JSONB := '{}'::jsonb;
BEGIN
  -- The caller IS the branch. No parameter carries it, so no parameter can
  -- lie about it. First branch of the membership, matching getProviderContext.
  v_branch_id := (get_provider_branch_ids())[1];
  IF v_branch_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'branch_not_found');
  END IF;

  SELECT * INTO v_row FROM branches WHERE id = v_branch_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'branch_not_found');
  END IF;

  -- Normalize: trim everything; optional fields collapse empty → NULL.
  v_phone      := NULLIF(TRIM(p_phone), '');
  v_whatsapp   := NULLIF(TRIM(p_whatsapp), '');
  v_address_ar := NULLIF(TRIM(p_address_ar), '');
  v_address_en := NULLIF(TRIM(p_address_en), '');

  -- phone: required. Egyptian landline/mobile (leading 0, 9–11 digits) OR a
  -- SHORT-CODE hotline (4–5 digits, leading 1) — Town's real number is 15276,
  -- and hospital/lab hotlines of that shape are the norm in Egypt. Optional
  -- dash/space separators. Stored as entered (trimmed): the desk's display
  -- format is not ours to rewrite.
  IF v_phone IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_phone');
  END IF;
  v_digits := REGEXP_REPLACE(v_phone, '[\s-]', '', 'g');
  IF v_digits !~ '^0[0-9]{8,10}$' AND v_digits !~ '^1[0-9]{3,4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_phone');
  END IF;

  -- whatsapp: optional, but when present it must be an Egyptian MOBILE — it is
  -- a WhatsApp target and neither a landline nor a hotline can receive one.
  -- Stored NORMALIZED (digits only) because it is dialed by machines, not read
  -- by people.
  IF v_whatsapp IS NOT NULL THEN
    v_digits := REGEXP_REPLACE(v_whatsapp, '[\s-]', '', 'g');
    -- Accept +20 / 0020 international prefixes and fold to local 01X form.
    v_digits := REGEXP_REPLACE(v_digits, '^(\+20|0020)', '0');
    IF v_digits !~ '^01[0125][0-9]{8}$' THEN
      RETURN jsonb_build_object('success', false, 'error', 'invalid_whatsapp');
    END IF;
    v_whatsapp := v_digits;
  END IF;

  -- addresses: Arabic required, English optional, both bounded.
  IF v_address_ar IS NULL OR LENGTH(v_address_ar) > 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_address');
  END IF;
  IF v_address_en IS NOT NULL AND LENGTH(v_address_en) > 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_address');
  END IF;

  -- Diff — NULL-safe, and only changed keys enter the audit row, so the trail
  -- records changes rather than clicks (P03 rule).
  IF v_row.phone IS DISTINCT FROM v_phone THEN
    v_old := v_old || jsonb_build_object('phone', v_row.phone);
    v_new := v_new || jsonb_build_object('phone', v_phone);
  END IF;
  IF v_row.whatsapp IS DISTINCT FROM v_whatsapp THEN
    v_old := v_old || jsonb_build_object('whatsapp', v_row.whatsapp);
    v_new := v_new || jsonb_build_object('whatsapp', v_whatsapp);
  END IF;
  IF v_row.address_ar IS DISTINCT FROM v_address_ar THEN
    v_old := v_old || jsonb_build_object('address_ar', v_row.address_ar);
    v_new := v_new || jsonb_build_object('address_ar', v_address_ar);
  END IF;
  IF v_row.address_en IS DISTINCT FROM v_address_en THEN
    v_old := v_old || jsonb_build_object('address_en', v_row.address_en);
    v_new := v_new || jsonb_build_object('address_en', v_address_en);
  END IF;

  IF v_new = '{}'::jsonb THEN
    RETURN jsonb_build_object('success', true, 'unchanged', true,
      'phone', v_row.phone, 'whatsapp', v_row.whatsapp,
      'address_ar', v_row.address_ar, 'address_en', v_row.address_en);
  END IF;

  UPDATE branches
     SET phone      = v_phone,
         whatsapp   = v_whatsapp,
         address_ar = v_address_ar,
         address_en = v_address_en,
         updated_at = NOW()
   WHERE id = v_branch_id;

  INSERT INTO branch_profile_history (branch_id, old_values, new_values, changed_by)
  VALUES (v_branch_id, v_old, v_new, auth.uid());

  RETURN jsonb_build_object('success', true, 'unchanged', false,
    'phone', v_phone, 'whatsapp', v_whatsapp,
    'address_ar', v_address_ar, 'address_en', v_address_en,
    'changed_at', NOW());
END;
$function$;

REVOKE ALL ON FUNCTION public.update_branch_profile(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_branch_profile(text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_branch_profile(text, text, text, text)
  TO authenticated, service_role;
