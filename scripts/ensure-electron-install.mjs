import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const electronPathFile = join(process.cwd(), 'node_modules', 'electron', 'path.txt')
const electronInstallScript = join(process.cwd(), 'node_modules', 'electron', 'install.js')

if (existsSync(electronPathFile)) {
  console.log('[ensure-electron] Electron binary already installed.')
  process.exit(0)
}

if (!existsSync(electronInstallScript)) {
  console.warn('[ensure-electron] electron/install.js not found. Skipping.')
  process.exit(0)
}

console.log('[ensure-electron] Missing Electron binary metadata. Running electron/install.js...')
const result = spawnSync(process.execPath, [electronInstallScript], { stdio: 'inherit' })

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

if (!existsSync(electronPathFile)) {
  console.error('[ensure-electron] Installation finished but path.txt is still missing.')
  process.exit(1)
}

console.log('[ensure-electron] Electron binary installation completed.')
