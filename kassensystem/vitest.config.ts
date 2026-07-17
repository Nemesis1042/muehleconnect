import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      // Real Electron isn't installed/runnable in this sandbox; initDb() only calls
      // app.getPath() when no explicit path is given, which tests never rely on.
      electron: resolve(__dirname, 'src/main/__tests__/electron.mock.ts')
    }
  }
})
