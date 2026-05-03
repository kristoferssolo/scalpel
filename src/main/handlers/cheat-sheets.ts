import { ipcMain, dialog } from 'electron'
import { readFileSync } from 'fs'
import { extname } from 'path'
import { saveSheetBuffer, removeSheetFile, removeCategoryDir, generateSheetId, fetchImageBuffer } from '../cheat-sheets'

const ALLOWED_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif'])

export function register(): void {
  ipcMain.handle(
    'cheat-sheet:add-from-file',
    async (_event, categoryId: string): Promise<Array<{ id: string; ext: string }>> => {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Images', extensions: [...ALLOWED_EXTS] }],
      })
      if (result.canceled) return []
      const added: Array<{ id: string; ext: string }> = []
      for (const filePath of result.filePaths) {
        const raw = extname(filePath).slice(1).toLowerCase()
        const ext = raw === 'jpeg' ? 'jpg' : raw
        if (!ALLOWED_EXTS.has(ext)) continue
        const buffer = readFileSync(filePath)
        const id = generateSheetId()
        saveSheetBuffer(categoryId, id, ext, buffer)
        added.push({ id, ext })
      }
      return added
    },
  )

  ipcMain.handle(
    'cheat-sheet:add-from-url',
    async (_event, categoryId: string, url: string): Promise<{ id: string; ext: string }> => {
      const { buffer, ext } = await fetchImageBuffer(url)
      const id = generateSheetId()
      saveSheetBuffer(categoryId, id, ext, buffer)
      return { id, ext }
    },
  )

  ipcMain.handle('cheat-sheet:remove', (_event, categoryId: string, sheetId: string, ext: string): void => {
    removeSheetFile(categoryId, sheetId, ext)
  })

  ipcMain.handle('cheat-sheet:remove-category', (_event, categoryId: string): void => {
    removeCategoryDir(categoryId)
  })
}
