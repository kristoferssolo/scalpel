import { ipcMain } from 'electron'
import { getManifest } from '../manifest'

export function register(): void {
  ipcMain.handle('get-manifest', () => getManifest())
}
