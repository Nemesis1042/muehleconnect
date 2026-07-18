import { app, dialog } from 'electron'
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'
import { getDb } from './db'
import type { BackupInfo, BackupResult } from '../shared/types'

const AUTO_BACKUP_DIR_NAME = 'backups'
const AUTO_BACKUP_PREFIX = 'auto-'
const AUTO_BACKUP_KEEP = 5

function autoBackupDir(): string {
  const dir = join(app.getPath('userData'), AUTO_BACKUP_DIR_NAME)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function listAutoBackups(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.startsWith(AUTO_BACKUP_PREFIX) && f.endsWith('.db'))
    .sort()
}

/**
 * Runs after every sale so at most one sale's worth of data is ever at risk. Uses better-sqlite3's
 * `.backup()` (a safe, consistent snapshot even with WAL mode active) rather than copying the raw
 * file, which could catch a half-written page. Failures are logged, never thrown - a backup problem
 * must not block the till.
 */
export async function runAutoBackup(): Promise<void> {
  try {
    const dir = autoBackupDir()
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    await getDb().backup(join(dir, `${AUTO_BACKUP_PREFIX}${stamp}.db`))

    const files = listAutoBackups(dir)
    while (files.length > AUTO_BACKUP_KEEP) {
      const oldest = files.shift()
      if (oldest) unlinkSync(join(dir, oldest))
    }
  } catch (err) {
    console.error('[Kassensystem] Automatisches Backup fehlgeschlagen:', err)
  }
}

export function getLastAutoBackup(): BackupInfo | null {
  const dir = autoBackupDir()
  const files = listAutoBackups(dir)
  if (files.length === 0) return null
  const path = join(dir, files[files.length - 1])
  return { path, at: statSync(path).mtime.toISOString() }
}

/** Manual, on-demand snapshot to a location the user picks - e.g. a USB stick. */
export async function exportDatabaseToFile(): Promise<BackupResult> {
  const result = await dialog.showSaveDialog({
    title: 'Kassendaten sichern',
    defaultPath: `kassensystem-sicherung-${new Date().toISOString().slice(0, 10)}.db`,
    filters: [{ name: 'SQLite-Datenbank', extensions: ['db'] }]
  })
  if (result.canceled || !result.filePath) return { ok: false, error: 'Abgebrochen' }

  try {
    await getDb().backup(result.filePath)
    return { ok: true, path: result.filePath }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
