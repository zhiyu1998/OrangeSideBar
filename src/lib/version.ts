import pkg from '../../package.json'

export type VersionInfo = {
  current: string
  latest: string | null
  updateAvailable: boolean
}

function stripV(version: string): string {
  return version.trim().replace(/^v/i, '')
}

function parseNumericSemver(version: string): { major: number; minor: number; patch: number; prerelease: boolean } | null {
  const cleaned = stripV(version)
  const [core, prerelease] = cleaned.split('-', 2)
  const parts = core.split('.')

  const major = Number(parts[0] ?? NaN)
  const minor = Number(parts[1] ?? 0)
  const patch = Number(parts[2] ?? 0)

  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) return null

  return {
    major,
    minor,
    patch,
    prerelease: Boolean(prerelease),
  }
}

export function formatVersion(version: string): string {
  const cleaned = stripV(version)
  return cleaned ? `v${cleaned}` : 'v0.0.0'
}

export function getCurrentVersion(): string {
  return formatVersion(pkg.version)
}

export function compareVersions(a: string, b: string): number {
  const pa = parseNumericSemver(a)
  const pb = parseNumericSemver(b)
  if (!pa || !pb) return 0

  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1

  // Prerelease is considered lower than stable when core numbers equal
  if (pa.prerelease !== pb.prerelease) return pa.prerelease ? -1 : 1

  return 0
}

export function isUpdateAvailable(current: string, latest: string | null): boolean {
  if (!latest) return false
  return compareVersions(latest, current) > 0
}

/**
 * Fetches the latest release tag from the OrangeSideBar GitHub repository.
 * Returns a formatted version like "v2.0.0", or null if unavailable.
 */
export async function getLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch('https://api.github.com/repos/zhiyu1998/OrangeSideBar/releases/latest')
    if (!response.ok) return null
    const data = await response.json()
    const tag = typeof data?.tag_name === 'string' ? data.tag_name : ''
    return tag ? formatVersion(tag) : null
  } catch (error) {
    console.error('Error fetching latest version:', error)
    return null
  }
}

export async function getVersionInfo(): Promise<VersionInfo> {
  const current = getCurrentVersion()
  const latest = await getLatestVersion()
  return {
    current,
    latest,
    updateAvailable: isUpdateAvailable(current, latest),
  }
}
