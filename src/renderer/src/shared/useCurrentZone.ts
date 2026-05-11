import { useEffect, useState } from 'react'

export type Zone = { areaLevel: number; areaCode: string }

/** React subscription to the main-process zone state. Returns null when
 *  PoE isn't running, when no zone event has fired yet, or when the
 *  player is in a town/hideout. */
export function useCurrentZone(): Zone | null {
  const [zone, setZone] = useState<Zone | null>(null)
  useEffect(() => {
    return window.api.onZoneChanged(setZone)
  }, [])
  return zone
}
