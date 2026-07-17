import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer'
import { usb } from 'usb'
import { taxBreakdown } from '../shared/cart'
import type {
  JournalReport,
  PrintJobItem,
  PrintResult,
  SaleRecord,
  Settings,
  UsbDeviceInfo
} from '../shared/types'

// The 'usb' package's .d.ts doesn't reliably surface the full WebUSB device shape (e.g.
// `transferOut`) through its public export, so we declare the slice we actually use ourselves;
// the underlying native objects support the full WebUSB spec regardless of what TS infers here.
interface UsbEndpointHandle {
  endpointNumber: number
  direction: 'in' | 'out'
}
interface UsbInterfaceHandle {
  interfaceNumber: number
  alternate: { interfaceClass: number; endpoints: UsbEndpointHandle[] }
}
interface UsbConfigurationHandle {
  configurationValue: number
  interfaces: UsbInterfaceHandle[]
}
interface UsbDeviceHandle {
  vendorId: number
  productId: number
  manufacturerName: string | null
  productName: string | null
  configuration: UsbConfigurationHandle | null
  configurations: UsbConfigurationHandle[]
  open(): Promise<void>
  close(): Promise<void>
  selectConfiguration(configurationValue: number): Promise<void>
  claimInterface(interfaceNumber: number): Promise<void>
  releaseInterface(interfaceNumber: number): Promise<void>
  detachKernelDriver?(interfaceNumber: number): Promise<void>
  transferOut(endpointNumber: number, data: Buffer): Promise<{ status: string; bytesWritten: number }>
}

async function getUsbDevices(): Promise<UsbDeviceHandle[]> {
  return (await usb.getDevices()) as unknown as UsbDeviceHandle[]
}

// USB Printer Class (see USB.org base class definitions), used to auto-detect receipt printers.
const USB_PRINTER_CLASS = 7
// 48 columns fits a common 80mm ESC/POS receipt printer at Font A.
const PRINTER_WIDTH = 48

function toHex(n: number): string {
  return '0x' + n.toString(16).padStart(4, '0')
}

function formatEuro(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €'
}

function formatDateTime(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Talks directly to a USB ESC/POS receipt printer via bulk transfer (WebUSB-style `usb` package),
 * bypassing the OS print spooler entirely. Satisfies node-thermal-printer's Interface contract
 * (its runtime accepts an object here even though its .d.ts only types `interface` as `string`).
 */
class UsbEscposInterface {
  constructor(
    private readonly vendorId: number,
    private readonly productId: number
  ) {}

  getPrinterName(): string {
    return `USB ${toHex(this.vendorId)}:${toHex(this.productId)}`
  }

  async isPrinterConnected(): Promise<boolean> {
    const devices = await getUsbDevices()
    return devices.some((d) => d.vendorId === this.vendorId && d.productId === this.productId)
  }

  async execute(buffer: Buffer): Promise<string> {
    const devices = await getUsbDevices()
    const device = devices.find((d) => d.vendorId === this.vendorId && d.productId === this.productId)
    if (!device) {
      throw new Error(
        `USB-Bondrucker (VID ${toHex(this.vendorId)} / PID ${toHex(this.productId)}) nicht gefunden`
      )
    }

    await device.open()
    try {
      const config = device.configuration ?? device.configurations[0]
      if (!config) throw new Error('Keine USB-Konfiguration am Drucker gefunden')
      if (device.configuration?.configurationValue !== config.configurationValue) {
        await device.selectConfiguration(config.configurationValue)
      }

      const printerIface =
        config.interfaces.find((i) => i.alternate.interfaceClass === USB_PRINTER_CLASS) ??
        config.interfaces[0]
      if (!printerIface) throw new Error('Keine USB-Schnittstelle am Drucker gefunden')

      try {
        await device.claimInterface(printerIface.interfaceNumber)
      } catch (err) {
        if (typeof device.detachKernelDriver === 'function') {
          await device.detachKernelDriver(printerIface.interfaceNumber)
          await device.claimInterface(printerIface.interfaceNumber)
        } else {
          throw err
        }
      }

      try {
        const outEndpoint = printerIface.alternate.endpoints.find((e) => e.direction === 'out')
        if (!outEndpoint) throw new Error('Kein OUT-Endpoint am Drucker gefunden')
        await device.transferOut(outEndpoint.endpointNumber, buffer)
        return 'ok'
      } finally {
        try {
          await device.releaseInterface(printerIface.interfaceNumber)
        } catch {
          /* Gerät ggf. schon getrennt – ignorieren */
        }
      }
    } finally {
      try {
        await device.close()
      } catch {
        /* Gerät ggf. schon getrennt – ignorieren */
      }
    }
  }
}

/** Used when no printer is configured yet, so the app stays fully usable/testable without hardware. */
class DryRunInterface {
  getPrinterName(): string {
    return 'Dry-Run (kein Drucker konfiguriert)'
  }
  async isPrinterConnected(): Promise<boolean> {
    return false
  }
  async execute(): Promise<string> {
    return 'dry-run'
  }
}

interface PrinterSession {
  printer: ThermalPrinter
  dryRun: boolean
}

function createPrinterSession(settings: Settings): PrinterSession {
  const vendorId = settings.printerVendorId ? parseInt(settings.printerVendorId, 16) : NaN
  const productId = settings.printerProductId ? parseInt(settings.printerProductId, 16) : NaN
  const dryRun = !(Number.isFinite(vendorId) && Number.isFinite(productId))
  const iface = dryRun ? new DryRunInterface() : new UsbEscposInterface(vendorId, productId)

  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    // node-thermal-printer's runtime accepts an Interface object; its .d.ts just doesn't model that.
    interface: iface as unknown as string,
    width: PRINTER_WIDTH,
    removeSpecialCharacters: false,
    characterSet: CharacterSet.PC850_MULTILINGUAL
  })

  return { printer, dryRun }
}

async function runJob(session: PrinterSession, kind: PrintJobItem['kind']): Promise<PrintJobItem> {
  const preview = session.printer.getText()
  if (session.dryRun) {
    console.log(`[Kassensystem][Dry-Run][${kind}]\n${preview}`)
  }
  try {
    await session.printer.execute()
    return { kind, ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Kassensystem] Druckfehler (${kind}): ${message}\nVorschau:\n${preview}`)
    return { kind, ok: false, error: message }
  }
}

function fillVoucher(
  printer: ThermalPrinter,
  settings: Settings,
  productName: string,
  priceCents: number,
  voucherNumber: number
): void {
  printer.alignCenter()
  printer.bold(true)
  printer.setTextDoubleHeight()
  printer.println(settings.titleLine1)
  if (settings.titleLine2) printer.println(settings.titleLine2)
  printer.setTextNormal()
  printer.bold(false)
  printer.newLine()
  printer.setTextDoubleHeight()
  printer.bold(true)
  printer.println(productName)
  printer.setTextNormal()
  printer.bold(false)
  printer.println(formatEuro(priceCents))
  printer.newLine()
  printer.alignLeft()
  printer.println(formatDateTime(new Date()))
  printer.println(`Kasse ${settings.registerNumber} - No. ${voucherNumber}`)
  printer.partialCut()
}

function fillReceipt(printer: ThermalPrinter, settings: Settings, sale: SaleRecord): void {
  printer.alignCenter()
  printer.bold(true)
  printer.println(settings.titleLine1)
  if (settings.titleLine2) printer.println(settings.titleLine2)
  printer.bold(false)
  printer.newLine()
  printer.println(settings.orgName)
  printer.println(settings.orgStreet)
  printer.println(settings.orgZipCity)
  if (settings.orgTaxId) printer.println(`St.-Id. ${settings.orgTaxId}`)
  printer.newLine()
  printer.alignLeft()
  printer.drawLine()

  for (const item of sale.items) {
    printer.println(`${item.quantity} x ${item.productName}`)
    printer.leftRight(
      `  ${formatEuro(item.priceCents)} =`,
      `${formatEuro(item.priceCents * item.quantity)} ${item.taxClass}`
    )
  }

  printer.drawLine()
  printer.bold(true)
  printer.leftRight('Summe:', formatEuro(sale.totalCents))
  printer.bold(false)
  printer.newLine()

  const breakdown = taxBreakdown(
    sale.items.map((i) => ({ taxClass: i.taxClass, grossCents: i.priceCents * i.quantity })),
    { A: settings.taxRateA, B: settings.taxRateB }
  )
  printTaxBreakdown(printer, breakdown)

  printer.newLine()
  printer.println(formatDateTime(new Date(sale.createdAt)))
  printer.println(`Kasse ${settings.registerNumber} - No. ${sale.receiptNumber}`)
  printer.cut()
}

function printTaxBreakdown(
  printer: ThermalPrinter,
  breakdown: ReturnType<typeof taxBreakdown>
): void {
  printer.println('MwSt   Netto     MwSt      Brutto')
  for (const b of breakdown) {
    printer.println(
      `${b.taxClass} ${b.ratePercent}%  ${formatEuro(b.netCents)}   ${formatEuro(b.taxCents)}   ${formatEuro(b.grossCents)}`
    )
  }
}

function fillJournal(printer: ThermalPrinter, report: JournalReport): void {
  printer.alignCenter()
  printer.bold(true)
  printer.println('Kassen-Journal')
  printer.bold(false)
  printer.println(`${report.from} - ${report.to}`)
  printer.newLine()
  printer.alignLeft()
  printer.drawLine()

  for (const e of report.entries) {
    printer.println(`${e.quantity} x ${e.productName}`)
    printer.leftRight(`  ${formatEuro(e.priceCents)} =`, `${formatEuro(e.totalCents)} ${e.taxClass}`)
  }

  printer.drawLine()
  printer.bold(true)
  printer.leftRight('Gesamtsumme:', formatEuro(report.totalCents))
  printer.bold(false)
  printer.newLine()
  printTaxBreakdown(printer, report.taxBreakdown)
  printer.cut()
}

export async function listUsbPrinterDevices(): Promise<UsbDeviceInfo[]> {
  const devices = await getUsbDevices()
  const result: UsbDeviceInfo[] = []

  for (const device of devices) {
    try {
      const isPrinter = device.configurations.some((cfg) =>
        cfg.interfaces.some((i) => i.alternate.interfaceClass === USB_PRINTER_CLASS)
      )
      if (!isPrinter) continue

      let manufacturer = device.manufacturerName ?? undefined
      let product = device.productName ?? undefined
      if (manufacturer === undefined && product === undefined) {
        await withOpenDevice(device, () => {
          manufacturer = device.manufacturerName ?? undefined
          product = device.productName ?? undefined
        })
      }

      result.push({
        vendorId: device.vendorId,
        productId: device.productId,
        vendorIdHex: toHex(device.vendorId),
        productIdHex: toHex(device.productId),
        manufacturer,
        product
      })
    } catch {
      // Gerät nicht lesbar (z.B. fehlende Berechtigung) – überspringen
    }
  }

  return result
}

async function withOpenDevice(device: UsbDeviceHandle, fn: () => void): Promise<void> {
  await device.open()
  try {
    fn()
  } finally {
    await device.close()
  }
}

export async function printTestPage(settings: Settings): Promise<PrintResult> {
  const session = createPrinterSession(settings)
  session.printer.alignCenter()
  session.printer.bold(true)
  session.printer.println('Testdruck')
  session.printer.bold(false)
  session.printer.println(settings.titleLine1)
  session.printer.newLine()
  session.printer.println(formatDateTime(new Date()))
  session.printer.cut()
  const job = await runJob(session, 'receipt')
  return { ok: job.ok, jobs: [job] }
}

export async function printSale(
  sale: SaleRecord,
  settings: Settings,
  options: { printReceipt?: boolean } = {}
): Promise<PrintResult> {
  const jobs: PrintJobItem[] = []

  if (options.printReceipt !== false) {
    const receiptSession = createPrinterSession(settings)
    fillReceipt(receiptSession.printer, settings, sale)
    jobs.push(await runJob(receiptSession, 'receipt'))
  }

  for (const item of sale.items) {
    for (let i = 0; i < item.quantity; i++) {
      const voucherNumber = item.voucherNumberStart + i
      const voucherSession = createPrinterSession(settings)
      fillVoucher(voucherSession.printer, settings, item.productName, item.priceCents, voucherNumber)
      jobs.push(await runJob(voucherSession, 'voucher'))
    }
  }

  return { ok: jobs.every((j) => j.ok), jobs }
}

export async function printJournalReport(
  report: JournalReport,
  settings: Settings
): Promise<PrintResult> {
  const session = createPrinterSession(settings)
  fillJournal(session.printer, report)
  const job = await runJob(session, 'journal')
  return { ok: job.ok, jobs: [job] }
}
