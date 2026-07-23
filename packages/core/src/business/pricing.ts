// Booking totals, commission, and payout — all money math runs in integer
// piasters internally and rounds half-up only at the boundary. No float drift.
//
// The commission rate is DATA, not code: it comes from the provider/branch row
// (per-partner negotiated). A missing or invalid rate is an error — never a
// silent default.

import type { SelectedService } from '../types/domain.types'

const PIASTERS_PER_EGP = 100

function toPiasters(amountEgp: number): number {
  return Math.round(amountEgp * PIASTERS_PER_EGP)
}

function toEgp(piasters: number): number {
  return piasters / PIASTERS_PER_EGP
}

function assertValidCommissionPercent(commissionPercent: number): void {
  if (
    typeof commissionPercent !== 'number' ||
    !Number.isFinite(commissionPercent) ||
    commissionPercent <= 0 ||
    commissionPercent > 100
  ) {
    throw new Error(
      `Invalid commission percent: ${String(commissionPercent)}. The rate comes from the provider/branch row — a missing rate must be fixed in data, not defaulted in code.`,
    )
  }
}

/** Sum of selected service prices in EGP. Empty selection → 0. */
export function calculateBookingTotal(selectedServices: SelectedService[]): number {
  const totalPiasters = selectedServices.reduce(
    (sum, service) => sum + toPiasters(service.priceEgp),
    0,
  )
  return toEgp(totalPiasters)
}

/** InstaHealth commission on a booking total, 2-decimal-safe (half-up in piasters). */
export function calculateCommission(totalEgp: number, commissionPercent: number): number {
  assertValidCommissionPercent(commissionPercent)
  const commissionPiasters = Math.round((toPiasters(totalEgp) * commissionPercent) / 100)
  return toEgp(commissionPiasters)
}

/** What the provider receives: total minus commission. Used by the provider
 * dashboard and commission reports — same function, same rounding. */
export function calculateProviderPayout(totalEgp: number, commissionPercent: number): number {
  const commissionEgp = calculateCommission(totalEgp, commissionPercent)
  return toEgp(toPiasters(totalEgp) - toPiasters(commissionEgp))
}
