import { describe, expect, it } from 'vitest'
import { BAUD_RATE_CANDIDATES, isPlausibleStatusResponse } from '../serialProbe'

describe('BAUD_RATE_CANDIDATES', () => {
  it('lists the common ESC/POS serial rates in ascending order', () => {
    expect(BAUD_RATE_CANDIDATES).toEqual([9600, 19200, 38400, 57600, 115200])
  })
})

describe('isPlausibleStatusResponse', () => {
  it('rejects an empty response', () => {
    expect(isPlausibleStatusResponse(Buffer.alloc(0))).toBe(false)
  })

  it('accepts a single-byte response', () => {
    expect(isPlausibleStatusResponse(Buffer.from([0x12]))).toBe(true)
  })

  it('accepts up to 8 bytes', () => {
    expect(isPlausibleStatusResponse(Buffer.alloc(8))).toBe(true)
  })

  it('rejects more than 8 bytes as line noise rather than a genuine reply', () => {
    expect(isPlausibleStatusResponse(Buffer.alloc(9))).toBe(false)
  })
})
