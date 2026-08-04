# SPEC · P05 — Dashboard: Branch Profile «بيانات الفرع» (Web)

> Hand this to Claude Code. Read the root docs, ENGINEERING-WORKFLOW (§5 write-path law,
> §6a TanStack rules), PROGRESS (REFACTOR 2/N — the branches write policies are GONE),
> DECISION-slot-allocation-ownership, and SPEC-P03 (whose `update_branch_service` is the
> writer template). ⚠ There is NO design-bundle screen for this surface — the DESIGN-02
> brief ends at screen 6 and `Provider Profile.dc.html` is the PATIENT branch screen (F04),
> despite its name. Build from the design-system contract and the P01–P04 dashboard idiom;
> flag the missing bundle screen for a future design pass. One PR.

## Why this exists

REFACTOR 2/N dropped the column-blind `branches` UPDATE policy, which was the only client
write path to `branches`. That was correct — the policy let staff set `rating` and
`instahealth_slot_allocation` — but it also removed the legitimate half: a branch fixing its
own phone number or address text. P05 restores exactly that half, through a SECURITY DEFINER
writer, and gives the desk one place to SEE the branch's own record.

## The field split (the actual decision in this spec)

**Branch-maintained — editable via `update_branch_profile`:**

| field        | validation (server-side, the real boundary)                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `phone`      | required; Egyptian landline or mobile; digits + optional dashes, 8–11 digits after normalizing; trimmed                      |
| `whatsapp`   | optional (NULL allowed); Egyptian MOBILE only (`01[0125]` + 8 digits) — it is a WhatsApp target, landlines cannot receive it |
| `address_ar` | required; non-empty after trim; ≤ 500 chars                                                                                  |
| `address_en` | optional (NULL allowed); ≤ 500 chars                                                                                         |

**InstaHealth-owned — rendered read-only with the P04 gated treatment
(«لتعديل هذه البيانات تواصل مع إنستاهيلث» + support address):**

- `name_ar` / `name_en` — partner identity; renaming confuses patients with live bookings.
- `lat` / `lng`, `governorate`, `district` — the discovery pin. A branch moving its own pin
  is a marketplace-integrity fact (distance ranking); address TEXT is editable, the PIN is not.
- `operating_hours` — the daily working window is a COMMERCIAL term
  (DECISION-slot-allocation-ownership) and slot generation derives spacing from it.
- `instahealth_slot_allocation`, `is_active` — already decided (P04 / REFACTOR 2/N).
- `holiday_mode` — ⚠ deliberately NOT a desk toggle yet: today the flag only gates nightly
  GENERATION, so flipping it on would leave ~30 days of already-materialised slots bookable —
  a toggle that claims «الفرع في إجازة» while patients keep booking is a lie. Display the
  state read-only. An honest holiday feature (blocking existing slots, handling their
  bookings, patient messaging) is its own spec — flag for founders.
- `rating` / `review_count` — displayed in the header, never editable (obviously).

## The writer (migration, `update_branch_service` shape)

`update_branch_profile(p_phone text, p_whatsapp text, p_address_ar text, p_address_en text)`

- ⚠ NO branch-id parameter. The branch is DERIVED from the caller's `provider_users`
  membership inside the function — same law as `create_slot_hold`: delete the parameter,
  don't validate it. A caller with no membership gets `branch_not_found`.
  (Multi-branch staff: first branch, matching `getProviderContext` — flag stays open.)
- SECURITY DEFINER, `SET search_path = public`, REVOKE from PUBLIC/anon,
  GRANT to authenticated + service_role only.
- Validates per the table above; returns `jsonb` success/error in the P03 idiom
  (`invalid_phone`, `invalid_whatsapp`, `invalid_address`, `branch_not_found`).
- No-change save returns `unchanged: true` and writes NO audit row (changes, not clicks).
- Audit: `branch_profile_history` (id, branch_id, `old_values jsonb`, `new_values jsonb` —
  keys present = exactly the fields that changed — changed_by, changed_at). Append-only:
  no client write policy of any kind; SELECT policy for the owning branch's staff + admin,
  mirroring P03's history policy. jsonb diff instead of P03's explicit columns because this
  table covers four fields today and any future profile field tomorrow.
- **NO new UPDATE policy on `branches`.** The function is the only door
  (CLAUDE.md §8 write-path rule). `pnpm authz:write` in the same PR; the diff is the review.

## Screen `/dashboard/profile` (sidebar slot «بيانات الفرع» — already reserved, disabled)

- Header card: branch name + type badge + rating line (read-only facts, dashboard idiom).
- «بيانات التواصل والعنوان» form: the four editable fields. Controlled inputs +
  the shared Zod schema (`packages/core/schemas` — tested, keeps the coverage
  bar); react-hook-form is NOT introduced — the web app has no RHF precedent
  (login is a plain form) and four fields do not justify a new dependency.
  Server-side errors surface inline per field, not as a toast.
- «آخر تحديث» line from `branch_profile_history` max(changed_at) — NULL renders
  «لم يُحدَّث بعد» (P03 honesty rule).
- Gated section: hours, pin/map line, allocation, holiday state — P04's visual treatment,
  ZERO operable controls, one support sentence.
- Save: pending spans the write AND the confirming refetch (§6a — never
  `useMutation.isPending` alone); no optimistic paint of saved values; re-entry guarded by
  ref. Reads via TanStack Query with `staleTime: 0` + `refetchOnMount: 'always'`.
- States: loading skeleton (route `loading.tsx`), load-failure with retry, save-failure.

## Tests

- Core: Zod schema unit tests (bounds, mobile-only whatsapp, trim/NULL handling).
- Node vs live dev DB (anon key, Node 22+ binary): happy path writes + audit row with only
  changed keys · a patient session gets `branch_not_found` · anon key alone gets `42501` ·
  invalid phone/whatsapp/address refused server-side · no-change save writes no history row ·
  raw `branches` UPDATE still refused by RLS (the door stays closed).
- Playwright: page renders the seeded profile · edit phone → save → persists after reload →
  **restore the original value in the same test** (branches is NOT reseeded by 004 — a
  drifting shared fixture is the §9 lesson) · client validation blocks a bad mobile ·
  gated section contains zero operable controls. Fixture tripwire count unchanged
  (no booking fixtures consumed).
- Fidelity captures at 1366×768 — no bundle screen exists, so captures document the built
  screen (state the deviation in the PR body).

## Acceptance criteria

- [ ] The four fields save through `update_branch_profile`; every other `branches` column is
      untouchable by any client path (prove with the raw-UPDATE Node check)
- [ ] Audit rows record only changed fields; «آخر تحديث» honest for never-edited branches
- [ ] Gated section states hours/pin/allocation/holiday as InstaHealth-owned, zero controls
- [ ] Sidebar «بيانات الفرع» becomes a live link
- [ ] `database.ts` + `authorization-surface.json` regenerated in the same PR
- [ ] PROGRESS updated (Shipped entry + strike the stale generate-slots cron risk with the
      2026-08-04 verification evidence) · CI green

## What NOT to do

No holiday toggle, no hours editing, no pin editing, no photo upload (needs storage
buckets + moderation — its own spec), no branch switcher, no role tiers. No new UPDATE
policy on `branches` — if you find yourself writing one, re-read CLAUDE.md §8.
