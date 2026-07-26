import {
  computePreparationNotes,
  isReassurancePrepNote,
  type PreparationResult,
  type SelectedService,
} from '@instahealth/core'

// Presence logic for the preparation summary strip: it renders ONLY when the
// current selection actually produced a summary (DECISION-provider-data-model
// §3 — no blanket branch-level note, nothing shown for prep-free selections).

export function getPreparationStrip(selectedServices: SelectedService[]): PreparationResult | null {
  const result = computePreparationNotes(selectedServices)
  if (result.summaryAr === null) return null
  return result
}

export type ServicePrepChip = 'fasting' | 'prep' | null

/** The per-row indicator chip: "يتطلب صياماً" for fasting services, a generic
 * "يتطلب تحضيراً" for other real prep. Reassurance-only notes get no chip —
 * SAME core predicate the strip uses, so chip and strip can never disagree. */
export function getServicePrepChip(service: SelectedService): ServicePrepChip {
  if (service.fastingHours !== null && service.fastingHours > 0) return 'fasting'
  const note = service.preparationNotesAr?.trim() ?? ''
  if (note.length === 0) return null
  if (isReassurancePrepNote(note)) return null
  return 'prep'
}
