import { getDb } from './db'
import type { PrinterConnection, Settings } from '../shared/types'

export function getSettings(): Settings {
  const rows = getDb().prepare('SELECT key, value FROM settings').all() as Array<{
    key: string
    value: string
  }>
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  return {
    titleLine1: map.titleLine1 ?? '',
    titleLine2: map.titleLine2 ?? '',
    orgName: map.orgName ?? '',
    orgStreet: map.orgStreet ?? '',
    orgZipCity: map.orgZipCity ?? '',
    orgTaxId: map.orgTaxId ?? '',
    registerNumber: Number(map.registerNumber ?? 1),
    taxRateA: Number(map.taxRateA ?? 7),
    taxRateB: Number(map.taxRateB ?? 19),
    printerConnection: (map.printerConnection ?? '') as PrinterConnection,
    printerVendorId: map.printerVendorId ?? '',
    printerProductId: map.printerProductId ?? '',
    printerSerialPath: map.printerSerialPath ?? '',
    printerSerialBaudRate: Number(map.printerSerialBaudRate ?? 19200),
    printerSerialBaudConfirmed: map.printerSerialBaudConfirmed === 'true'
  }
}

export function updateSettings(input: Partial<Settings>): Settings {
  const db = getDb()
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  const tx = db.transaction(() => {
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue
      upsert.run(key, String(value))
    }
  })
  tx()
  return getSettings()
}
