import { ipcMain } from 'electron'
import { getManifest } from '../manifest/index'

export function register(): void {
  ipcMain.handle('get-manifest', () => getManifest())
}
