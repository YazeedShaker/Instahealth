import type { BookingConfirmation } from '@instahealth/core'
import * as Calendar from 'expo-calendar'
import { Platform } from 'react-native'

// "أضف إلى التقويم" on the confirmation screen.
//
// Slot times are Egypt WALL-CLOCK values (`slot_date` + `slot_time`, no zone).
// The device may sit in any timezone, so the event must be pinned to
// Africa/Cairo — otherwise a patient whose phone is on GMT gets a reminder two
// hours off. Cairo has been UTC+2 year-round since Egypt's DST changes, but we
// derive the offset rather than assume it.

const CAIRO_TIME_ZONE = 'Africa/Cairo'
const DEFAULT_DURATION_MINUTES = 30

export type AddToCalendarResult = 'added' | 'permissionDenied' | 'noCalendar' | 'error'

/** Converts an Egypt wall-clock date+time into a real instant, whatever the
 * device timezone is. Finds the UTC instant whose Cairo rendering matches. */
function cairoWallClockToDate(slotDate: string, slotTime: string): Date {
  const [hour = '0', minute = '0'] = slotTime.split(':')
  const naiveUtc = new Date(`${slotDate}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:00Z`)
  // How far Cairo is from UTC at that moment, in ms.
  const cairoRendering = new Date(naiveUtc.toLocaleString('en-US', { timeZone: CAIRO_TIME_ZONE }))
  const utcRendering = new Date(naiveUtc.toLocaleString('en-US', { timeZone: 'UTC' }))
  const offsetMs = cairoRendering.getTime() - utcRendering.getTime()
  return new Date(naiveUtc.getTime() - offsetMs)
}

async function findWritableCalendarId(): Promise<string | null> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
  const writable = calendars.filter((calendar) => calendar.allowsModifications)
  const fallback = writable[0]
  if (fallback === undefined) return null
  if (Platform.OS === 'ios') {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync().catch(() => null)
    if (defaultCalendar !== null && defaultCalendar.allowsModifications) return defaultCalendar.id
  }
  const primary = writable.find((calendar) => calendar.isPrimary)
  return (primary ?? fallback).id
}

/**
 * Adds the confirmed booking to the device calendar. Never throws — every
 * failure is a named result the screen turns into calm Arabic copy
 * (PRODUCT.md §8: errors offer the next action, never a dead end).
 */
export async function addBookingToCalendar(
  confirmation: BookingConfirmation,
): Promise<AddToCalendarResult> {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync()
    if (status !== 'granted') return 'permissionDenied'

    const calendarId = await findWritableCalendarId()
    if (calendarId === null) return 'noCalendar'

    const startDate = cairoWallClockToDate(confirmation.slotDate, confirmation.slotTime)
    const endDate = new Date(startDate.getTime() + DEFAULT_DURATION_MINUTES * 60_000)
    const serviceNames = confirmation.services.map((service) => service.nameAr).join('، ')

    await Calendar.createEventAsync(calendarId, {
      title: `موعد في ${confirmation.branchNameAr}`,
      startDate,
      endDate,
      timeZone: CAIRO_TIME_ZONE,
      location: confirmation.branchAddressAr ?? confirmation.branchNameAr,
      notes:
        `${serviceNames}` +
        (confirmation.bookingRef !== null ? `\nرقم الحجز: ${confirmation.bookingRef}` : ''),
    })
    return 'added'
  } catch {
    return 'error'
  }
}
