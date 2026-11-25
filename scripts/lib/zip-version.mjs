/**
 * 从 zip 的中央目录里读出根 manifest.json 的 version，不依赖任何第三方库。
 * 只解析中央目录 + 定位到对应 local header，避免解压整个包（发布包有 18 MB）。
 */
import { readFile } from 'node:fs/promises'
import { inflateRawSync } from 'node:zlib'

const EOCD_SIG = 0x06054b50
const CEN_SIG = 0x02014b50

export async function readZipManifestVersion(zipPath) {
  const buf = await readFile(zipPath)

  let eocd = -1
  const minStart = Math.max(0, buf.length - 22 - 0xffff)
  for (let i = buf.length - 22; i >= minStart; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error(`不是有效的 zip（找不到 EOCD）: ${zipPath}`)

  const entryCount = buf.readUInt16LE(eocd + 10)
  let ptr = buf.readUInt32LE(eocd + 16)

  for (let i = 0; i < entryCount; i++) {
    if (buf.readUInt32LE(ptr) !== CEN_SIG) break
    const method = buf.readUInt16LE(ptr + 10)
    const compSize = buf.readUInt32LE(ptr + 20)
    const nameLen = buf.readUInt16LE(ptr + 28)
    const extraLen = buf.readUInt16LE(ptr + 30)
    const commentLen = buf.readUInt16LE(ptr + 32)
    const localOffset = buf.readUInt32LE(ptr + 42)
    const name = buf.toString('utf8', ptr + 46, ptr + 46 + nameLen)

    if (name === 'manifest.json') {
      const lNameLen = buf.readUInt16LE(localOffset + 26)
      const lExtraLen = buf.readUInt16LE(localOffset + 28)
      const dataStart = localOffset + 30 + lNameLen + lExtraLen
      const raw = buf.subarray(dataStart, dataStart + compSize)
      const data = method === 0 ? raw : inflateRawSync(raw)
      const manifest = JSON.parse(data.toString('utf8'))
      return { version: manifest.version, manifest }
    }
    ptr += 46 + nameLen + extraLen + commentLen
  }
  throw new Error(`zip 根目录没有 manifest.json: ${zipPath}`)
}