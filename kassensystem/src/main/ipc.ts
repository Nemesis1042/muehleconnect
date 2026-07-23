import { ipcMain } from 'electron'
import {
  createProduct,
  getPfandProduct,
  listProducts,
  removeProduct,
  reorderProducts,
  updateProduct
} from './products'
import { createSale, getSale, voidSale } from './sales'
import { getSettings, updateSettings } from './settings'
import { getJournal } from './journal'
import {
  listSerialPorts,
  listUsbPrinterDevices,
  printBaudTestSlips,
  printJournalReport,
  printSale,
  printTestPage,
  probeSerialBaudRate
} from './printer'
import { exportDatabaseToFile, getLastAutoBackup, runAutoBackup } from './backup'
import { exportSalesToCsv, exportSalesToExcel, exportSalesToPdf } from './export'
import type { CreateSaleInput, PrintSaleOptions, ProductInput } from '../shared/types'

export function registerIpcHandlers(): void {
  ipcMain.handle('products:list', () => listProducts())
  ipcMain.handle('products:getPfand', () => getPfandProduct())
  ipcMain.handle('products:create', (_e, input: ProductInput) => createProduct(input))
  ipcMain.handle('products:update', (_e, id: number, input: Partial<ProductInput>) =>
    updateProduct(id, input)
  )
  ipcMain.handle('products:remove', (_e, id: number) => removeProduct(id))
  ipcMain.handle('products:reorder', (_e, orderedIds: number[]) => reorderProducts(orderedIds))

  ipcMain.handle(
    'sale:create',
    async (_e, input: CreateSaleInput, printOptions?: PrintSaleOptions) => {
      const sale = createSale(input)
      const printResult = await printSale(sale, getSettings(), printOptions)
      void runAutoBackup()
      return { sale, printResult }
    }
  )
  ipcMain.handle('sale:reprint', async (_e, saleId: number, options?: PrintSaleOptions) => {
    const sale = getSale(saleId)
    return printSale(sale, getSettings(), options)
  })
  ipcMain.handle('sale:void', (_e, saleId: number) => voidSale(saleId))

  ipcMain.handle('printer:listDevices', () => listUsbPrinterDevices())
  ipcMain.handle('printer:listSerialPorts', () => listSerialPorts())
  ipcMain.handle('printer:testPrint', () => printTestPage(getSettings()))
  ipcMain.handle('printer:probeBaudRate', (_e, path: string) => probeSerialBaudRate(path))
  ipcMain.handle('printer:printBaudTestSlips', (_e, path: string) =>
    printBaudTestSlips(path, getSettings())
  )

  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:update', (_e, input) => updateSettings(input))

  ipcMain.handle('journal:get', (_e, from: string, to: string) => getJournal(from, to))
  ipcMain.handle('journal:print', async (_e, from: string, to: string) => {
    const report = getJournal(from, to)
    return printJournalReport(report, getSettings())
  })

  ipcMain.handle('backup:exportToFile', () => exportDatabaseToFile())
  ipcMain.handle('backup:getLastAuto', () => getLastAutoBackup())
  ipcMain.handle('backup:exportCsv', () => exportSalesToCsv())
  ipcMain.handle('backup:exportExcel', () => exportSalesToExcel())
  ipcMain.handle('backup:exportPdf', () => exportSalesToPdf())
}
