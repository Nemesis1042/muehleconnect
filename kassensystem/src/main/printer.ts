import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer'
import { usb } from 'usb'
import { SerialPort } from 'serialport'
import { taxBreakdown } from '../shared/cart'
import type {
  BaudGuidedTestResult,
  BaudProbeResult,
  BaudTestSlipAttempt,
  JournalReport,
  PrintJobItem,
  PrintResult,
  SaleRecord,
  SerialPortInfo,
  Settings,
  UsbDeviceInfo
} from '../shared/types'
import { BAUD_RATE_CANDIDATES, STATUS_QUERY_BYTES, isPlausibleStatusResponse } from '../shared/serialProbe'

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
// 48 columns is the common 80mm ESC/POS default, but the real hardware in use physically wraps
// at 44 - confirmed by reproducing an observed receipt's exact wrap points ("2,50 E" / "UR A")
// against both widths in isolation. leftRight() pads to fill the *configured* width with no
// wrap-awareness of its own, so a too-wide config reliably overflows onto a stray extra line.
const PRINTER_WIDTH = 44

function toHex(n: number): string {
  return '0x' + n.toString(16).padStart(4, '0')
}

// Plain ASCII "EUR" instead of "€": switching the printer's codepage from PC850 to PC858 (which is
// supposed to add a € glyph) still printed garbage on the real hardware - this printer's firmware
// clearly doesn't implement the codepage table node-thermal-printer assumes. ASCII sidesteps the
// whole class of codepage/font-table mismatches, on this printer and any other.
function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function formatEuro(cents: number): string {
  return `${formatAmount(cents)} Euro`
}

function formatDateTime(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDate(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
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

/**
 * Talks to a serial ESC/POS receipt printer (typically connected via a USB-to-serial adapter,
 * e.g. an FTDI chip showing up as /dev/ttyUSB0 on Linux or COMx on Windows) - a different
 * transport entirely from `UsbEscposInterface`, but the same 3-method Interface contract.
 * Data bits/parity/stop bits are hardcoded to 8/none/1, which covers the near-universal ESC/POS
 * serial default; only the baud rate varies enough in practice to be worth exposing in Settings.
 */
// Some USB-to-serial adapters (e.g. FTDI) toggle DTR/RTS the moment the port opens, which many
// thermal printers read as a reset pulse - bytes written immediately after open can arrive while
// the printer is still settling and come out corrupted, even though the rest of the job prints
// fine right after. This delay gives the printer time to finish settling before we send anything.
const SERIAL_OPEN_SETTLE_MS = 300

class SerialEscposInterface {
  constructor(
    private readonly path: string,
    private readonly baudRate: number
  ) {}

  getPrinterName(): string {
    return `Seriell ${this.path} @ ${this.baudRate} Baud`
  }

  async isPrinterConnected(): Promise<boolean> {
    const ports = await SerialPort.list()
    return ports.some((p) => p.path === this.path)
  }

  async execute(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const port = new SerialPort(
        {
          path: this.path,
          baudRate: this.baudRate,
          dataBits: 8,
          parity: 'none',
          stopBits: 1
        },
        (openErr) => {
          if (openErr) reject(openErr)
        }
      )

      port.once('error', reject)

      port.once('open', () => {
        setTimeout(() => {
          port.write(buffer, (writeErr) => {
            if (writeErr) {
              reject(writeErr)
              return
            }
            port.drain((drainErr) => {
              port.close()
              if (drainErr) reject(drainErr)
              else resolve('ok')
            })
          })
        }, SERIAL_OPEN_SETTLE_MS)
      })
    })
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

function buildInterface(
  settings: Settings
): UsbEscposInterface | SerialEscposInterface | DryRunInterface {
  if (settings.printerConnection === 'usb') {
    const vendorId = parseInt(settings.printerVendorId, 16)
    const productId = parseInt(settings.printerProductId, 16)
    if (Number.isFinite(vendorId) && Number.isFinite(productId)) {
      return new UsbEscposInterface(vendorId, productId)
    }
  }

  if (settings.printerConnection === 'serial') {
    if (settings.printerSerialPath && Number.isFinite(settings.printerSerialBaudRate)) {
      return new SerialEscposInterface(settings.printerSerialPath, settings.printerSerialBaudRate)
    }
  }

  return new DryRunInterface()
}

function buildThermalPrinter(
  iface: UsbEscposInterface | SerialEscposInterface | DryRunInterface
): ThermalPrinter {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    // node-thermal-printer's runtime accepts an Interface object; its .d.ts just doesn't model that.
    interface: iface as unknown as string,
    width: PRINTER_WIDTH,
    removeSpecialCharacters: false,
    // German umlauts (ü/ö/ä) print correctly under this codepage on the real hardware; the € glyph
    // never did (confirmed under both PC850 and PC858), so printed prices use ASCII "EUR" instead
    // and don't depend on this codepage's currency support at all.
    characterSet: CharacterSet.PC850_MULTILINGUAL
  })
}

function createPrinterSession(settings: Settings): PrinterSession {
  const iface = buildInterface(settings)
  return { printer: buildThermalPrinter(iface), dryRun: iface instanceof DryRunInterface }
}

/**
 * Turns a raw libusb/WebUSB/serial-port error into an actionable message, since
 * "LIBUSB_ERROR_ACCESS" or "Error: Opening COM3: Access denied" means nothing to whoever is
 * standing at the till. The exact wording of these errors isn't standardized across platforms
 * or transports, so this matches loosely on well-known substrings rather than specific codes.
 */
function describePrinterError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const code = (err as NodeJS.ErrnoException | undefined)?.code
  const isSerialPath = /tty|COM\d/i.test(message)
  // Linux' strerror() (and thus these error messages) is localized by the system's LC_MESSAGES,
  // so "Permission denied" can just as well read "Keine Berechtigung" on a German-locale Kassen-
  // Laptop - matching only English substrings silently misses that. `code` is the one thing on a
  // Node error that's never localized, so it's checked first when the native module sets it.
  const isPermissionError =
    code === 'EACCES' || /ACCESS|EACCES|permission|berechtigung|zugriff verweigert/i.test(message)

  if (process.platform === 'linux' && isPermissionError) {
    return isSerialPath
      ? `${message} — Vermutlich fehlt die Berechtigung für die serielle Schnittstelle unter ` +
          `Linux. Siehe README, Abschnitt "Serieller Drucker" (dialout-Gruppe für Linux).`
      : `${message} — Vermutlich fehlt die USB-Berechtigung unter Linux. Siehe README, ` +
          `Abschnitt "Bondrucker per USB anschließen und einrichten" (udev-Regel für Linux).`
  }

  if (
    process.platform === 'win32' &&
    /NOT_SUPPORTED|NOT_FOUND|no backend|driver/i.test(message)
  ) {
    return (
      `${message} — Unter Windows braucht der Drucker den WinUSB-Treiber statt seines ` +
      `Standardtreibers. Siehe README, Abschnitt "Bondrucker per USB anschließen und ` +
      `einrichten" (Zadig/WinUSB für Windows).`
    )
  }

  if (/cannot open|no such file|file not found/i.test(message)) {
    return (
      `${message} — Die serielle Schnittstelle/der Drucker wurde nicht gefunden. Kabel/Adapter ` +
      `geprüft? In den Einstellungen erneut nach Geräten suchen.`
    )
  }

  return message
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
    const message = describePrinterError(err)
    console.error(`[Kassensystem] Druckfehler (${kind}): ${message}\nVorschau:\n${preview}`)
    return { kind, ok: false, error: message }
  }
}

// Double-width text halves the usable line capacity (44 columns -> 22 at double width).
const QUAD_LINE_WIDTH = PRINTER_WIDTH / 2

// Breaks on word boundaries, never mid-word (mid-word wrapping on the real printer hardware is a
// bug class this project has hit and fixed multiple times) - a text longer than one quad-size line
// gets as many lines as it needs instead of falling back to a smaller size.
function wrapForQuadWidth(text: string): string[] {
  if (text.length <= QUAD_LINE_WIDTH) return [text]
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= QUAD_LINE_WIDTH) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

// Shared "big, bold, wraps at word boundaries if needed" treatment for Titelzeile 1 (used
// identically on Kassenbon, Wertbon and Testdruck) and the Wertbon product name, so both get
// exactly the same size/wrap behavior.
function printQuadBold(printer: ThermalPrinter, text: string): void {
  printer.bold(true)
  printer.setTextQuadArea()
  for (const line of wrapForQuadWidth(text)) {
    printer.println(line)
  }
  printer.setTextNormal()
  printer.bold(false)
}

function fillVoucher(
  printer: ThermalPrinter,
  settings: Settings,
  productName: string,
  priceCents: number,
  voucherNumber: number
): void {
  printer.alignCenter()
  printQuadBold(printer, settings.titleLine1)
  if (settings.titleLine2) printer.println(settings.titleLine2)
  printer.newLine()
  printQuadBold(printer, productName)
  printer.println(formatEuro(priceCents))
  printer.newLine()
  printer.alignCenter()
  printer.println(`${formatDate(new Date())} # Kasse ${settings.registerNumber} - No. ${voucherNumber}`)
  printer.partialCut()
}

function fillReceipt(printer: ThermalPrinter, settings: Settings, sale: SaleRecord): void {
  printer.alignCenter()
  printQuadBold(printer, settings.titleLine1)
  if (settings.titleLine2) printer.println(settings.titleLine2)
  printer.newLine()
  printer.println(settings.orgName)
  printer.println(settings.orgStreet)
  printer.println(settings.orgZipCity)
  if (settings.orgTaxId) printer.println(`St.-Id. ${settings.orgTaxId}`)
  printer.newLine()
  printer.alignLeft()
  printer.drawLine()
  // Nur für diese feste, kurze Kopfzeile sicher: table() teilt die Breite gleichmäßig ohne
  // Umbruch-Erkennung, bei variabler Artikelnamenlänge (siehe unten) wäre das riskant.
  printer.table(['Anz.', 'Artikel', 'Preis', 'Summe'])
  printer.drawLine()

  // Preis/Summe sitzen exakt auf denselben Spaltengrenzen wie die Kopfzeile (PRINTER_WIDTH / 4 je
  // Spalte), Menge+Artikel füllen die ersten beiden Spalten gemeinsam. Passt Name+Menge dort nicht
  // rein (Produktnamen sind frei eingebbar und unbegrenzt lang), weicht nur diese eine Zeile auf
  // das alte zweizeilige Format aus - sicherer als Kürzen oder ein Zeilenumbruch, den der Drucker
  // selbst nicht sauber beherrscht (siehe frühere PRs zur 44-Spalten-Grenze).
  const columnWidth = PRINTER_WIDTH / 4
  const nameColumnWidth = columnWidth * 2
  for (const item of sale.items) {
    const qtyName = `${item.quantity} x ${item.productName}`
    const unitCell = formatAmount(item.priceCents).padEnd(columnWidth)
    const totalCell = `${formatAmount(item.priceCents * item.quantity)} ${item.taxClass}`
    if (qtyName.length <= nameColumnWidth) {
      printer.println(qtyName.padEnd(nameColumnWidth) + unitCell + totalCell)
    } else {
      printer.println(qtyName)
      printer.println(' '.repeat(nameColumnWidth) + unitCell + totalCell)
    }
  }

  printer.drawLine()
  printer.bold(true)
  printer.leftRight('Summe:', formatEuro(sale.totalCents))
  printer.bold(false)
  printer.drawLine()

  const breakdown = taxBreakdown(
    sale.items.map((i) => ({ taxClass: i.taxClass, grossCents: i.priceCents * i.quantity })),
    { A: settings.taxRateA, B: settings.taxRateB }
  )
  printTaxBreakdown(printer, breakdown)
  printer.newLine()

  printer.alignCenter()
  printer.println(`${formatDate(new Date(sale.createdAt))} # Kasse ${settings.registerNumber} - No. ${sale.receiptNumber}`)
  printer.cut()
}

// Fixed column width (same PRINTER_WIDTH / 4 split as the item table above) so every value starts
// exactly under its header word regardless of how many digits the amount has - ad-hoc spacing
// between cells drifts out of alignment as soon as amounts differ in length.
function printTaxBreakdown(
  printer: ThermalPrinter,
  breakdown: ReturnType<typeof taxBreakdown>
): void {
  const columnWidth = PRINTER_WIDTH / 4
  printer.println(
    'MwSt'.padEnd(columnWidth) + 'Netto'.padEnd(columnWidth) + 'MwSt'.padEnd(columnWidth) + 'Brutto'
  )
  for (const b of breakdown) {
    const classCell = `${b.taxClass} ${b.ratePercent}%`.padEnd(columnWidth)
    const netCell = formatEuro(b.netCents).padEnd(columnWidth)
    const taxCell = formatEuro(b.taxCents).padEnd(columnWidth)
    printer.println(classCell + netCell + taxCell + formatEuro(b.grossCents))
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

// USB Hub class - never relevant to pick as a printer, filtered out purely to reduce noise.
const USB_HUB_CLASS = 9

export async function listUsbPrinterDevices(): Promise<UsbDeviceInfo[]> {
  const devices = await getUsbDevices()
  const result: UsbDeviceInfo[] = []

  for (const device of devices) {
    // Many ESC/POS receipt printers report a vendor-specific interface class instead of the
    // standard USB Printer Class (7), so we can't reliably filter to "real" printers here - list
    // everything except hubs and let the user pick their printer by name in Einstellungen.
    //
    // Reading configuration/string descriptors can fail entirely on a device that isn't bound to
    // a WinUSB-style driver yet (the common case on Windows before running Zadig). Each step below
    // is guarded on its own so such a device still shows up (with just its VID/PID) instead of
    // silently vanishing from the list - which is what made "kein Drucker gefunden" so confusing.
    let isHub = false
    try {
      isHub = device.configurations.some((cfg) =>
        cfg.interfaces.some((i) => i.alternate.interfaceClass === USB_HUB_CLASS)
      )
    } catch {
      // Deskriptoren nicht lesbar - Gerät sicherheitshalber trotzdem anzeigen statt zu verstecken.
    }
    if (isHub) continue

    let manufacturer: string | undefined
    let product: string | undefined
    try {
      manufacturer = device.manufacturerName ?? undefined
      product = device.productName ?? undefined
      if (manufacturer === undefined && product === undefined) {
        await withOpenDevice(device, () => {
          manufacturer = device.manufacturerName ?? undefined
          product = device.productName ?? undefined
        })
      }
    } catch {
      // Name nicht lesbar (fehlender Treiber/Berechtigung) - trotzdem mit VID/PID auflisten.
    }

    result.push({
      vendorId: device.vendorId,
      productId: device.productId,
      vendorIdHex: toHex(device.vendorId),
      productIdHex: toHex(device.productId),
      manufacturer,
      product
    })
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

export async function listSerialPorts(): Promise<SerialPortInfo[]> {
  const ports = await SerialPort.list()
  const infos = ports.map((p) => ({
    path: p.path,
    manufacturer: p.manufacturer,
    vendorId: p.vendorId,
    productId: p.productId
  }))

  // Linux exposes ~32 legacy /dev/ttyS0-31 "ports" on nearly every x86 machine regardless of
  // whether any hardware is behind them; they never have manufacturer/vendorId info, unlike a
  // real USB-to-serial adapter. Only list recognized ones - a genuine printer on a bare
  // /dev/ttyS0 without any USB descriptor info is rare enough that a clean list wins out here.
  const isRecognized = (p: SerialPortInfo): boolean => Boolean(p.manufacturer || p.vendorId)
  return infos.filter(isRecognized).sort((a, b) => a.path.localeCompare(b.path))
}

const BAUD_PROBE_RESPONSE_WINDOW_MS = 250
// Bounds the whole per-candidate attempt (open + settle + write/drain + response window + slack),
// so a wedged port/driver can never stall the candidate loop - it just moves on to the next rate.
const BAUD_PROBE_WATCHDOG_MS = 2000

// Opens its own port and talks raw bytes directly - deliberately separate from
// SerialEscposInterface, which stays TX-only and untouched for the real print path. Never rejects:
// every failure mode (open error, write error, timeout) resolves an empty buffer instead, so the
// caller's candidate loop always advances.
async function probeBaudRateOnce(path: string, baudRate: number): Promise<Buffer> {
  return new Promise((resolve) => {
    let settled = false
    const chunks: Buffer[] = []

    const port = new SerialPort(
      { path, baudRate, dataBits: 8, parity: 'none', stopBits: 1 },
      (openErr) => {
        if (openErr) finish()
      }
    )

    const watchdog = setTimeout(finish, BAUD_PROBE_WATCHDOG_MS)

    function finish(): void {
      if (settled) return
      settled = true
      clearTimeout(watchdog)
      try {
        port.close()
      } catch {
        /* Port ggf. schon geschlossen/getrennt - ignorieren, wir geben ohnehin nur zurück, was da ist. */
      }
      resolve(Buffer.concat(chunks))
    }

    port.once('error', finish)
    port.on('data', (chunk: Buffer) => chunks.push(chunk))

    port.once('open', () => {
      // Gleiche FTDI-DTR/RTS-Settle-Begründung wie in SerialEscposInterface.execute() - macht den
      // Probe-Versuch repräsentativ für den echten Druckweg, nicht nur "lässt sich der Port öffnen".
      setTimeout(() => {
        port.write(STATUS_QUERY_BYTES, (writeErr) => {
          if (writeErr) {
            finish()
            return
          }
          port.drain(() => setTimeout(finish, BAUD_PROBE_RESPONSE_WINDOW_MS))
        })
      }, SERIAL_OPEN_SETTLE_MS)
    })
  })
}

/**
 * Stiller Erkennungsversuch: fragt bei jeder Kandidaten-Baudrate den ESC/POS-Druckerstatus ab und
 * hört kurz auf eine Antwort. Funktioniert nur, wenn das Kabel/der Adapter eine Rückleitung (RX)
 * hat - bei vielen günstigen USB-Seriell-Kabeln ist das nicht der Fall, dann liefert das schlicht
 * kein Ergebnis (kein Fehler) und der Aufrufer fällt auf den geführten Testdruck zurück.
 */
export async function probeSerialBaudRate(path: string): Promise<BaudProbeResult> {
  const candidatesTried: number[] = []
  for (const candidate of BAUD_RATE_CANDIDATES) {
    candidatesTried.push(candidate)
    const response = await probeBaudRateOnce(path, candidate)
    if (isPlausibleStatusResponse(response)) {
      return { ok: true, baudRate: candidate, candidatesTried }
    }
  }
  return { ok: false, candidatesTried }
}

function fillBaudTestSlip(printer: ThermalPrinter, settings: Settings, baudRate: number): void {
  printer.alignCenter()
  printer.bold(true)
  printer.println('Test Baudrate')
  printer.bold(false)
  printer.println(`${baudRate} Baud`)
  printer.newLine()
  printer.println(settings.titleLine1)
  printer.cut()
}

/**
 * Geführter Fallback, falls der stille Versuch nichts findet: druckt für jede Kandidaten-Baudrate
 * einen eigenen, kurzen Zettel (eigene SerialEscposInterface-Instanz + eigener execute()-Aufruf pro
 * Kandidat, da die Baudrate eine Eigenschaft der Port-Verbindung selbst ist - lässt sich nicht in
 * einem gemeinsamen Puffer/einer Verbindung für mehrere Raten senden). Der Mensch liest ab, welcher
 * Zettel lesbar war. Ein Fehlschlag bei einem Kandidaten bricht die übrigen nicht ab.
 */
export async function printBaudTestSlips(
  path: string,
  settings: Settings
): Promise<BaudGuidedTestResult> {
  const attempts: BaudTestSlipAttempt[] = []
  for (const baudRate of BAUD_RATE_CANDIDATES) {
    const iface = new SerialEscposInterface(path, baudRate)
    const printer = buildThermalPrinter(iface)
    fillBaudTestSlip(printer, settings, baudRate)
    try {
      await printer.execute()
      attempts.push({ baudRate, ok: true })
    } catch (err) {
      attempts.push({ baudRate, ok: false, error: describePrinterError(err) })
    }
  }
  return { ok: attempts.some((a) => a.ok), attempts }
}

export async function printTestPage(settings: Settings): Promise<PrintResult> {
  const session = createPrinterSession(settings)
  session.printer.alignCenter()
  session.printer.bold(true)
  session.printer.println('Testdruck')
  session.printer.bold(false)
  printQuadBold(session.printer, settings.titleLine1)
  session.printer.newLine()
  session.printer.println(formatDateTime(new Date()))
  session.printer.cut()
  const job = await runJob(session, 'receipt')
  return { ok: job.ok, jobs: [job] }
}

export async function printSale(
  sale: SaleRecord,
  settings: Settings,
  options: { printReceipt?: boolean; printVouchers?: boolean } = {}
): Promise<PrintResult> {
  // Wertbons werden beim Verkauf immer gedruckt; der kombinierte Kassenbon ist eine bewusste
  // Extra-Aktion über einen eigenen Knopf und deshalb standardmäßig aus.
  const printReceipt = options.printReceipt ?? false
  const printVouchers = options.printVouchers ?? true
  if (!printReceipt && !printVouchers) return { ok: true, jobs: [] }

  // Ein Verkauf mit mehreren Artikeln braucht mehrere Wertbons - vorher hat jeder einzelne Bon
  // (und der Kassenbon) eine eigene Druckerverbindung auf- und wieder abgebaut (bei seriell inkl.
  // der 300ms-Settle-Pause aus SerialEscposInterface), was einen Verkauf mit z.B. 6 Artikeln spürbar
  // ausbremste. ThermalPrinter puffert Inhalte über mehrere println()/cut()-Aufrufe hinweg, bis
  // execute() aufgerufen wird - hier also alles in einen Puffer schreiben (inkl. der Schnitt-Befehle
  // zwischen den einzelnen Bons) und am Ende in einem einzigen execute() senden: eine Verbindung,
  // ein Rutsch, statt einer pro Bon.
  const session = createPrinterSession(settings)

  if (printReceipt) {
    fillReceipt(session.printer, settings, sale)
  }
  if (printVouchers) {
    for (const item of sale.items) {
      for (let i = 0; i < item.quantity; i++) {
        const voucherNumber = item.voucherNumberStart + i
        fillVoucher(session.printer, settings, item.productName, item.priceCents, voucherNumber)
      }
    }
  }

  const job = await runJob(session, printReceipt ? 'receipt' : 'voucher')
  return { ok: job.ok, jobs: [job] }
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
