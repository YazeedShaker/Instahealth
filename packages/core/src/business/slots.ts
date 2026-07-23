// Slot display/selection math — RENDERING AND OPTIMISTIC UX ONLY.
//
// The Postgres functions are AUTHORITATIVE: `create_slot_hold()` decides whether
// a hold exists, `confirm_booking()` decides whether a booking lands, and the
// `cleanup-holds` cron releases expired holds. These helpers only interpret rows
// already returned by a query so the UI can render statuses and countdowns.
// A hold that looks valid client-side can still be rejected by `confirm_booking()`
// — the apps must handle that RPC error path.

import { HOLD_WARNING_SECONDS, SLOT_HOLD_MINUTES } from '../constants'
import type { SlotStatus } from '../types/domain.types'

const MILLISECONDS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60

/** Availability inputs as returned by the slot query — core interprets, it never counts holds itself. */
export interface SlotAvailability {
  capacity: number
  bookedCount: number
  activeHoldCount: number
  isBlocked: boolean
}

/** 'full' when blocked, or when booked + active holds have consumed capacity. */
export function getSlotStatus(slot: SlotAvailability): SlotStatus {
  if (slot.isBlocked) return 'full'
  if (slot.bookedCount + slot.activeHoldCount >= slot.capacity) return 'full'
  return 'available'
}

/** Client-side mirror of the DB hold expiry: created_at + SLOT_HOLD_MINUTES. */
export function holdExpiresAt(createdAt: Date): Date {
  return new Date(
    createdAt.getTime() + SLOT_HOLD_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND,
  )
}

/** Whole seconds remaining on a hold, clamped at 0. `now` is a parameter — no hidden Date.now(). */
export function getRemainingHoldSeconds(expiresAt: Date, now: Date): number {
  const remainingMs = expiresAt.getTime() - now.getTime()
  if (remainingMs <= 0) return 0
  return Math.floor(remainingMs / MILLISECONDS_PER_SECOND)
}

/** True under HOLD_WARNING_SECONDS — drives the calm→amber countdown state. */
export function isHoldExpiringSoon(remainingSeconds: number): boolean {
  return remainingSeconds < HOLD_WARNING_SECONDS
}
