import { cairoWallClockToInstant, type BookingConfirmation } from '@instahealth/core'
import * as Calendar from 'expo-calendar'
import { Platform } from 'react-native'

// "أضف إلى التقويم" on the confirmation screen.
//
// Slot times are Egypt WALL-CLOCK values (`slot_date` + `slot_time`, no zone).
// The device may sit in any timezone, so the event must be pinned to
// Africa/Cairo — otherwise a patient whose phone is on GMT gets a reminder two
// hours off. The wall-clock → instant conversion lives in core
// (`cairoWallClockToInstant`), where it is unit-tested; this module previously
// had its own copy that worked in Node and returned Invalid Date on Hermes.

const CAIRO_TIME_ZONE = 'Africa/Cairo'
const DEFAULT_DURATION_MINUTES = 30

export type AddToCalendarResult = 'added' | 'permissionDenied' | 'noCalendar' | 'error'

/** Never swallow the native reason. A bare `catch → 'error'` turned three very
 * different iOS/Android failures into one dead-end message, and the founder's
 * device report ("تعذّرت الإضافة") could not be told apart from a genuine
 * EventKit refusal. Every stage now names itself in the dev log. */
function logDevError(stage: string, error: unknown): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[calendar] ${stage} failed:`, error)
  }
}

/** iOS first asks EventKit for the DEFAULT calendar: it is the one the user
 * expects an event to land in, and it resolves under permission shapes where
 * enumerating every calendar does not (iOS 17 split full vs write-only access,
 * and write-only cannot read the calendar list). Enumeration is the fallback,
 * and on Android it is the only path. */
async function findWritableCalendarId(): Promise<string | null> {
  if (Platform.OS === 'ios') {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync().catch((error: unknown) => {
      logDevError('getDefaultCalendarAsync', error)
      return null
    })
    if (defaultCalendar !== null && defaultCalendar.allowsModifications) return defaultCalendar.id
  }

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT).catch(
    (error: unknown) => {
      logDevError('getCalendarsAsync', error)
      return []
    },
  )
  const writable = calendars.filter((calendar) => calendar.allowsModifications)
  const primary = writable.find((calendar) => calendar.isPrimary)
  const chosen = primary ?? writable[0]
  return chosen === undefined ? null : chosen.id
}

/**
 * Adds the confirmed booking to the device calendar. Never throws — every
 * failure is a named result the screen turns into calm Arabic copy
 * (PRODUCT.md §8: errors offer the next action, never a dead end).
 */
export async function addBookingToCalendar(
  confirmation: BookingConfirmation,
): Promise<AddToCalendarResult> {
  let status: Calendar.PermissionStatus | undefined
  try {
    ;({ status } = await Calendar.requestCalendarPermissionsAsync())
  } catch (error) {
    logDevError('requestCalendarPermissionsAsync', error)
    return 'error'
  }
  if (status !== 'granted') return 'permissionDenied'

  const calendarId = await findWritableCalendarId()
  if (calendarId === null) return 'noCalendar'

  let startDate: Date
  let endDate: Date
  try {
    startDate = cairoWallClockToInstant(confirmation.slotDate, confirmation.slotTime)
    endDate = new Date(startDate.getTime() + DEFAULT_DURATION_MINUTES * 60_000)
  } catch (error) {
    // Malformed slot values are a bug, not something the patient can act on —
    // but an unhandled throw here would escape into the screen's press handler.
    logDevError('cairoWallClockToInstant', error)
    return 'error'
  }

  const serviceNames = confirmation.services.map((service) => service.nameAr).join('، ')

  try {
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
  } catch (error) {
    logDevError('createEventAsync', error)
    return 'error'
  }
}
