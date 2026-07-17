/// <reference types="vite/client" />

import type { KassenApi } from '@shared/types'

declare global {
  interface Window {
    kassen: KassenApi
  }
}

export {}
