import { EventEmitter } from 'node:events'
import { getPoeVersion } from '../game-state'
import { isTownOrHideout } from './is-town-or-hideout'

export type Zone = { areaLevel: number; areaCode: string }

let currentZone: Zone | null = null
const emitter = new EventEmitter()

/** Latest known real (non-town, non-hideout) zone. Null at startup and
 *  whenever the player enters a town or hideout. */
export function getCurrentZone(): Zone | null {
  return currentZone
}

/** Subscribe to zone-state changes. Fires with the new value on every
 *  ingest, including null when entering a town/hideout. Returns an
 *  unsubscribe function. */
export function onZoneChanged(cb: (zone: Zone | null) => void): () => void {
  emitter.on('change', cb)
  return () => emitter.off('change', cb)
}

/** Watcher-facing entry point. Called once per parsed Client.txt
 *  "Generating level ..." line. Filters towns and hideouts to null;
 *  stores and broadcasts real zones unchanged. */
export function ingestZoneEvent(parsed: Zone): void {
  if (isTownOrHideout(parsed.areaCode, getPoeVersion())) {
    currentZone = null
  } else {
    currentZone = parsed
  }
  emitter.emit('change', currentZone)
}

/** Vitest-only: clear singleton state + subscribers between cases. */
export function _resetForTests(): void {
  currentZone = null
  emitter.removeAllListeners()
}
