-- A02 · Commission & invoicing statement — the data layer.
--
-- Three tables (effective-dated rates, statements, frozen line snapshots) plus
-- A02's OPENING DECISION: closing the two worst admin write policies A01 made
-- reachable. Functions land in the next migration.

-- ───────────────────────────────────────────────────────────────────────────
-- ① Effective-dated commission rates — APPEND-ONLY.
--
-- ⚠ UNITS. `percent` is a PERCENT (12.00 = twelve percent), NOT the fraction
-- that `bookings.commission_rate` holds (0.1200). They are different scales in
-- the same schema, so every read path converts explicitly and neither column is
-- ever compared to the other. See the deprecation note on ③.
--
-- Changing a rate means INSERTING a row with a later effective_from; the rate
-- for an event is the latest row whose effective_from <= the event date. That
-- is why mixed-rate months are normal and why a statement total is a SUM of
-- per-row commissions, never a single rate applied to GMV.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE public.provider_commission_rates (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id    UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  percent        NUMERIC(5,2) NOT NULL CHECK (percent >= 0 AND percent <= 100),
  effective_from DATE NOT NULL,
  note           TEXT,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_id, effective_from)
);

COMMENT ON TABLE public.provider_commission_rates IS
  'Effective-dated commission agreement per provider. APPEND-ONLY: a rate change is a new row. A02 reads it; A03 writes it.';
COMMENT ON COLUMN public.provider_commission_rates.percent IS
  'PERCENT (12.00 = 12%), not a fraction. bookings.commission_rate is a FRACTION and is deprecated.';

-- Append-only is enforced, not merely documented: this table is the evidence
-- behind money a partner has already been invoiced for. An UPDATE would rewrite
-- history retroactively and silently change a statement nobody re-issued.
CREATE OR REPLACE FUNCTION public.forbid_commission_rate_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION
    'provider_commission_rates is append-only: insert a new row with a later effective_from instead of %ing.',
    lower(TG_OP);
END;
$$;

CREATE TRIGGER provider_commission_rates_append_only
  BEFORE UPDATE OR DELETE ON public.provider_commission_rates
  FOR EACH ROW EXECUTE FUNCTION public.forbid_commission_rate_mutation();

-- ───────────────────────────────────────────────────────────────────────────
-- ② Statements — the issued document, and its frozen lines.
--
-- A draft is the ABSENCE of a row: before the first issue the screen computes
-- live. Rows exist from the first ISSUE onward, so `draft` is not a status.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE public.commission_statements (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_id   UUID NOT NULL REFERENCES public.providers(id),
  -- First of the month, Africa/Cairo semantics throughout.
  month         DATE NOT NULL CHECK (month = date_trunc('month', month)::DATE),
  version       INTEGER NOT NULL CHECK (version >= 1),
  status        TEXT NOT NULL CHECK (status IN ('issued','sent','settled','superseded')),

  issued_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  issued_by     UUID REFERENCES auth.users(id),
  sent_at       TIMESTAMPTZ,
  sent_by       UUID REFERENCES auth.users(id),
  settled_at    TIMESTAMPTZ,
  settled_by    UUID REFERENCES auth.users(id),
  superseded_by UUID REFERENCES public.commission_statements(id),

  -- Totals snapshot, in integer piasters (core's money unit). Frozen at issue:
  -- the whole point of a statement is that it does not move when the underlying
  -- bookings do.
  gmv_piasters              BIGINT  NOT NULL,
  commissionable_count      INTEGER NOT NULL,
  commission_total_piasters BIGINT  NOT NULL,
  excluded_count            INTEGER NOT NULL,
  excluded_amount_piasters  BIGINT  NOT NULL,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider_id, month, version)
);

COMMENT ON TABLE public.commission_statements IS
  'An ISSUED monthly statement. Draft = no row. settled is TERMINAL: no re-issue, no edit; later drift becomes a credit-forward NOTE against the next month.';

CREATE INDEX commission_statements_lookup
  ON public.commission_statements (provider_id, month, version DESC);

CREATE TABLE public.commission_statement_lines (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  statement_id        UUID NOT NULL REFERENCES public.commission_statements(id) ON DELETE CASCADE,
  booking_id          UUID NOT NULL REFERENCES public.bookings(id),
  -- Denormalised ON PURPOSE. These are the numbers the partner was shown; they
  -- must survive the booking changing underneath them, which is exactly the
  -- scenario the change-detection strip exists to surface.
  booking_ref         TEXT NOT NULL,
  booking_date        DATE NOT NULL,
  method              TEXT NOT NULL CHECK (method IN ('cash','prepaid')),
  event_date          DATE,
  event_kind          TEXT NOT NULL CHECK (event_kind IN ('payment','completion','excluded')),
  amount_piasters     BIGINT NOT NULL,
  rate_percent        NUMERIC(5,2),
  commission_piasters BIGINT NOT NULL DEFAULT 0,
  -- Excluded rows are STORED, not dropped: the design's export note requires
  -- them printed with their reason and a zero commission — "no silent deletion".
  excluded            BOOLEAN NOT NULL DEFAULT FALSE,
  excluded_reason     TEXT,
  UNIQUE (statement_id, booking_id)
);

COMMENT ON TABLE public.commission_statement_lines IS
  'Frozen per-booking snapshot copied at issue time. Includes EXCLUDED rows (system-closed) with zero commission so paper and screen agree.';

CREATE INDEX commission_statement_lines_by_statement
  ON public.commission_statement_lines (statement_id);

-- ───────────────────────────────────────────────────────────────────────────
-- ③ Backfill — 12% for both providers, from the launch epoch.
--
-- ⚠ PLACEHOLDER, ruled by the founder 2026-08-09: no signed rates exist yet.
-- The design's «١٢٪ → ١٣٪ من ١٦ يوليو» was ILLUSTRATIVE and is deliberately NOT
-- seeded — tests bring their own rate-change fixtures. Real values are entered
-- through A03 before the first statement a partner actually receives; that is
-- recorded as a launch blocker in PROGRESS.
--
-- 2026-01-01 is comfortably before the earliest booking in any environment, so
-- no event can fall into an uncovered date and raise the missing-rate error.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO public.provider_commission_rates (provider_id, percent, effective_from, note)
SELECT p.id, 12.00, DATE '2026-01-01',
       'PLACEHOLDER — backfilled by A02. No signed agreement rate exists yet; replace via A03.'
FROM public.providers p
ON CONFLICT (provider_id, effective_from) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────
-- ④ RLS. Read-only to admins; every write goes through a SECURITY DEFINER
--    function (CLAUDE.md §8's write-path rule). No client INSERT/UPDATE policy
--    exists on ANY of the three tables, deliberately — an RLS policy beside an
--    RPC is decoration, and it scopes ROWS while saying nothing about COLUMNS.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.provider_commission_rates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_statements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_statement_lines  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission rates: admin reads"
  ON public.provider_commission_rates FOR SELECT
  USING (public.get_user_role() = 'admin');

CREATE POLICY "commission statements: admin reads"
  ON public.commission_statements FOR SELECT
  USING (public.get_user_role() = 'admin');

CREATE POLICY "commission statement lines: admin reads"
  ON public.commission_statement_lines FOR SELECT
  USING (public.get_user_role() = 'admin');

-- Supabase grants every column to anon/authenticated by default, which is how
-- five holes reached production before REFACTOR 2/N. Close them at birth.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES
  ON public.provider_commission_rates, public.commission_statements, public.commission_statement_lines
  FROM anon, authenticated;
REVOKE ALL
  ON public.provider_commission_rates, public.commission_statements, public.commission_statement_lines
  FROM anon;

-- ───────────────────────────────────────────────────────────────────────────
-- ⑤ ⚠ A02's OPENING DECISION — the two worst policies A01 switched on.
--
-- A01 gave the schema its first real admin, which turned twelve dormant
-- `get_user_role() = 'admin'` ALL policies LIVE and flagged eleven for the
-- A-series to rule on. A02 owns the two that touch money:
--
--   bookings: admin full access   → an admin's BROWSER could INSERT/UPDATE
--                                   total_amount, commission_amount and
--                                   payment_status, reversing 20260729160519
--   payments: admin full access   → an admin's BROWSER could declare a payment
--                                   `completed`, breaking §8's settlement
--                                   boundary
--
-- Both are ALL policies with a NULL with_check, so they are column-blind, and
-- both tables carry blanket table-level INSERT/UPDATE grants to anon and
-- authenticated — verified in the live catalog, not assumed — which makes the
-- RLS policy the only gate.
--
-- THE DECISION: DROP THEM OUTRIGHT. A02 is READ-ONLY over these two tables (the
-- statement's only write is the invoice lifecycle, which lives entirely in
-- commission_statements). Nothing is lost, because admin READ access does not
-- come from these policies at all — the `… sees own` SELECT policies already
-- OR in `get_user_role() = 'admin'`, and they stay. Verified there are no
-- client writes to either table anywhere in apps/, packages/ or
-- supabase/functions/: every real write is an Edge Function on the service
-- role, which bypasses RLS regardless.
--
-- This is the writer-function route applied at its cheapest: the door closes
-- and no replacement door is needed, because nobody was walking through it.
-- The remaining nine flagged policies stay with A03–A06, per founder ruling ③.
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bookings: admin full access" ON public.bookings;
DROP POLICY IF EXISTS "payments: admin full access" ON public.payments;
