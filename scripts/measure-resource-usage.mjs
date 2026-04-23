import { access } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import electronPath from 'electron'

const projectRoot = path.resolve(import.meta.dirname, '..')
const entryPoint = path.join(projectRoot, 'out/main/index.js')
const STARTUP_TARGET_MS = 1200
const RSS_TARGET_MB = 250

async function ensureBuildExists() {
  try {
    await access(entryPoint)
  } catch {
    console.error('Build output not found. Run `bun run build` before measuring resources.')
    process.exit(1)
  }
}

function parseMetric(output, label) {
  const match = output.match(new RegExp(`${label}:\\s+([0-9.]+)`))
  return match ? Number(match[1]) : null
}

await ensureBuildExists()

const child = spawn(electronPath, [entryPoint], {
  cwd: projectRoot,
  env: {
    ...process.env,
    ASTIAN_RESOURCE_MEASURE: '1'
  },
  stdio: ['ignore', 'pipe', 'pipe']
})

let stdout = ''
let stderr = ''

child.stdout.on('data', (chunk) => {
  const text = chunk.toString()
  stdout += text
  process.stdout.write(text)
})

child.stderr.on('data', (chunk) => {
  const text = chunk.toString()
  stderr += text
  process.stderr.write(text)
})

const exitCode = await new Promise((resolve) => {
  child.on('close', resolve)
})

if (exitCode !== 0) {
  process.exit(exitCode ?? 1)
}

const startupMs = parseMetric(stdout, 'Cold start')
const ramMb = parseMetric(stdout, 'RAM with 3 tabs')

if (startupMs !== null) {
  console.log(`Startup target ${STARTUP_TARGET_MS} ms: ${startupMs <= STARTUP_TARGET_MS ? 'PASS' : 'FAIL'}`)
}

if (ramMb !== null) {
  console.log(`RAM target ${RSS_TARGET_MB} MB: ${ramMb <= RSS_TARGET_MB ? 'PASS' : 'FAIL'}`)
}

if (!stdout.includes('Cold start:') || !stdout.includes('RAM with 3 tabs:')) {
  console.error('Resource measurement did not emit the expected metrics.')
  process.exit(1)
}
