/**
 * Skill-market half of capability-core: the bundled market manifest
 * (`market/skills-market.json`, copied to `lib/skills-market.json` at build)
 * plus GitHub-backed install (`skills.market.install`).
 *
 * Install flow: resolve the manifest entry → fetch the skill directory's file
 * list via the GitHub git-trees API → download every file raw → validate the
 * fetched SKILL.md against docs/06-skill-standard §2 (frontmatter name +
 * description mandatory) → write into the chosen skill root (global or
 * project `.agents/skills`) keyed by the entry id. Any failure aborts before
 * anything is written (no partial installs).
 *
 * The manifest is the config standard (docs/06-skill-standard §6): entries
 * are plain data, so adding a skill = one JSON object; the fetch/validate
 * path is shared by every entry. Loopback-only authority inherited from the
 * /ext channel (iron rule 6); outbound GitHub fetches are user-initiated.
 *
 * @module @bc-agent/capability-core/market
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { validateSkillText, type MarketEntry } from './skill-core.ts'

/** GitHub API base (public, unauthenticated; rate-limited at 60 req/h). */
const GITHUB_API = 'https://api.github.com'
/** Raw file host (no rate limit tied to the API quota). */
const GITHUB_RAW = 'https://raw.githubusercontent.com'
/** One shared UA so GitHub never sees a bare undici default. */
const UA = { 'User-Agent': 'bc-agent-desktop' }

/** The git-tree entry shape GitHub returns (only kind/path are consumed). */
interface GitHubTreeEntry { path: string; type: 'blob' | 'tree' | 'commit' }

/** One fetched skill file (relative path within the skill dir → bytes). */
export interface FetchedSkillFile { path: string; data: Uint8Array }

/**
 * Fetch the file list of a directory inside a GitHub repo (recursive tree,
 * filtered to blobs under the given path prefix).
 * @param repo - `owner/repo`.
 * @param ref - branch/tag/commit.
 * @param path - directory path inside the repo.
 * @returns the blob paths (repo-relative).
 */
export async function listGitHubDir(repo: string, ref: string, path: string): Promise<string[]> {
  const url = `${GITHUB_API}/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`
  const response = await fetch(url, { headers: UA })
  if (!response.ok) {
    throw new Error(`market: GitHub tree ${repo}@${ref} failed: HTTP ${response.status}`)
  }
  const body = await response.json() as { tree?: GitHubTreeEntry[]; truncated?: boolean; message?: string }
  if (body.message !== undefined) throw new Error(`market: GitHub tree ${repo}@${ref}: ${body.message}`)
  if (body.truncated === true) throw new Error(`market: GitHub tree ${repo}@${ref} is truncated`)
  const prefix = path.replace(/^\/+|\/+$/g, '')
  const files = (body.tree ?? [])
    .filter(entry => entry.type === 'blob')
    .map(entry => entry.path)
    .filter(file => prefix === '' ? true : file.startsWith(`${prefix}/`))
  if (files.length === 0) throw new Error(`market: no files under ${repo}@${ref}/${path}`)
  return files
}

/**
 * Download one raw file from a repo.
 * @param repo - `owner/repo`.
 * @param ref - branch/tag/commit.
 * @param filePath - repo-relative file path.
 * @returns the raw bytes.
 */
export async function fetchRawFile(repo: string, ref: string, filePath: string): Promise<Uint8Array> {
  const url = `${GITHUB_RAW}/${repo}/${ref}/${filePath}`
  const response = await fetch(url, { headers: UA })
  if (!response.ok) throw new Error(`market: raw ${repo}/${filePath} failed: HTTP ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

/**
 * Fetch a whole skill directory from GitHub into memory.
 * @param source - the manifest entry's source (repo/ref/path).
 * @returns the relative-path → bytes map, with `SKILL.md` guaranteed present.
 */
export async function fetchSkillDir(source: { repo: string; ref: string; path: string }): Promise<Map<string, Uint8Array>> {
  const files = await listGitHubDir(source.repo, source.ref, source.path)
  const out = new Map<string, Uint8Array>()
  for (const file of files) {
    const relative = file.slice(source.path.replace(/^\/+|\/+$/g, '').length).replace(/^\/+/, '')
    out.set(relative, await fetchRawFile(source.repo, source.ref, file))
  }
  if (!out.has('SKILL.md')) throw new Error(`market: fetched skill has no SKILL.md (${source.repo}@${source.ref}/${source.path})`)
  return out
}

/**
 * Install a market entry: fetch + validate + write into the target root.
 * @param entry - the manifest entry.
 * @param targetDir - the install root (global `$DSH_HOME/skills` or project `.agents/skills`).
 * @returns the installed skill name + path.
 */
export async function installMarketEntry(entry: MarketEntry, targetDir: string): Promise<{ name: string; installedPath: string }> {
  const files = await fetchSkillDir(entry.source)
  const skillText = new TextDecoder().decode(files.get('SKILL.md'))
  const meta = validateSkillText(skillText)
  if (meta === undefined) throw new Error(`market: ${entry.id} has invalid SKILL.md frontmatter (name/description required)`)
  const installedPath = join(targetDir, entry.id)
  mkdirSync(installedPath, { recursive: true })
  for (const [relative, data] of files) {
    // Path containment guard: a manifest/fetch must never write outside the
    // install dir (reject traversal segments and absolute spellings).
    if (relative.includes('..') || relative.startsWith('/') || relative.startsWith('\\')) {
      throw new Error(`market: ${entry.id} contains an unsafe path: ${relative}`)
    }
    const target = join(installedPath, relative)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, data)
  }
  return { name: meta.name, installedPath }
}
