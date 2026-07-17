import { contextBridge, ipcRenderer } from 'electron'
import type {
  CreateSaleInput,
  KassenApi,
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
    create: (input: CreateSaleInput) => ipcRenderer.invoke('sale:create', input),
    reprint: (saleId: number) => ipcRenderer.invoke('sale:reprint', saleId)
  },
  printer: {
    listDevices: () => ipcRenderer.invoke('printer:listDevices'),
    testPrint: () => ipcRenderer.invoke('printer:testPrint')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (input: Partial<Settings>) => ipcRenderer.invoke('settings:update', input)
  },
  journal: {
    get: (from: string, to: string) => ipcRenderer.invoke('journal:get', from, to),
    print: (from: string, to: string) => ipcRenderer.invoke('journal:print', from, to)
  }
}

contextBridge.exposeInMainWorld('kassen', api)
