import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join as pathJoin } from 'path'

const MOCK_USER_DATA = pathJoin(tmpdir(), 'scalpel-test')

vi.mock('electron', () => ({ app: { getPath: vi.fn(() => MOCK_USER_DATA) } }))

import { app } from 'electron'

describe('cheat-sheet storage paths', () => {
  it('builds the per-category subdir under userData', async () => {
    const { categoryDir } = await import('./cheat-sheets')
    expect(categoryDir('cat-abc')).toBe(pathJoin(MOCK_USER_DATA, 'cheat-sheets', 'cat-abc'))
  })

  it('builds the per-sheet file path with extension', async () => {
    const { sheetFilePath } = await import('./cheat-sheets')
    expect(sheetFilePath('cat-abc', 'sheet-xyz', 'png')).toBe(
      pathJoin(MOCK_USER_DATA, 'cheat-sheets', 'cat-abc', 'sheet-xyz.png'),
    )
  })

  it('generates a unique sheet id', async () => {
    const { generateSheetId } = await import('./cheat-sheets')
    const a = generateSheetId()
    const b = generateSheetId()
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[a-z0-9]+$/)
  })
})

describe('cheat-sheet file IO', () => {
  let testRoot: string
  beforeEach(() => {
    testRoot = mkdtempSync(pathJoin(tmpdir(), 'cs-'))
    vi.mocked(app.getPath).mockReturnValue(testRoot)
  })

  it('saveSheetBuffer writes the file and creates the category dir', async () => {
    const { saveSheetBuffer } = await import('./cheat-sheets')
    const data = Buffer.from('fake png bytes')
    const path = saveSheetBuffer('cat-1', 'sheet-1', 'png', data)
    expect(existsSync(path)).toBe(true)
    expect(readFileSync(path)).toEqual(data)
    rmSync(testRoot, { recursive: true, force: true })
  })

  it('removeSheetFile deletes the file and is idempotent', async () => {
    const { saveSheetBuffer, removeSheetFile } = await import('./cheat-sheets')
    const path = saveSheetBuffer('cat-1', 'sheet-1', 'png', Buffer.from('x'))
    removeSheetFile('cat-1', 'sheet-1', 'png')
    expect(existsSync(path)).toBe(false)
    removeSheetFile('cat-1', 'sheet-1', 'png')
    rmSync(testRoot, { recursive: true, force: true })
  })
})
