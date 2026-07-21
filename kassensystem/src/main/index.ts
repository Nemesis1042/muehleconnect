import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'path'
import { initDb } from './db'
import { registerIpcHandlers } from './ipc'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  try {
    initDb()
    registerIpcHandlers()
    createWindow()
  } catch (error) {
    // Without this, a failed startup (e.g. locked/corrupt DB file) fails silently: no window
    // ever appears and there is no console visible in the packaged app, leaving whoever is
    // running the till with no clue why the app "did nothing".
    dialog.showErrorBox(
      'Kassensystem konnte nicht gestartet werden',
      `Beim Start ist ein Fehler aufgetreten:\n\n${error instanceof Error ? error.message : String(error)}`
    )
    app.quit()
    return
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
