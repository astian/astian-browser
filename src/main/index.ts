import { app, shell, BrowserWindow, protocol, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { TabsController } from './browser/tabs'
import { registerBrowserIpc } from './ipc/register-ipc'
import { initDatabase } from './db/client'
import { IPC_CHANNELS } from '../shared/ipc'

// Register astian:// as a standard scheme before app ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'astian', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

// ── astian:// protocol ────────────────────────────────────────────────────

function makeInternalPage(title: string, body: string): Response {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>${title} — Astian</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0a0a0a;color:#e5e5e5;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem}
    h1{font-size:1.5rem;font-weight:600;margin-bottom:.75rem;color:#f5f5f5}
    p{color:#737373;font-size:.875rem;line-height:1.6;text-align:center}
    .badge{display:inline-block;background:#1d4ed8;color:#bfdbfe;font-size:.75rem;font-weight:500;padding:.25rem .75rem;border-radius:9999px;margin-bottom:1.5rem}
  </style>
</head>
<body>${body}</body>
</html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

function registerAstianProtocol(): void {
  protocol.handle('astian', (request) => {
    const url = new URL(request.url)
    const page = url.hostname

    if (page === 'newtab') {
      return makeInternalPage(
        'Nueva pestaña',
        `<div class="badge">astian://newtab</div><h1>Nueva pestaña</h1><p>Bienvenido a Astian Browser.<br/>Usa la barra de direcciones para navegar.</p>`
      )
    }
    if (page === 'settings') {
      return makeInternalPage(
        'Configuración',
        `<div class="badge">astian://settings</div><h1>Configuración</h1><p>Usa el panel de preferencias del navegador para cambiar los ajustes.</p>`
      )
    }
    if (page === 'history') {
      return makeInternalPage(
        'Historial',
        `<div class="badge">astian://history</div><h1>Historial</h1><p>El historial de navegación estará disponible en una próxima versión.</p>`
      )
    }

    return new Response('Not Found', { status: 404 })
  })
}
// ── external-scheme security prompt (native dialog on main) ──────────────
const SAFE_SCHEMES = new Set(['http', 'https', 'astian', 'file', 'about', 'data'])

function isExternalScheme(url: string): boolean {
  try {
    const scheme = new URL(url).protocol.replace(':', '')
    return !SAFE_SCHEMES.has(scheme)
  } catch {
    return false
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    show: false,
    autoHideMenuBar: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.setMenuBarVisibility(false)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isExternalScheme(details.url)) {
      // Notify renderer to show security prompt; block the window open
      mainWindow.webContents.send(IPC_CHANNELS.EXTERNAL_SCHEME_REQUEST, {
        url: details.url,
        scheme: new URL(details.url).protocol.replace(':', '')
      })
      return { action: 'deny' }
    }
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Register browser IPC before renderer boot to avoid race conditions on initial getState.
  const tabs = new TabsController(mainWindow)
  registerBrowserIpc(mainWindow, tabs)

  // IPC: renderer asks user to confirm opening an external scheme
  ipcMain.handle(IPC_CHANNELS.CONFIRM_EXTERNAL_SCHEME, async (_event, url: string) => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Abrir enlace externo',
      message: `¿Quieres abrir este enlace en una app externa?`,
      detail: url,
      buttons: ['Abrir', 'Cancelar'],
      defaultId: 0,
      cancelId: 1
    })
    if (response === 0) {
      await shell.openExternal(url)
      return true
    }
    return false
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.astian.browser')
  initDatabase()
  registerAstianProtocol()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
