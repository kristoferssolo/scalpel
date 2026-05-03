import { app } from 'electron'
import { existsSync, mkdirSync, writeFileSync, unlinkSync, rmSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

function rootDir(): string {
  return join(app.getPath('userData'), 'cheat-sheets')
}

export function categoryDir(categoryId: string): string {
  return join(rootDir(), categoryId)
}

export function sheetFilePath(categoryId: string, sheetId: string, ext: string): string {
  return join(categoryDir(categoryId), `${sheetId}.${ext}`)
}

export function generateSheetId(): string {
  return randomBytes(6).toString('hex')
}

export function generateCategoryId(): string {
  return `cat-${randomBytes(4).toString('hex')}`
}

export function saveSheetBuffer(categoryId: string, sheetId: string, ext: string, data: Buffer): string {
  const dir = categoryDir(categoryId)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const path = sheetFilePath(categoryId, sheetId, ext)
  writeFileSync(path, data)
  return path
}

export function removeSheetFile(categoryId: string, sheetId: string, ext: string): void {
  const path = sheetFilePath(categoryId, sheetId, ext)
  if (existsSync(path)) unlinkSync(path)
}

export function removeCategoryDir(categoryId: string): void {
  const dir = categoryDir(categoryId)
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
}
