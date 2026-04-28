import { app, type Session } from 'electron'
import AdmZip from 'adm-zip'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join, parse } from 'node:path'
import crypto from 'node:crypto'

function crxZipOffset(buffer: Buffer): number {
  if (buffer.length < 16 || buffer.toString('ascii', 0, 4) !== 'Cr24') {
    throw new Error('Archivo CRX invalido')
  }

  const version = buffer.readUInt32LE(4)
  if (version === 2) {
    const publicKeyLength = buffer.readUInt32LE(8)
    const signatureLength = buffer.readUInt32LE(12)
    return 16 + publicKeyLength + signatureLength
  }

  if (version === 3) {
    const headerLength = buffer.readUInt32LE(8)
    return 12 + headerLength
  }

  throw new Error(`Version CRX no soportada: ${version}`)
}

function buildInstallPath(filePath: string): string {
  const baseName = parse(filePath).name.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()
  const stableSuffix = crypto.createHash('sha1').update(filePath).digest('hex').slice(0, 8)
  return join(app.getPath('userData'), 'extensions', `${baseName}-${stableSuffix}`)
}

export async function installCrxIntoSession(filePath: string, targetSession: Session): Promise<void> {
  const crxBuffer = await readFile(filePath)
  const zipOffset = crxZipOffset(crxBuffer)

  if (zipOffset >= crxBuffer.length) {
    throw new Error('No se encontro payload ZIP dentro del CRX')
  }

  const installPath = buildInstallPath(filePath)
  await rm(installPath, { recursive: true, force: true })
  await mkdir(installPath, { recursive: true })

  const zipPayload = crxBuffer.subarray(zipOffset)
  const zip = new AdmZip(zipPayload)
  zip.extractAllTo(installPath, true)

  await targetSession.loadExtension(installPath, { allowFileAccess: true })
}
