# DECISION — When commission attaches

> Ratified 2026-07-28. Answers the second of the two open business questions
> raised in F07. Shapes P-series reporting and partner invoicing.

---

## The question

InstaHealth earns commission per booking. At which event does it attach —
when the patient pays, or when the service is actually delivered?

The answer differs by payment method, which is why it needed ratifying rather
than assuming.

## The decision

**Prepaid (card / wallet): commission attaches AT PAYMENT.**
The money has moved through us. The booking is settled the moment
`confirm_booking` writes `payment_status = 'paid'` and the `payments` row goes
`completed`. Commission is earned there.

**Cash at branch: commission attaches AT COMPLETION.**
Nothing has moved until the desk collects. The receptionist marking a cash
booking `completed` IS the payment event — `mark_booking_outcome` flips
`payment_status` `cash → paid` and the `payments` row `pending → completed` in
the same transaction. Commission is earned there, not at booking time.

**The principle:** we only bill a partner for a visit that actually happened and
money that actually moved. Charging commission on a cash booking at reservation
time would invoice partners for no-shows.

## The data trail

Everything needed to compute this already exists — that is why P01 added the
timestamps even though nothing read them yet:

| Column                  | Meaning                             |
| ----------------------- | ----------------------------------- |
| `bookings.confirmed_at` | prepaid commission event            |
| `bookings.completed_at` | cash commission event               |
| `bookings.arrived_at`   | attendance, for reconciliation      |
| `bookings.no_show_at`   | non-event; no commission either way |
| `bookings.closed_by`    | `'system'` = a GUESS, see below     |
| `payments.status`       | `completed` is the money-moved flag |

**⚠ Auto-closed bookings never attach commission.** A `no_show` written by the
nightly job (`closed_by = 'system'`) is the system guessing, not a delivered
service — and its cash `payments` row is deliberately left `pending`. Reporting
must not treat it as revenue. See `DECISION-booking-outcome-lifecycle.md`.

## Not yet built

`bookings.commission_amount` and `commission_rate` are still unwritten — nothing
computes or persists commission today. This decision fixes the RULE so the
P-series reporting spec can be written against it; the calculation itself lands
with that spec (core already has the money math in `business/pricing.ts`, in
integer piasters, and it THROWS on a missing rate rather than defaulting).

## Consequences

- A cash booking that is never completed earns nothing, by design.
- Refunds are out of scope while payments are simulated; when PayTabs is live, a
  refunded prepaid booking must reverse its commission — that belongs in the
  PayTabs integration spec.
- Partner invoicing must join on the event column that matches the method, not
  on `created_at`.
