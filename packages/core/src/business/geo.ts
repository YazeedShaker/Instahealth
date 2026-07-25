// Geographic helpers — distance math + Arabic display formatting.

import { toArabicDigits } from './format'

export interface LatLng {
  lat: number
  lng: number
}

const EARTH_RADIUS_KM = 6371
const TEN_KM = 10

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/** Great-circle (Haversine) distance in kilometers. */
export function computeDistanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const sinHalfLat = Math.sin(dLat / 2)
  const sinHalfLng = Math.sin(dLng / 2)
  const h =
    sinHalfLat * sinHalfLat +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinHalfLng * sinHalfLng
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/** "١٫٢ كم" — Arabic-Indic numerals, one decimal under 10km, whole numbers above. */
export function formatDistanceAr(km: number): string {
  const clamped = km < 0 ? 0 : km
  if (clamped < TEN_KM) {
    const oneDecimal = (Math.round(clamped * 10) / 10).toFixed(1).replace('.', '٫')
    return `${toArabicDigits(oneDecimal)} كم`
  }
  return `${toArabicDigits(String(Math.round(clamped)))} كم`
}
