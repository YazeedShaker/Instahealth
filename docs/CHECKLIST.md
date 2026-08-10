# CHECKLIST — what verification a change actually needs

> **One page. Find your tier, do that, ship.**
> The long-form reasoning, every trap and every scar lives in
> [`ENGINEERING-WORKFLOW.md`](./ENGINEERING-WORKFLOW.md) — this is the index to it,
> not a replacement. When the two disagree, the workflow doc wins.

---

## ⚠ TIER 1 RIGOR IS NOT REDUCED BY THIS DOCUMENT. NOT ONE STEP.

Read that again before using the table below, because the table is easy to
misread as a general permission to do less.

Every rule that has ever cost this project something still applies **in full**
to money, state, auth, and migrations: verify by running from the state the bug
starts in · a probe that cannot fail is not a probe · the E2E runs against a
PRODUCTION build · clients supply identities, never values · the authorization
surface is regenerated and the diff IS the review · read the screenshot you
captured.

**What tiering changes is the DENOMINATOR, not the numerator.** Until now every
change — a copy tweak, a padding fix, a settlement function — paid the same
five-minute full-gate tax and the same manual verification ritual. That is what
made the rigor feel expensive, and expensive rigor is the kind that eventually
gets skipped on the change that needed it. Tiering exists so the full treatment
is **affordable where it matters**, by not spending it where it demonstrably
does not.

**If you are unsure which tier a change is, it is Tier 1.** The cost of
over-verifying a copy change is minutes. The cost of under-verifying a money
change is a partner invoiced for services never delivered — which has already
been caught twice, in one feature.

---

## The tiers

|                          | **Tier 1 — money · state · auth · migrations**                                                                                      | **Tier 2 — UI on proven patterns**                                                                                     | **Tier 3 — copy · style**                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **What it is**           | Anything touching commission, payments, booking state, RLS/policies/grants, SECURITY DEFINER functions, sessions, or a DB migration | A new screen or component assembled from the existing contract and existing RPCs — no new write path, no new predicate | Text, spacing, colour, an icon. No logic, no data shape |
| **Unit tests**           | Required, in `packages/core`, thresholds hold                                                                                       | Required for any new core helper                                                                                       | —                                                       |
| **Live-DB verification** | **Required.** A Node run against dev, from the state the bug starts in, with real rows created and destroyed                        | Only if it reads a new RPC                                                                                             | —                                                       |
| **E2E**                  | Full path, on a **production build** (`E2E_PROD=1`)                                                                                 | **One Playwright happy path**                                                                                          | —                                                       |
| **Screenshots**          | Required if it renders                                                                                                              | **Required**, and _read_ — §9                                                                                          | —                                                       |
| **Manual founder check** | Required, before merge                                                                                                              | **Batched — weekly**, not per PR                                                                                       | —                                                       |
| **authz surface**        | Regenerate + commit; the diff is the review                                                                                         | Only if policies/grants moved                                                                                          | —                                                       |
| **Gate**                 | `pnpm gate` (full)                                                                                                                  | `pnpm gate` (full)                                                                                                     | CI only                                                 |

**Tier 2's manual check is BATCHED, not skipped.** Once a week, open the
surfaces that changed and look at them. The batch is the deal that makes Tier 2
cheap; dropping it turns Tier 2 into "nobody ever looked", which is how P05
shipped a screen that was rebuilt wholesale.

---

## Deciding the tier — in order, first match wins

1. Does it change a **migration, policy, grant, or function body**? → **Tier 1**
2. Can it change **what a partner is owed, what a patient paid, or who can do
   what**? → **Tier 1**
3. Does it introduce a **new write path or a new predicate** the UI relies on?
   → **Tier 1**
4. Is it a screen or component built from the **existing** contract and
   **existing** RPCs? → **Tier 2**
5. Is it only text, spacing, or colour? → **Tier 3**
6. Anything else → **Tier 1**

⚠ **A Tier 3 change to a Tier 1 surface is Tier 1.** Relabelling a button is
copy; relabelling «تحديد كمُسوّاة» sits on a terminal state transition, so it is
Tier 1. The tier follows the _blast radius_, not the diff size.

---

## Every tier, always

These are not negotiable at any tier, because each one is cheap and each one has
caught something:

- `pnpm gate` before pushing (Tier 3 may lean on CI, but green locally is faster
  than green in CI).
- **Read the counts.** A skipped suite and a passing suite look identical in a
  summary line. If a number moved, find out why.
- **No screen without a design source** (§9) — a handoff, or a spec that says to
  compose from the contract.
- If you debug a trap that cost more than one attempt, **append it to
  ENGINEERING-WORKFLOW in the same PR**.

---

## Where the detail lives

| Question                                   | Section                               |
| ------------------------------------------ | ------------------------------------- |
| How do I run the gates, and in what order? | WORKFLOW §3                           |
| What CI facts will bite me?                | WORKFLOW §4                           |
| How do I change the database safely?       | WORKFLOW §5                           |
| Mobile/Expo traps                          | WORKFLOW §6                           |
| Next.js / server-action / caching traps    | WORKFLOW §6a                          |
| Core package rules, money math             | WORKFLOW §7                           |
| UI fidelity, screenshots, E2E discipline   | WORKFLOW §9                           |
| Who may write what, right now              | `supabase/authorization-surface.json` |
| What shipped and what is still open        | `PROGRESS.md`                         |

---

_Added 2026-08-09. The tiers are a budget for attention, not a discount on care._
