/** Open-state of PoE's side panels, derived by screen-pixel sampling.
 *  right = inventory/stash, left = character sheet / passive tree / vendor. */
export interface PanelState {
  leftPanelOpen: boolean
  rightPanelOpen: boolean
}
