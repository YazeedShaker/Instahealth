// computePreparationNotes() — implements the locked preparation-notes decision
// (docs/DECISION-provider-data-model.md): per-service, computed from the CURRENT
// selection, longest fast wins, duplicates merged, shown only when relevant.
// One source of truth for the selection screen, confirmation screen, and reminder SMS.

import type { PreparationNote, PreparationResult, SelectedService } from '../types/domain.types'
import { convertArabicDigits } from './phone'

// Locked summary copy — invites the expand action, never a dead end.
export const PREPARATION_SUMMARY_FASTING_AR =
  'بعض الخدمات المختارة تتطلب صياماً — اضغط لعرض التفاصيل'
export const PREPARATION_SUMMARY_FASTING_EN =
  'Some selected services require fasting — tap to view details'
export const PREPARATION_SUMMARY_PREP_AR = 'بعض الخدمات المختارة تتطلب تحضيراً — اضغط لعرض التفاصيل'
export const PREPARATION_SUMMARY_PREP_EN =
  'Some selected services require preparation — tap to view details'

const NO_FASTING_MARKERS = ['لا يشترط', 'no fasting']

/**
 * Parses the fasting requirement out of a service's preparation note — done ONCE
 * when mapping the service row to a SelectedService, never re-parsed in UI.
 * Ranges take the longest value ("صيام من ٨ إلى ١٢ ساعة" → 12). Notes that
 * explicitly say no fasting is required return null.
 */
export function parseFastingHours(noteAr: string | null, noteEn: string | null): number | null {
  const combined = `${noteAr ?? ''} ${noteEn ?? ''}`.trim()
  if (combined.length === 0) return null

  const normalized = convertArabicDigits(combined).toLowerCase()
  if (NO_FASTING_MARKERS.some((marker) => normalized.includes(marker.toLowerCase()))) return null

  const mentionsFasting =
    normalized.includes('صيام') || normalized.includes('الصيام') || normalized.includes('fast')
  if (!mentionsFasting) return null

  const hourNumbers = [...normalized.matchAll(/\d+/g)].map((match) => Number(match[0]))
  if (hourNumbers.length === 0) return null

  return Math.max(...hourNumbers)
}

function normalizeNoteText(note: string): string {
  return note.replace(/\s+/g, ' ').trim()
}

/**
 * Computes the preparation panel for the CURRENT selection.
 * - Only selected services are considered — no branch-level blanket notes.
 * - Fasting consolidation: longest fast wins; the summary mentions fasting once.
 * - Services sharing the same normalized note are merged into one detail entry.
 * - Empty result (null summaries, no details) means the UI shows nothing.
 */
export function computePreparationNotes(selectedServices: SelectedService[]): PreparationResult {
  const withNotes = selectedServices.filter(
    (service) =>
      service.preparationNotesAr !== null &&
      normalizeNoteText(service.preparationNotesAr).length > 0,
  )

  if (withNotes.length === 0) {
    return {
      summaryAr: null,
      summaryEn: null,
      details: [],
      requiresFasting: false,
      fastingHours: null,
    }
  }

  const detailsByNote = new Map<string, PreparationNote>()
  for (const service of withNotes) {
    const noteAr = normalizeNoteText(service.preparationNotesAr as string)
    const existing = detailsByNote.get(noteAr)
    if (existing) {
      detailsByNote.set(noteAr, {
        ...existing,
        serviceNamesAr: [...existing.serviceNamesAr, service.nameAr],
        serviceNamesEn: [...existing.serviceNamesEn, service.nameEn],
      })
      continue
    }
    detailsByNote.set(noteAr, {
      noteAr,
      noteEn:
        service.preparationNotesEn !== null ? normalizeNoteText(service.preparationNotesEn) : null,
      fastingHours: service.fastingHours,
      serviceNamesAr: [service.nameAr],
      serviceNamesEn: [service.nameEn],
    })
  }

  const fastingDurations = withNotes
    .map((service) => service.fastingHours)
    .filter((hours): hours is number => hours !== null && hours > 0)
  const requiresFasting = fastingDurations.length > 0
  const fastingHours = requiresFasting ? Math.max(...fastingDurations) : null

  return {
    summaryAr: requiresFasting ? PREPARATION_SUMMARY_FASTING_AR : PREPARATION_SUMMARY_PREP_AR,
    summaryEn: requiresFasting ? PREPARATION_SUMMARY_FASTING_EN : PREPARATION_SUMMARY_PREP_EN,
    details: [...detailsByNote.values()],
    requiresFasting,
    fastingHours,
  }
}
