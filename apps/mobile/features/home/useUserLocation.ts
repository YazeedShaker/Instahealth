import type { LatLng } from '@instahealth/core'
import * as Location from 'expo-location'
import { useCallback, useEffect, useState } from 'react'

import type { UserLocation } from './types'

// Soft-ask flow (spec F02 §C1): explain why → request → on grant use coords for
// distance sorting; on deny default to Cairo center + name sort. NEVER block Home.
const CAIRO_CENTER: LatLng = { lat: 30.0444, lng: 31.2357 }
const DEFAULT_AREA_LABEL = 'القاهرة'

export type LocationPermissionState = 'checking' | 'prompt' | 'granted' | 'denied'

interface UseUserLocationResult {
  permission: LocationPermissionState
  location: UserLocation
  requestLocation: () => Promise<void>
  dismissPrompt: () => void
}

async function readCurrentLocation(): Promise<UserLocation> {
  try {
    const position =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))
    const coords: LatLng = { lat: position.coords.latitude, lng: position.coords.longitude }

    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: coords.lat,
        longitude: coords.lng,
      })
      const city = place?.city ?? place?.region ?? DEFAULT_AREA_LABEL
      const area = place?.district ?? place?.subregion ?? null
      return { coords, areaLabel: area ? `${city} — ${area}` : city }
    } catch {
      return { coords, areaLabel: DEFAULT_AREA_LABEL }
    }
  } catch {
    return { coords: null, areaLabel: DEFAULT_AREA_LABEL }
  }
}

export function useUserLocation(): UseUserLocationResult {
  const [permission, setPermission] = useState<LocationPermissionState>('checking')
  const [location, setLocation] = useState<UserLocation>({
    coords: null,
    areaLabel: DEFAULT_AREA_LABEL,
  })

  useEffect(() => {
    let isMounted = true
    Location.getForegroundPermissionsAsync()
      .then(async (status) => {
        if (!isMounted) return
        if (status.granted) {
          setPermission('granted')
          const current = await readCurrentLocation()
          if (isMounted) setLocation(current)
          return
        }
        setPermission(status.canAskAgain ? 'prompt' : 'denied')
      })
      .catch(() => {
        if (isMounted) setPermission('denied')
      })
    return () => {
      isMounted = false
    }
  }, [])

  const requestLocation = useCallback(async () => {
    try {
      const status = await Location.requestForegroundPermissionsAsync()
      if (!status.granted) {
        setPermission('denied')
        return
      }
      setPermission('granted')
      setLocation(await readCurrentLocation())
    } catch {
      setPermission('denied')
    }
  }, [])

  const dismissPrompt = useCallback(() => setPermission('denied'), [])

  return {
    permission,
    location: location.coords ? location : { coords: null, areaLabel: location.areaLabel },
    requestLocation,
    dismissPrompt,
  }
}

export { CAIRO_CENTER }
