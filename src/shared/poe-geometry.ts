/** PoE side-panel (stash/inventory) width as a fraction of the game-window
 *  height. Both PoE1 and PoE2 render the panel at this width and re-center the
 *  playfield by half of it when one side panel opens. Single source of truth for
 *  the snap-ghost mount positions (main process) and the distance-overlay
 *  panel-clip shift (renderer). Measured as 370/600 by PoE Rangefinder; the same
 *  ratio reproduces PoE2's panels in-game. */
export const POE_SIDEBAR_RATIO = 370 / 600
