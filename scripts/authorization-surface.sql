-- ═══════════════════════════════════════════════════════════════════════════
-- THE AUTHORIZATION SURFACE — everything that decides who may read or write.
--
-- Emits ONE json document describing, for the `public` schema:
--   · every table's RLS state and policies (command, roles, USING, WITH CHECK)
--   · every COLUMN `anon` / `authenticated` may INSERT or UPDATE
--   · every function's SECURITY DEFINER flag, search_path and EXECUTE grants
--   · SECURITY DEFINER functions taking an IDENTITY parameter (forbidden, §5)
--
-- WHY THIS EXISTS. Six security holes have shipped, all the same shape: a value
-- the client had no business asserting reached the database unchecked. The law
-- against it is written down (ENGINEERING-WORKFLOW §5) and it kept happening,
-- because answering "can a client write this column?" means cross-referencing
-- THREE disconnected mechanisms — RLS policies, function grants, and function
-- bodies — and nobody holds that in their head. Postgres also defaults to open:
-- `EXECUTE` is granted to PUBLIC automatically, and an UPDATE policy is
-- COLUMN-BLIND unless you say otherwise.
--
-- So: enumerate the surface, check it in, and fail CI when it drifts. A new
-- policy or grant then cannot land silently — it shows up as a reviewable diff.
--
-- ⚠ WHAT THIS CANNOT SEE: logic INSIDE a function body. `cancel_booking`
-- writing `p_cancelled_by` verbatim was a body bug and no catalog query would
-- have caught it. The identity-parameter check below is the cheap partial
-- defence; the real one is the write-path rule in CLAUDE.md §8.
--
-- Output is consumed by scripts/check-authorization-surface.mjs.
-- Ordering is fully deterministic so the JSON diffs cleanly.
-- ═══════════════════════════════════════════════════════════════════════════

WITH policies AS (
  SELECT c.relname AS table_name,
         pol.polname AS policy_name,
         CASE pol.polcmd
           WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
           WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE'
           ELSE 'ALL' END AS command,
         COALESCE(
           (SELECT string_agg(r.rolname, ',' ORDER BY r.rolname)
              FROM pg_roles r WHERE r.oid = ANY (pol.polroles)),
           'PUBLIC') AS roles,
         COALESCE(pg_get_expr(pol.polqual, pol.polrelid), '-') AS using_expr,
         COALESCE(pg_get_expr(pol.polwithcheck, pol.polrelid), '-') AS with_check
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_policy pol ON pol.polrelid = c.oid
   WHERE c.relkind = 'r'
),
tables AS (
  SELECT c.relname AS table_name,
         c.relrowsecurity AS rls_enabled,
         c.relforcerowsecurity AS rls_forced,
         -- Needed to tell a SCOPED grant from a BLANKET one: a write grant
         -- covering every column is the column-blind shape, and without the
         -- total there is nothing to compare a list length against.
         (SELECT count(*) FROM pg_attribute a
           WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped)
           AS column_count,
         COALESCE(
           (SELECT jsonb_agg(jsonb_build_object(
                     'policy', p.policy_name, 'command', p.command,
                     'roles', p.roles, 'using', p.using_expr, 'withCheck', p.with_check)
                   ORDER BY p.command, p.policy_name)
              FROM policies p WHERE p.table_name = c.relname),
           '[]'::jsonb) AS policies,
         -- Columns each client role may WRITE at SQL-grant level. RLS decides
         -- WHICH ROWS; this decides WHICH COLUMNS — and a column-blind UPDATE
         -- policy over a full-table grant is how `branches.rating` became
         -- partner-writable.
         -- ⚠ Recorded ONLY for tables a normal client can actually write.
         -- Supabase grants every column to anon+authenticated by default, so
         -- listing them everywhere is 300 lines of noise that hides the signal.
         -- Where NO client write policy exists the grants are unreachable; the
         -- moment one is added, the drift check reports the policy AND this list
         -- appears alongside it — which is exactly when the columns start to
         -- matter.
         --
         -- ⚠ The exclusion matches the admin-ONLY policy EXACTLY. A first
         -- attempt used `NOT LIKE '%admin%'`, which silently dropped every
         -- provider policy — they all carry `OR get_user_role() = 'admin'` as an
         -- escape hatch — and reported the schema as far safer than it is.
         CASE WHEN EXISTS (
                SELECT 1 FROM policies p
                 WHERE p.table_name = c.relname
                   AND p.command IN ('INSERT', 'UPDATE', 'ALL')
                   AND p.using_expr <> '(get_user_role() = ''admin''::text)'
              )
         -- ⚠ INSERT and UPDATE are recorded SEPARATELY. A first version OR'd
         -- them, which made `users.phone` read as writable when it is in fact
         -- INSERT-only — set once at first sign-in and never editable after,
         -- because it is the OTP identity. On a security baseline that
         -- difference is the whole point, so it must not be flattened.
         THEN COALESCE(
           (SELECT jsonb_object_agg(role_name, privs)
              FROM (
                SELECT g.role_name,
                       jsonb_strip_nulls(jsonb_build_object(
                         'insert', (SELECT jsonb_agg(a.attname ORDER BY a.attname)
                                      FROM pg_attribute a
                                     WHERE a.attrelid = c.oid AND a.attnum > 0
                                       AND NOT a.attisdropped
                                       AND has_column_privilege(g.role_name, c.oid,
                                                                a.attnum, 'INSERT')),
                         'update', (SELECT jsonb_agg(a.attname ORDER BY a.attname)
                                      FROM pg_attribute a
                                     WHERE a.attrelid = c.oid AND a.attnum > 0
                                       AND NOT a.attisdropped
                                       AND has_column_privilege(g.role_name, c.oid,
                                                                a.attnum, 'UPDATE'))
                       )) AS privs
                  FROM (VALUES ('anon'), ('authenticated')) AS g(role_name)
              ) writable
             WHERE privs <> '{}'::jsonb),
           '{}'::jsonb)
         ELSE '{}'::jsonb END AS writable_columns
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
   WHERE c.relkind = 'r'
),
fn_grants AS (
  SELECT p.oid,
         string_agg(DISTINCT CASE WHEN acl.grantee = 0 THEN 'PUBLIC'
                                  ELSE pg_get_userbyid(acl.grantee) END, ',') AS grants
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    -- aclexplode returns a SET, so it has to be a LATERAL join, not a CASE.
    LEFT JOIN LATERAL aclexplode(p.proacl) AS acl ON acl.privilege_type = 'EXECUTE'
   WHERE p.prokind = 'f'
   GROUP BY p.oid
),
functions AS (
  SELECT p.oid::regprocedure::text AS signature,
         p.prosecdef AS security_definer,
         COALESCE(array_to_string(p.proconfig, ','), '-') AS config,
         -- A NULL proacl means "no explicit ACL", which in Postgres means the
         -- default: EXECUTE to PUBLIC. Silence there is the dangerous case, so
         -- it is spelled out rather than left blank.
         COALESCE(g.grants, 'PUBLIC (default — no explicit ACL)') AS execute_grants,
         -- ⚠ §5: "A read function must take NO user id — filter on auth.uid()
         -- inside." An identity parameter on a SECURITY DEFINER function is the
         -- create_slot_hold / cancel_booking shape.
         --
         -- ⚠ INPUT parameters only. `proargnames` also holds the OUTPUT column
         -- names of a RETURNS TABLE function, and those legitimately include
         -- `cancelled_by` / `closed_by` — scanning all of them reported
         -- `get_branch_bookings_for_date` as taking an identity argument, which
         -- it does not. Input args occupy the first `pronargs` entries.
         EXISTS (
           SELECT 1
             FROM unnest((COALESCE(p.proargnames, ARRAY[]::text[]))[1:p.pronargs]) AS arg
            WHERE p.prosecdef
              AND arg ~* '(user_id|_by$|_by_|caller|actor|account_id|auth_id)'
         ) AS takes_identity_parameter
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    LEFT JOIN fn_grants g ON g.oid = p.oid
   WHERE p.prokind = 'f'
)
SELECT jsonb_pretty(jsonb_build_object(
  'tables', (SELECT jsonb_agg(jsonb_build_object(
                      'table', t.table_name,
                      'rlsEnabled', t.rls_enabled,
                      'rlsForced', t.rls_forced,
                      'columnCount', t.column_count,
                      'writableColumns', t.writable_columns,
                      'policies', t.policies) ORDER BY t.table_name)
               FROM tables t),
  'functions', (SELECT jsonb_agg(jsonb_build_object(
                         'signature', f.signature,
                         'securityDefiner', f.security_definer,
                         'config', f.config,
                         'executeGrants', f.execute_grants,
                         'takesIdentityParameter', f.takes_identity_parameter)
                       ORDER BY f.signature)
                  FROM functions f)
)) AS surface;
