#!/usr/bin/env node
/**
 * Chrome Web Store 自动上传 + 提审（CWS API v2）
 *
 * V1.1 已于 2026-10-15 停服，本脚本只使用 V2：
 *   upload      POST https://chromewebstore.googleapis.com/upload/v2/publishers/{publisherId}/items/{itemId}:upload
 *   publish     POST https://chromewebstore.googleapis.com/v2/publishers/{publisherId}/items/{itemId}:publish
 *   fetchStatus GET  https://chromewebstore.googleapis.com/v2/publishers/{publisherId}/items/{itemId}:fetchStatus
 *
 * 环境变量：
 *   CWS_CLIENT_ID       OAuth 客户端 ID
 *   CWS_CLIENT_SECRET   OAuth 客户端密钥
 *   CWS_REFRESH_TOKEN   长期 refresh token（scope: chromewebstore）
 *   CWS_PUBLISHER_ID    开发者后台 Publisher > Settings 里的 ID
 *   CWS_EXTENSION_ID    32 位扩展 ID（= itemId）
 *
 * 用法：
 *   node scripts/cws-publish.mjs                       # 自动找 build 出的 zip，上传 + 提审
 *   node scripts/cws-publish.mjs --zip path/to/x.zip
 *   node scripts/cws-publish.mjs --status              # 只看状态，不上传
 *   node scripts/cws-publish.mjs --dry-run             # 只校验凭据 + 打印计划
 *   node scripts/cws-publish.mjs --upload-only         # 只上传，不提审
 *   node scripts/cws-publish.mjs --deploy-percentage 100  # 灰度（阶梯发布）覆盖
 */

import { appendFile, readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { readZipManifestVersion } from './lib/zip-version.mjs'

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CWS_API = 'https://chromewebstore.googleapis.com'
const CWS_SCOPE = 'https://www.googleapis.com/auth/chromewebstore'

const argv = process.argv.slice(2)
const hasFlag = (name) => argv.includes(`--${name}`)
const getOpt = (name, fallback = undefined) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}

const env = process.env
const CLIENT_ID = env.CWS_CLIENT_ID
const CLIENT_SECRET = env.CWS_CLIENT_SECRET
const REFRESH_TOKEN = env.CWS_REFRESH_TOKEN
const PUBLISHER_ID = env.CWS_PUBLISHER_ID
const EXTENSION_ID = env.CWS_EXTENSION_ID

const MODE_STATUS = hasFlag('status')
const DRY_RUN = hasFlag('dry-run')
const UPLOAD_ONLY = hasFlag('upload-only')
const DEPLOY_PERCENTAGE = getOpt('deploy-percentage')

const log = (...a) => console.log(...a)
const fail = (msg) => {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

/* ------------------------------------------------------------------ 凭据 */

function requireEnv() {
  const missing = Object.entries({
    CWS_CLIENT_ID: CLIENT_ID,
    CWS_CLIENT_SECRET: CLIENT_SECRET,
    CWS_REFRESH_TOKEN: REFRESH_TOKEN,
    CWS_PUBLISHER_ID: PUBLISHER_ID,
    CWS_EXTENSION_ID: EXTENSION_ID,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length) fail(`缺少环境变量: ${missing.join(', ')}`)
}

async function getAccessToken() {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: REFRESH_TOKEN,
    grant_type: 'refresh_token',
  })
  let res
  try {
    res = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  } catch (err) {
    fail(`连不上 ${OAUTH_TOKEN_URL}: ${err.message}\n` +
      `本机网络需要能直连 googleapis.com。若在本地被墙，改用 GitHub Actions（workflow 里已接好），` +
      `或配置 HTTPS_PROXY 后重试:\n  HTTPS_PROXY=http://127.0.0.1:7890 node scripts/cws-publish.mjs --status`)
  }
  const text = await res.text()
  if (!res.ok) {
    fail(`刷新 access token 失败 (${res.status}): ${text}\n` +
      `提示: refresh token 失效通常是因为 OAuth 应用还停留在 "Testing" 状态（约 7 天后过期）。\n` +
      `把 OAuth consent screen 的 Publishing status 改成 "In production"，重新取一次 refresh token。`)
  }
  const json = JSON.parse(text)
  if (!json.access_token) fail(`OAuth 响应里没有 access_token: ${text}`)
  log(`✓ access token 获取成功（scope: ${json.scope ?? CWS_SCOPE}）`)
  return json.access_token
}

/* ------------------------------------------------------------------ 工具 */

const itemName = () => `publishers/${PUBLISHER_ID}/items/${EXTENSION_ID}`

async function apiFetch(token, url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* 非 JSON 响应，保留 raw */
  }
  return { res, json, text }
}

async function findZip() {
  const explicit = getOpt('zip')
  if (explicit) return path.resolve(explicit)

  const root = process.cwd()
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  const candidates = []
  for (const dir of ['release', 'build', '.']) {
    const abs = path.join(root, dir)
    let entries = []
    try {
      entries = await readdir(abs)
    } catch {
      continue
    }
    for (const f of entries) {
      if (f.endsWith('.zip') && f.includes(pkg.version)) candidates.push(path.join(abs, f))
    }
  }
  if (candidates.length) return candidates[0]
  fail(`没找到版本 ${pkg.version} 的 zip。先跑 \`bun run build\`，或用 --zip 指定。`)
}

/* ------------------------------------------------------------------ 主流程 */

async function fetchStatus(token) {
  const { res, json, text } = await apiFetch(token, `${CWS_API}/v2/${itemName()}:fetchStatus`, { method: 'GET' })
  if (!res.ok) fail(`fetchStatus 失败 (${res.status}): ${text}`)
  return json
}

function summarizeStatus(json) {
  const pick = (rev) => {
    if (!rev) return '(无)'
    const ch = rev.distributionChannels ?? rev.distributionChannelsList ?? []
    const first = ch[0] ?? {}
    return `${rev.crxVersion ?? '?'} · ${rev.state ?? rev.status ?? '?'}` +
      (first.deployPercentage != null ? ` · ${first.deployPercentage}%` : '')
  }
  return {
    published: pick(json.publishedItemRevisionStatus),
    submitted: pick(json.submittedItemRevisionStatus),
  }
}

async function pollUpload(token, tries = 20, delayMs = 3000) {
  for (let i = 1; i <= tries; i++) {
    const s = await fetchStatus(token)
    const rev = s.submittedItemRevisionStatus
    const state = rev?.state ?? rev?.status ?? ''
    log(`  [${i}/${tries}] submitted -> ${summarizeStatus(s).submitted}`)
    if (!/IN_PROGRESS|UPLOADING/i.test(String(state))) return s
    await new Promise((r) => setTimeout(r, delayMs))
  }
  log('  ! 上传仍在处理中，稍后用 --status 复查')
  return null
}

/**
 * 校验构建产物：zip 存在、zip 内 manifest 版本 == package.json 版本 == tag（CI 下）
 * 返回 { zipPath, zipVersion, zipStat }
 */
async function validateBuild() {
  const zipPath = await findZip()
  const zipStat = await stat(zipPath)
  const zipVersion = (await readZipManifestVersion(zipPath)).version
  log(`  zip         : ${path.relative(process.cwd(), zipPath)} (${(zipStat.size / 1024 / 1024).toFixed(1)} MB)`)
  log(`  manifest    : ${zipVersion}`)

  const pkg = JSON.parse(await readFile(path.join(process.cwd(), 'package.json'), 'utf8'))
  const tag = (process.env.GITHUB_REF_NAME ?? '').replace(/^v/, '')
  if (pkg.version !== zipVersion) {
    fail(`package.json (${pkg.version}) 与 zip 内 manifest (${zipVersion}) 不一致，先重新构建。`)
  }
  if (tag && tag !== zipVersion) {
    fail(`tag ${tag} 与构建版本 ${zipVersion} 不一致。打 tag 前先改 package.json 并重新构建。`)
  }
  return { zipPath, zipVersion, zipStat }
}

async function main() {
  log('── Chrome Web Store 发布（API v2）──')

  if (hasFlag('check-build')) {
    const { zipPath, zipVersion } = await validateBuild()
    log(`\n✓ 构建产物自检通过: ${path.relative(process.cwd(), zipPath)} (manifest ${zipVersion})`)
    return
  }

  requireEnv()
  log(`  itemId      : ${EXTENSION_ID}`)
  log(`  publisherId : ${PUBLISHER_ID}`)

  const token = await getAccessToken()

  if (MODE_STATUS) {
    const s = await fetchStatus(token)
    const sum = summarizeStatus(s)
    log('\n当前状态：')
    log(`  Published : ${sum.published}`)
    log(`  Submitted : ${sum.submitted}`)
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY,
        `### Chrome Web Store 状态\n\n| 通道 | 版本 · 状态 |\n|---|---|\n| Published | ${sum.published} |\n| Submitted | ${sum.submitted} |\n`)
    }
    return
  }

  const { zipPath, zipVersion } = await validateBuild()

  const before = await fetchStatus(token)
  const beforeSum = summarizeStatus(before)
  log(`  商店现状    : published=${beforeSum.published} / submitted=${beforeSum.submitted}`)

  if (DRY_RUN) {
    log('\n[dry-run] 凭据可用，跳过上传与提审。')
    return
  }

  /* ---- 1. 上传 ---- */
  log('\n1) 上传 zip …')
  const uploadUrl = `${CWS_API}/upload/v2/${itemName()}:upload`
  const zipBuf = await readFile(zipPath)
  let up = await apiFetch(token, uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/zip' },
    body: zipBuf,
  })
  if (!up.res.ok) {
    // 部分环境需要显式 uploadType=media
    log(`  首次上传返回 ${up.res.status}，改用 uploadType=media 重试…`)
    up = await apiFetch(token, `${uploadUrl}?uploadType=media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/zip' },
      body: zipBuf,
    })
  }
  if (!up.res.ok) fail(`上传失败 (${up.res.status}): ${up.text}`)

  const crxVersion = up.json?.crxVersion
  const uploadState = up.json?.uploadState
  log(`  uploadState=${uploadState ?? '?'} crxVersion=${crxVersion ?? '(处理中)'}`)
  if (crxVersion && crxVersion !== zipVersion) {
    fail(`商店识别到的版本 ${crxVersion} ≠ 期望 ${zipVersion}`)
  }
  if (String(uploadState).includes('IN_PROGRESS')) {
    log('  轮询上传状态…')
    await pollUpload(token)
  }

  if (UPLOAD_ONLY) {
    log('\n✓ 已上传（未提审），可在开发者后台手动点「提交审核」。')
    return
  }

  /* ---- 2. 提审 ---- */
  log('\n2) 提交审核 …')
  const publishBody = {
    publishType: 'DEFAULT_PUBLISH',
    skipReview: false,
    blockOnWarnings: false,
  }
  if (DEPLOY_PERCENTAGE) publishBody.deployInfos = [{ deployPercentage: Number(DEPLOY_PERCENTAGE) }]

  const pub = await apiFetch(token, `${CWS_API}/v2/${itemName()}:publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(publishBody),
  })
  if (!pub.res.ok) {
    const detail = pub.json?.error?.details?.map((d) => d.warningInfo ?? d).slice?.(0) ?? pub.text
    fail(`提审失败 (${pub.res.status}): ${JSON.stringify(detail)}\n` +
      `常见原因: manifest 版本已存在 / 商店 listing 有未填字段 / 权限变更需人工确认。`)
  }
  log(`  publish -> state=${pub.json?.state ?? '?'}`)
  for (const w of pub.json?.warningInfo?.warnings ?? []) {
    log(`  ⚠ ${w.reason}: ${w.description}`)
  }

  /* ---- 3. 汇报 ---- */
  const after = await fetchStatus(token)
  const afterSum = summarizeStatus(after)
  log('\n── 完成 ──')
  log(`  Published : ${afterSum.published}`)
  log(`  Submitted : ${afterSum.submitted}  ← 审核通过后自动转为 Published`)

  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      [
        `### Chrome Web Store 已提交 ${zipVersion}`,
        '',
        '| 项 | 值 |',
        '|---|---|',
        `| 版本 | ${zipVersion} |`,
        `| 上传状态 | ${uploadState ?? 'UPLOAD_SUCCEEDED'} |`,
        `| 提审状态 | ${pub.json?.state ?? 'unknown'} |`,
        `| 提审前 | ${beforeSum.published} |`,
        `| 当前 published | ${afterSum.published} |`,
        `| 当前 submitted | ${afterSum.submitted} |`,
        '',
        `> 审核通常几分钟到几天。状态复查: \`CWS_... node scripts/cws-publish.mjs --status\``,
      ].join('\n'),
    )
  }
}

main().catch((err) => fail(err?.stack ?? String(err)))