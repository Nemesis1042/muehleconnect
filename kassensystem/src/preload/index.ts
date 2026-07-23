import { contextBridge, ipcRenderer } from 'electron'
import type {
  CreateSaleInput,
  KassenApi,
  PrintSaleOptions,
  ProductInput,
  Settings
} from '../shared/types'

const api: KassenApi = {
  products: {
    list: () => ipcRenderer.invoke('products:list'),
    getPfand: () => ipcRenderer.invoke('products:getPfand'),
    create: (input: ProductInput) => ipcRenderer.invoke('products:create', input),
    update: (id: number, input: Partial<ProductInput>) =>
      ipcRenderer.invoke('products:update', id, input),
    remove: (id: number) => ipcRenderer.invoke('products:remove', id),
    reorder: (orderedIds: number[]) => ipcRenderer.invoke('products:reorder', orderedIds)
  },
  sale: {
    create: (input: CreateSaleInput, printOptions?: PrintSaleOptions) =>
      ipcRenderer.invoke('sale:create', input, printOptions),
    reprint: (saleId: number, options?: PrintSaleOptions) =>
      ipcRenderer.invoke('sale:reprint', saleId, options),
    void: (saleId: number) => ipcRenderer.invoke('sale:void', saleId)
  },
  printer: {
    listDevices: () => ipcRenderer.invoke('printer:listDevices'),
    listSerialPorts: () => ipcRenderer.invoke('printer:listSerialPorts'),
    testPrint: () => ipcRenderer.invoke('printer:testPrint'),
    probeBaudRate: (path: string) => ipcRenderer.invoke('printer:probeBaudRate', path),
    printBaudTestSlips: (path: string) => ipcRenderer.invoke('printer:printBaudTestSlips', path)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (input: Partial<Settings>) => ipcRenderer.invoke('settings:update', input)
  },
  journal: {
    get: (from: string, to: string) => ipcRenderer.invoke('journal:get', from, to),
    print: (from: string, to: string) => ipcRenderer.invoke('journal:print', from, to)
  },
  backup: {
    exportToFile: () => ipcRenderer.invoke('backup:exportToFile'),
    restoreFromFile: () => ipcRenderer.invoke('backup:restoreFromFile'),
    getLastAuto: () => ipcRenderer.invoke('backup:getLastAuto'),
    exportCsv: () => ipcRenderer.invoke('backup:exportCsv'),
    exportExcel: () => ipcRenderer.invoke('backup:exportExcel'),
    exportPdf: () => ipcRenderer.invoke('backup:exportPdf')
  }
}

contextBridge.exposeInMainWorld('kassen', api)
