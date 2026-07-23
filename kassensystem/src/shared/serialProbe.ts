/** ESC/POS serial rates seen in practice on this hardware family; tried in this order. */
export const BAUD_RATE_CANDIDATES: readonly number[] = [9600, 19200, 38400, 57600, 115200]

/** ESC/POS "transmit real-time status" request, n=1 (printer status): DLE EOT n. */
export const STATUS_QUERY_BYTES = Buffer.from([0x10, 0x04, 0x01])

// A wrong baud rate framing-errors the UART into noise; a real status reply at the right rate is
// 1 byte (occasionally a couple). More bytes than this in the response window looks like line
// noise rather than a genuine status reply, so it's treated as "no response" for that candidate.
const MAX_PLAUSIBLE_RESPONSE_BYTES = 8

export function isPlausibleStatusResponse(bytes: Buffer | Uint8Array): boolean {
  return bytes.length >= 1 && bytes.length <= MAX_PLAUSIBLE_RESPONSE_BYTES
}
