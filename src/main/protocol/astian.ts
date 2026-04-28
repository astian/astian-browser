import { protocol, type Session } from 'electron'

function makeInternalPage(title: string, body: string, script = ''): Response {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title} - Astian</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    :root{--bg:#090c12;--panel:#0f1420;--line:#1f2735;--muted:#8a94a7;--text:#ebf0ff;--brand:#2e7dff;--danger:#ff5d5d;--ok:#2ec87a}
    body{font-family:'Segoe UI',system-ui,sans-serif;background:radial-gradient(1200px 600px at 10% -10%,#1a2440 0%,transparent 55%),radial-gradient(900px 500px at 100% 0%,#122038 0%,transparent 50%),var(--bg);color:var(--text);min-height:100vh;padding:20px}
    .wrap{max-width:1100px;margin:0 auto}
    .top{display:flex;align-items:center;gap:10px;margin-bottom:16px}
    .badge{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--panel);padding:6px 10px;border-radius:999px;color:#9cb2dd;font-size:12px}
    h1{font-size:22px;font-weight:700}
    .tools{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
    .input,.select{height:38px;border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:10px;padding:0 12px;outline:none}
    .input{min-width:220px;flex:1}
    .btn{height:38px;border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:10px;padding:0 12px;cursor:pointer}
    .btn:hover{border-color:#3b4d6d}
    .btn.primary{background:#1d5fd6;border-color:#2e7dff}
    .btn.danger{color:#ffb4b4;border-color:#5a2a2a}
    .card{border:1px solid var(--line);background:linear-gradient(180deg,#101726,#0d1320);border-radius:14px;overflow:hidden}
    .row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-top:1px solid #1a2333}
    .row:first-child{border-top:none}
    .title{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .meta{color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .spacer{flex:1}
    .list-empty{padding:26px;text-align:center;color:var(--muted)}
    .pill{font-size:11px;padding:3px 8px;border-radius:999px;border:1px solid #2c3a53;color:#98b2df}
    .pill.ok{border-color:#1f5038;color:#84d8ae}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
    .tile{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:12px}
    .field{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
    .field label{font-size:12px;color:var(--muted)}
    @media (max-width: 720px){body{padding:12px}.tools{flex-direction:column}.input,.select,.btn{width:100%}}
  </style>
</head>
<body>
  <div class="wrap">${body}</div>
  <script>${script}</script>
</body>
</html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

function historyPage(): Response {
  return makeInternalPage(
    'Historial',
    `<div class="top"><div class="badge">astian://history</div><h1>Historial</h1></div>
     <div class="tools">
      <input id="q" class="input" placeholder="Buscar en historial" />
      <select id="range" class="select"><option value="all">Todo</option><option value="today">Hoy</option><option value="week">Esta semana</option><option value="month">Este mes</option></select>
      <button id="clear" class="btn danger">Borrar todo</button>
     </div>
     <div id="list" class="card"></div>`,
    `(() => {
      let state = null
      const list = document.getElementById('list')
      const q = document.getElementById('q')
      const range = document.getElementById('range')
      const clear = document.getElementById('clear')

      const inRange = (visitedAt, mode) => {
        if (mode === 'all') return true
        const now = Date.now()
        const day = 86400000
        if (mode === 'today') return visitedAt >= now - day
        if (mode === 'week') return visitedAt >= now - day * 7
        return visitedAt >= now - day * 30
      }

      const render = () => {
        if (!state) return
        const text = (q.value || '').toLowerCase().trim()
        const mode = range.value
        const rows = state.history.filter((h) => inRange(h.visitedAt, mode)).filter((h) => {
          if (!text) return true
          return (h.title || '').toLowerCase().includes(text) || (h.url || '').toLowerCase().includes(text)
        })

        if (rows.length === 0) {
          list.innerHTML = '<div class="list-empty">Sin resultados de historial.</div>'
          return
        }

        list.innerHTML = rows.map((h) => {
          const date = new Date(h.visitedAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
          return '<div class="row">' +
            '<div><div class="title">' + (h.title || h.url) + '</div><div class="meta">' + h.url + ' · ' + date + '</div></div>' +
            '<div class="spacer"></div>' +
            '<button class="btn" data-open="' + h.id + '">Abrir</button>' +
            '<button class="btn danger" data-del="' + h.id + '">Eliminar</button>' +
          '</div>'
        }).join('')
      }

      list.addEventListener('click', async (event) => {
        const target = event.target
        if (!(target instanceof HTMLElement)) return
        const openId = target.getAttribute('data-open')
        if (openId) {
          const item = state.history.find((h) => h.id === openId)
          if (item) await window.browserApi.createTab(item.url)
          return
        }
        const delId = target.getAttribute('data-del')
        if (delId) {
          await window.browserApi.deleteHistoryEntry(delId)
        }
      })

      clear.addEventListener('click', async () => {
        await window.browserApi.clearHistory()
      })
      q.addEventListener('input', render)
      range.addEventListener('change', render)

      window.browserApi.onStateChanged((s) => { state = s; render() })
      window.browserApi.getState().then((s) => { state = s; render() })
    })();`
  )
}

function bookmarksPage(): Response {
  return makeInternalPage(
    'Marcadores',
    `<div class="top"><div class="badge">astian://bookmarks</div><h1>Marcadores</h1></div>
     <div class="tools">
      <input id="q" class="input" placeholder="Buscar marcadores" />
      <button id="save" class="btn primary">Guardar pagina actual</button>
     </div>
     <div id="list" class="grid"></div>`,
    `(() => {
      let state = null
      const list = document.getElementById('list')
      const q = document.getElementById('q')
      const save = document.getElementById('save')

      const render = () => {
        if (!state) return
        const text = (q.value || '').toLowerCase().trim()
        const rows = state.bookmarks.filter((b) => {
          if (!text) return true
          return (b.title || '').toLowerCase().includes(text) || (b.url || '').toLowerCase().includes(text)
        })
        if (rows.length === 0) {
          list.innerHTML = '<div class="list-empty" style="grid-column:1/-1">Sin marcadores.</div>'
          return
        }
        list.innerHTML = rows.map((b) => {
          const date = new Date(b.createdAt).toLocaleDateString('es')
          return '<div class="tile">' +
            '<div class="title">' + (b.title || b.url) + '</div>' +
            '<div class="meta" style="margin-top:4px">' + b.url + '</div>' +
            '<div class="meta" style="margin-top:4px">Guardado: ' + date + '</div>' +
            '<div style="display:flex;gap:8px;margin-top:10px">' +
              '<button class="btn" data-open="' + b.id + '" style="flex:1">Abrir</button>' +
              '<button class="btn danger" data-del="' + b.id + '" style="flex:1">Eliminar</button>' +
            '</div>' +
          '</div>'
        }).join('')
      }

      list.addEventListener('click', async (event) => {
        const target = event.target
        if (!(target instanceof HTMLElement)) return
        const openId = target.getAttribute('data-open')
        if (openId) {
          const item = state.bookmarks.find((b) => b.id === openId)
          if (item) await window.browserApi.createTab(item.url)
          return
        }
        const delId = target.getAttribute('data-del')
        if (delId) {
          await window.browserApi.removeBookmark(delId)
        }
      })

      save.addEventListener('click', async () => {
        await window.browserApi.addBookmark()
      })
      q.addEventListener('input', render)

      window.browserApi.onStateChanged((s) => { state = s; render() })
      window.browserApi.getState().then((s) => { state = s; render() })
    })();`
  )
}

function extensionsPage(): Response {
  return makeInternalPage(
    'Extensiones',
    `<div class="top"><div class="badge">astian://extensions</div><h1>Extensiones</h1></div>
     <div id="drop" class="card" style="padding:16px;text-align:center;margin-bottom:12px;color:#9fb0cc">Arrastra un archivo .crx para instalar en el perfil activo</div>
     <div id="list" class="card"></div>`,
    `(() => {
      let state = null
      const list = document.getElementById('list')
      const drop = document.getElementById('drop')

      const render = () => {
        if (!state) return
        const rows = state.extensions
        if (rows.length === 0) {
          list.innerHTML = '<div class="list-empty">No hay extensiones instaladas.</div>'
          return
        }
        list.innerHTML = rows.map((ext) => {
          return '<div class="row">' +
            '<div><div class="title">' + ext.name + '</div><div class="meta">ID: ' + ext.id + ' · v' + ext.version + '</div></div>' +
            '<div class="spacer"></div>' +
            '<span class="pill ' + (ext.enabled ? 'ok' : '') + '">' + (ext.enabled ? 'Activa' : 'Desactivada') + '</span>' +
            '<button class="btn" data-toggle="' + ext.id + '">' + (ext.enabled ? 'Desactivar' : 'Activar') + '</button>' +
            '<button class="btn danger" data-uninstall="' + ext.id + '">Desinstalar</button>' +
          '</div>'
        }).join('')
      }

      list.addEventListener('click', async (event) => {
        const target = event.target
        if (!(target instanceof HTMLElement)) return
        const toggleId = target.getAttribute('data-toggle')
        if (toggleId) {
          const ext = state.extensions.find((e) => e.id === toggleId)
          if (!ext) return
          if (ext.enabled) await window.browserApi.disableExtension(toggleId)
          else await window.browserApi.enableExtension(toggleId)
          return
        }
        const uninstallId = target.getAttribute('data-uninstall')
        if (uninstallId) {
          await window.browserApi.uninstallExtension(uninstallId)
        }
      })

      drop.addEventListener('dragover', (event) => {
        event.preventDefault()
        drop.style.borderColor = '#2e7dff'
      })
      drop.addEventListener('dragleave', () => {
        drop.style.borderColor = ''
      })
      drop.addEventListener('drop', async (event) => {
        event.preventDefault()
        drop.style.borderColor = ''
        const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]
        const path = file && file.path
        if (!path || !path.endsWith('.crx')) return
        await window.browserApi.installExtensionFromCrx(path)
      })

      window.browserApi.onStateChanged((s) => { state = s; render() })
      window.browserApi.getState().then((s) => { state = s; render() })
    })();`
  )
}

function settingsPage(): Response {
  return makeInternalPage(
    'Configuracion',
    `<div class="top"><div class="badge">astian://settings</div><h1>Configuracion</h1></div>
     <div class="card" style="padding:14px">
      <div class="field"><label>Tema</label><select id="theme" class="select"><option value="dark">Oscuro</option><option value="light">Claro</option></select></div>
      <div class="field"><label>Disposicion de tabs</label><select id="layout" class="select"><option value="horizontal">Horizontal</option><option value="sidebar">Sidebar</option></select></div>
      <div class="field"><label>Motor de busqueda</label><select id="search" class="select"><option value="astiango">AstianGO</option><option value="google">Google</option><option value="duckduckgo">DuckDuckGo</option><option value="bing">Bing</option></select></div>
      <div class="field"><label>Icono personalizado</label><input id="glyph" class="input" maxlength="2" /></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button id="adblock" class="btn">Adblock</button>
        <button id="sleep" class="btn">Sleep tabs</button>
      </div>
     </div>`,
    `(() => {
      let state = null
      const theme = document.getElementById('theme')
      const layout = document.getElementById('layout')
      const search = document.getElementById('search')
      const glyph = document.getElementById('glyph')
      const adblock = document.getElementById('adblock')
      const sleep = document.getElementById('sleep')

      const render = () => {
        if (!state) return
        const p = state.preferences
        theme.value = p.theme
        layout.value = p.tabLayout
        search.value = p.searchEngine
        glyph.value = p.appIconGlyph || 'A'
        adblock.textContent = p.adblockEnabled ? 'Adblock: Activado' : 'Adblock: Desactivado'
        sleep.textContent = p.sleepTabsEnabled ? 'Sleep tabs: Activado' : 'Sleep tabs: Desactivado'
      }

      theme.addEventListener('change', () => window.browserApi.updatePreferences({ theme: theme.value }))
      layout.addEventListener('change', () => window.browserApi.updatePreferences({ tabLayout: layout.value }))
      search.addEventListener('change', () => window.browserApi.updatePreferences({ searchEngine: search.value }))
      glyph.addEventListener('change', () => window.browserApi.updatePreferences({ appIconGlyph: glyph.value || 'A' }))
      adblock.addEventListener('click', async () => {
        const s = await window.browserApi.getState()
        await window.browserApi.updatePreferences({ adblockEnabled: !s.preferences.adblockEnabled })
      })
      sleep.addEventListener('click', async () => {
        const s = await window.browserApi.getState()
        await window.browserApi.updatePreferences({ sleepTabsEnabled: !s.preferences.sleepTabsEnabled })
      })

      window.browserApi.onStateChanged((s) => { state = s; render() })
      window.browserApi.getState().then((s) => { state = s; render() })
    })();`
  )
}

function newTabPage(): Response {
  return makeInternalPage(
    'Nueva pestana',
    `<div class="top"><div class="badge">astian://newtab</div><h1>Nueva pestana</h1></div><div class="card"><div class="list-empty">Bienvenido a Astian Browser. Usa la barra de direcciones para navegar.</div></div>`
  )
}

function resolveAstianRequest(requestUrl: string): Response {
  const url = new URL(requestUrl)
  const page = url.hostname

  if (page === 'newtab') return newTabPage()
  if (page === 'settings') return settingsPage()
  if (page === 'history') return historyPage()
  if (page === 'bookmarks') return bookmarksPage()
  if (page === 'extensions') return extensionsPage()

  return new Response('Not Found', { status: 404 })
}

export function registerAstianProtocol(): void {
  protocol.handle('astian', (request) => resolveAstianRequest(request.url))
}

export function registerAstianProtocolForSession(targetSession: Session): void {
  targetSession.protocol.handle('astian', (request) => resolveAstianRequest(request.url))
}
