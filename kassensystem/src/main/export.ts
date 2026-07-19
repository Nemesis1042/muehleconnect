import { BrowserWindow, dialog } from 'electron'
import { writeFile } from 'fs/promises'
import ExcelJS from 'exceljs'
import { listAllSaleItemsForExport } from './sales'
import type { BackupResult, SaleExportRow } from '../shared/types'

const EXPORT_COLUMNS = [
  'Datum',
  'Uhrzeit',
  'Beleg-Nr.',
  'Artikel',
  'Menge',
  'Einzelpreis (EUR)',
  'Gesamtpreis (EUR)',
  'MwSt.-Klasse',
  'Storniert'
] as const

function toRowValues(row: SaleExportRow): [string, string, number, string, number, number, number, string, string] {
  const created = new Date(row.createdAt)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return [
    `${pad(created.getDate())}.${pad(created.getMonth() + 1)}.${created.getFullYear()}`,
    `${pad(created.getHours())}:${pad(created.getMinutes())}`,
    row.receiptNumber,
    row.productName,
    row.quantity,
    row.priceCents / 100,
    row.totalCents / 100,
    row.taxClass,
    row.voided ? 'Ja' : 'Nein'
  ]
}

function defaultExportName(extension: string): string {
  return `kassensystem-verkaeufe-${new Date().toISOString().slice(0, 10)}.${extension}`
}

/**
 * German Excel/LibreOffice expects ';' as the CSV field separator by default (',' is the decimal
 * separator in the de-DE locale), and a quoted field needs its own '"' doubled - the two escaping
 * rules a naive join('\n') would get wrong.
 */
function csvEscape(value: string | number): string {
  const text = String(value)
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export async function exportSalesToCsv(): Promise<BackupResult> {
  const result = await dialog.showSaveDialog({
    title: 'Verkaufsdaten als CSV exportieren',
    defaultPath: defaultExportName('csv'),
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  })
  if (result.canceled || !result.filePath) return { ok: false, error: 'Abgebrochen' }

  try {
    const rows = listAllSaleItemsForExport()
    const lines = [EXPORT_COLUMNS.join(';')]
    for (const row of rows) {
      lines.push(toRowValues(row).map(csvEscape).join(';'))
    }
    // BOM, damit Excel eine UTF-8-CSV-Datei mit Umlauten korrekt erkennt statt sie kaputt zu lesen.
    await writeFile(result.filePath, '﻿' + lines.join('\n'), 'utf-8')
    return { ok: true, path: result.filePath }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function exportSalesToExcel(): Promise<BackupResult> {
  const result = await dialog.showSaveDialog({
    title: 'Verkaufsdaten als Excel exportieren',
    defaultPath: defaultExportName('xlsx'),
    filters: [{ name: 'Excel-Arbeitsmappe', extensions: ['xlsx'] }]
  })
  if (result.canceled || !result.filePath) return { ok: false, error: 'Abgebrochen' }

  try {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Verkäufe')
    sheet.columns = EXPORT_COLUMNS.map((header) => ({ header, key: header, width: 18 }))
    sheet.getRow(1).font = { bold: true }
    for (const row of listAllSaleItemsForExport()) {
      sheet.addRow(toRowValues(row))
    }
    await workbook.xlsx.writeFile(result.filePath)
    return { ok: true, path: result.filePath }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)
}

function buildExportHtml(rows: SaleExportRow[]): string {
  const headerCells = EXPORT_COLUMNS.map((c) => `<th>${escapeHtml(c)}</th>`).join('')
  const bodyRows = rows
    .map((row) => `<tr>${toRowValues(row).map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`)
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: sans-serif; font-size: 10px; }
    h1 { font-size: 14px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #999; padding: 3px 6px; text-align: left; }
    th { background: #eee; }
  </style></head><body>
    <h1>Kassensystem - Verkaufsdaten-Export</h1>
    <p>Erstellt am ${new Date().toLocaleString('de-DE')}</p>
    <table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
  </body></html>`
}

/** Renders the same data as a plain HTML table in a hidden window and uses Electron's built-in
 * printToPDF - no separate PDF library needed, and it stays visually consistent with the export's
 * CSV/Excel column layout. */
export async function exportSalesToPdf(): Promise<BackupResult> {
  const result = await dialog.showSaveDialog({
    title: 'Verkaufsdaten als PDF exportieren',
    defaultPath: defaultExportName('pdf'),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (result.canceled || !result.filePath) return { ok: false, error: 'Abgebrochen' }

  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  try {
    const html = buildExportHtml(listAllSaleItemsForExport())
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const pdf = await win.webContents.printToPDF({ landscape: true, printBackground: true })
    await writeFile(result.filePath, pdf)
    return { ok: true, path: result.filePath }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    win.close()
  }
}
