import { app, BrowserWindow, ipcMain, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { getAuthState, login, logout } from './services/auth'
import { buildCsp, isAppUrl } from './services/csp'
import { cancelSync, runSync } from './services/pack'
import { getConfig, setConfig } from './services/config'
import { cancelPlay, runGamePlay } from './services/play-runner'
import { wireUpdater } from './services/updater'
import { autoUpdater } from 'electron-updater'
import type { LauncherConfig } from '../shared/config'

/**
 * El Caballero de Netherite — proceso principal.
 * Ventana frameless 1280x720. Splash + menú viven en el renderer (React).
 * Seguridad: contextIsolation ON, nodeIntegration OFF. CSP por header (dev/prod),
 * aplicada solo a las URLs de la app.
 */

const WIDTH = 1280
const HEIGHT = 720

let mainWindow: BrowserWindow | null = null

function applyCsp(): void {
  const csp = buildCsp(is.dev)
  const devRendererUrl = process.env['ELECTRON_RENDERER_URL']

  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    // Solo nuestra UI. Inyectar la CSP en respuestas de terceros (p. ej. el login
    // de Microsoft) las rompe: `default-src 'self'` les bloquea todo.
    if (!isAppUrl(details.url, devRendererUrl)) {
      cb({})
      return
    }
    cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } })
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    frame: false, // frameless: controles vía IPC
    resizable: false,
    center: true,
    backgroundColor: '#0a0710',
    title: 'El Caballero de Netherite',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow = win
  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('studios.emigrete.caballeronetherite')
  applyCsp()
  app.on('browser-window-created', (_e, window) => optimizer.watchWindowShortcuts(window))

  // Controles de ventana (frameless)
  ipcMain.on('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize())
  ipcMain.on('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close())
  ipcMain.on('app:quit', () => app.quit())

  // M1 — autenticación Microsoft (msmc). Corre en el main: abre su propia ventana.
  ipcMain.handle('auth:state', () => getAuthState())
  ipcMain.handle('auth:login', () => login())
  ipcMain.handle('auth:logout', () => logout())

  // M2 — sincronización del modpack. El progreso vuelve por 'pack:progress'.
  ipcMain.handle('pack:sync', (event) =>
    runSync((progress) => {
      if (!event.sender.isDestroyed()) event.sender.send('pack:progress', progress)
    })
  )
  ipcMain.handle('pack:cancel', () => cancelSync())

  // M3 — jugar (sincroniza + lanza). El progreso vuelve por 'play:progress'.
  ipcMain.handle('game:play', (event) =>
    runGamePlay((state) => {
      if (!event.sender.isDestroyed()) event.sender.send('play:progress', state)
    })
  )
  ipcMain.handle('game:cancel', () => cancelPlay())

  // Config persistida (URL del manifiesto, RAM).
  ipcMain.handle('config:get', () => getConfig())
  ipcMain.handle('config:set', (_e, patch: unknown) => {
    // patch crudo del renderer: setConfig lo mergea con la config actual y sanitiza.
    const safe = patch && typeof patch === 'object' ? (patch as Partial<LauncherConfig>) : {}
    return setConfig(safe)
  })

  // M4 — auto-updater. check/download/install; el status vuelve por 'updater:status'.
  ipcMain.handle('updater:check', () => (app.isPackaged ? autoUpdater.checkForUpdates() : null))
  ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate())
  ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall())

  createWindow()
  setupUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

/* ------------------------------ M4 updater ------------------------------ *
 * Auto-update desde GitHub Releases (repo público). autoDownload OFF: se
 * pregunta antes de bajar. Solo activo en producción (empaquetado): el
 * autoUpdater tira si corre en dev. Nunca bloquea el jugar.
 * ------------------------------------------------------------------------ */
function setupUpdater(): void {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  wireUpdater(autoUpdater, (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updater:status', status)
  })
  // Chequeo al arrancar, no bloqueante; los errores los maneja wireUpdater.
  setTimeout(() => void autoUpdater.checkForUpdates()?.catch(() => undefined), 3000)
}
