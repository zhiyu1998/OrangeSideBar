#!/usr/bin/env node
/**
 * 一键发版：改版本号 → 提交 → 打 tag → 推送，剩下的交给 GitHub Actions 自动上传商店。
 *
 *   node scripts/release.mjs 2.0.5            # 指定版本
 *   node scripts/release.mjs patch            # 2.0.4 -> 2.0.5
 *   node scripts/release.mjs minor            # 2.0.4 -> 2.1.0
 *   node scripts/release.mjs 2.0.5 --no-push  # 只本地改 + tag，不推
 *   node scripts/release.mjs 2.0.5 --skip-build
 */

import { readFile, writeFile } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { readZipManifestVersion } from './lib/zip-version.mjs'

const argv = process.argv.slice(2)
const args = argv.filter((a) => !a.startsWith('--'))
const flags = new Set(argv.filter((a) => a.startsWith('--')))
const target = args[0]

const run = (cmd, opts = {}) => {
  console.log(`$ ${cmd}`)
  return execSync(cmd, { stdio: 'inherit', ...opts })
}
const fail = (m) => {
  console.error(`\n✗ ${m}`)
  process.exit(1)
}

if (!target) fail('用法: node scripts/release.mjs <2.0.5|patch|minor|major> [--no-push] [--skip-build]')

const root = process.cwd()
const pkgPath = path.join(root, 'package.json')
const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
const cur = pkg.version

function nextVersion(cur, spec) {
  const m = cur.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!m) fail(`当前版本号无法解析: ${cur}`)
  const [ma, mi, pa] = m.slice(1).map(Number)
  switch (spec) {
    case 'patch':
      return `${ma}.${mi}.${pa + 1}`
    case 'minor':
      return `${ma}.${mi + 1}.0`
    case 'major':
      return `${ma + 1}.0.0`
    default:
      if (!/^\d+\.\d+\.\d+$/.test(spec)) fail(`无法识别的版本: ${spec}`)
      return spec
  }
}

const next = nextVersion(cur, target)
if (next === cur) fail(`新版本与当前版本相同 (${cur})`)

// Chrome 商店不接受回退或重复版本
const cmp = (a, b) => {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
  return 0
}
if (cmp(next, cur) <= 0) fail(`新版本 ${next} 必须大于当前版本 ${cur}（商店不允许降级/同版本重复上传）`)

console.log(`\n版本: ${cur} → ${next}\n`)

// 工作区必须干净，避免把无关改动卷进发布提交
const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim()
if (dirty) {
  console.log('工作区有未提交改动：\n' + dirty + '\n')
  if (!flags.has('--allow-dirty')) fail('先提交或 stash，或加 --allow-dirty 强行继续')
}

pkg.version = next
await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8')
console.log(`✓ package.json → ${next}（manifest.config.ts 直接读 pkg.version，无需另改）`)

if (!flags.has('--skip-build')) {
  run('bun run build')
  const zipPath = path.join(root, 'release', `crx-${pkg.name}-${next}.zip`)
  const built = await readZipManifestVersion(zipPath)
  if (built.version !== next) fail(`构建产物内 manifest 版本是 ${built.version}，期望 ${next}`)
  console.log(`✓ 构建完成并校验: ${path.relative(root, zipPath)} (manifest ${built.version})`)
}

run(`git add package.json`)
run(`git commit -m "🔖 chore: 版本号升级至 ${next}"`)
run(`git tag ${next}`)

if (!flags.has('--no-push')) {
  run('git push origin HEAD')
  run(`git push origin ${next}`)
  console.log(`\n✓ 已推送 tag ${next} → GitHub Actions 将自动构建并上传到 Chrome Web Store`)
  console.log('  跟踪进度: gh run watch  （或打开仓库 Actions 页）')
} else {
  console.log(`\n✓ 本地已打 tag ${next}，未推送。需要发布时执行: git push origin HEAD --follow-tags`)
}