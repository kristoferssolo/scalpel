/** Dynamic-import a plugin's entry module. Honors a `window.__pluginImport`
 *  test hook so unit tests can swap in a fake importer; otherwise uses native
 *  dynamic import. Shared by the main overlay's PluginHost and each plugin's
 *  overlay window. */
export function importPluginModule(entryUrl: string): Promise<unknown> {
  const w = window as unknown as { __pluginImport?: (u: string) => Promise<unknown> }
  if (w.__pluginImport) return w.__pluginImport(entryUrl)
  return import(/* @vite-ignore */ entryUrl)
}
