/** In-process registry of plugin-registered hotkeys. Lives in its own module
 *  so neither app-macros.ts nor handlers/plugins.ts depends on the other -
 *  both depend on this. Map value carries the label for the settings UI row. */
const registeredPluginHotkeys = new Map<string, { label: string }>()

export function setPluginHotkey(pluginId: string, label: string): void {
  registeredPluginHotkeys.set(pluginId, { label })
}

export function getRegisteredPluginHotkeys(): ReadonlyMap<string, { label: string }> {
  return registeredPluginHotkeys
}

export function removePluginHotkey(pluginId: string): void {
  registeredPluginHotkeys.delete(pluginId)
}

/** Registry for plugin overlay-toggle hotkeys. Keyed by plugin id; value
 *  carries the label shown in the Settings > Macros row. */
const registeredOverlayHotkeys = new Map<string, { label: string }>()

export function setPluginOverlayHotkey(pluginId: string, label: string): void {
  registeredOverlayHotkeys.set(pluginId, { label })
}

export function getRegisteredOverlayHotkeys(): ReadonlyMap<string, { label: string }> {
  return registeredOverlayHotkeys
}

export function removePluginOverlayHotkey(pluginId: string): void {
  registeredOverlayHotkeys.delete(pluginId)
}

/** Test-only: clear all in-memory registrations. */
export function _resetForTests(): void {
  registeredPluginHotkeys.clear()
  registeredOverlayHotkeys.clear()
}
