/**
 * Skill-management core of capability-core: install/list/uninstall/edit over
 * the dsh skill roots (global `$DSH_HOME/skills`, project `<root>/.agents/skills`),
 * SKILL.md frontmatter validation (docs/06-skill-standard §2), and the
 * market-manifest reader (docs/06-skill-standard §6).
 *
 * @module @bc-agent/capability-core/skill-core
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { homedir } from 'node:os'

/** Resolve the effective DSH home (per-brand dir when DSH_HOME is set). */
export function dshHome(): string {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

// ---------------------------------------------------------------------------
// frontmatter validation (docs/06-skill-standard §2)
// ---------------------------------------------------------------------------

/** Read one single-line frontmatter field (`key: value`, optional quotes). */
export function skillField(text: string, key: string): string | undefined {
  const m = new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm').exec(text)
  return m?.[1]?.trim() || undefined
}

/** Kebab-case check (upstream skill-name grammar). */
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Validate a SKILL.md document against the standard's mandatory frontmatter:
 * a `---` fenced block carrying a kebab-case `name` and a non-empty
 * `description`. Returns the parsed metadata, or undefined when invalid.
 * @param text - full SKILL.md text.
 * @returns the parsed metadata, or undefined.
 */
export function validateSkillText(text: string):
  | { name: string; description: string; whenToUse: string | undefined; modelInvocable: boolean }
  | undefined {
  const lines = text.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return undefined
  let close = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i]!.trim() === '---') { close = i; break }
  }
  if (close < 0) return undefined
  const block = lines.slice(1, close).join('\n')
  const name = skillField(block, 'name')
  const description = skillField(block, 'description')
  if (name === undefined || !KEBAB.test(name)) return undefined
  if (description === undefined || description.trim() === '') return undefined
  const whenToUse = skillField(block, 'whenToUse')
  const modelInvocable = !/^disable-model-invocation:\s*(true|yes|on|1)\s*$/im.test(block)
  return { name, description, whenToUse, modelInvocable }
}

/** Extract the skill name from SKILL.md frontmatter (`name:`), else the dir basename. */
export function skillNameFrom(dir: string): string {
  const md = join(dir, 'SKILL.md')
  if (!existsSync(md)) return basename(dir)
  return skillField(readFileSync(md, 'utf8'), 'name') || basename(dir)
}

// ---------------------------------------------------------------------------
// installed-skill enumeration
// ---------------------------------------------------------------------------

/** One parsed installed skill (SKILL.md metadata + install scope + on-disk path). */
export interface InstalledSkillRow {
  name: string
  description: string
  whenToUse: string | undefined
  modelInvocable: boolean
  scope: 'global' | 'project'
  workspacePath: string | undefined
  installedPath: string
}

/** Parse one installed skill directory; undefined when it carries no valid SKILL.md. */
export function skillInfoFrom(dir: string): Omit<InstalledSkillRow, 'scope' | 'workspacePath' | 'installedPath'> | undefined {
  const md = join(dir, 'SKILL.md')
  if (!existsSync(md)) return undefined
  const text = readFileSync(md, 'utf8')
  const meta = validateSkillText(text)
  if (meta === undefined) {
    // Unparseable frontmatter still lists (name falls back to the dir name,
    // description empty) — the page surfaces the row so the user can fix it.
    return { name: basename(dir), description: '', whenToUse: undefined, modelInvocable: true }
  }
  return { name: meta.name, description: meta.description, whenToUse: meta.whenToUse, modelInvocable: meta.modelInvocable }
}

/** Immediate subdirectories of a skill root (missing root → no entries). */
function listSkillDirs(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(root, entry.name))
}

/** Resolve the install root for a global/project target. */
export function skillTargetDir(scope: 'global' | 'project', workspacePath: string | undefined): string {
  return scope === 'global' ? join(dshHome(), 'skills') : join(workspacePath as string, '.agents', 'skills')
}

/** Install a local skill directory (validated) into the target root. */
export function installSkill(payload: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  const p = payload as { sourcePath?: string; target?: string; workspacePath?: string }
  if (typeof p.sourcePath !== 'string' || p.sourcePath.trim() === '') return badRequest('skills.install requires sourcePath')
  if (p.target !== 'global' && p.target !== 'project') return badRequest('skills.install requires target "global" | "project"')
  if (p.target === 'project' && (typeof p.workspacePath !== 'string' || p.workspacePath.trim() === '')) {
    return badRequest('skills.install project target requires workspacePath')
  }
  const md = join(p.sourcePath, 'SKILL.md')
  if (!existsSync(md)) return badRequest(`no SKILL.md found under ${p.sourcePath}`)
  const text = readFileSync(md, 'utf8')
  const meta = validateSkillText(text)
  if (meta === undefined) {
    return badRequest('invalid SKILL.md frontmatter: name (kebab-case) and description are required (docs/06-skill-standard)')
  }
  const name = meta.name
  const targetDir = skillTargetDir(p.target, p.workspacePath)
  const installedPath = join(targetDir, name)
  mkdirSync(targetDir, { recursive: true })
  // Re-upload of the same skill overwrites the existing directory (先删再加).
  rmSync(installedPath, { recursive: true, force: true })
  cpSync(p.sourcePath, installedPath, { recursive: true })
  return { ok: true, value: { ok: true, name, installedPath } }
}

/**
 * Copy one installed skill to another install root (no source removal).
 * Used by the multi-target edit flow: the source is already an installed,
 * validated skill, so the copy skips frontmatter re-validation (which would
 * reject a skill whose description was rewritten by `editSkill` into a format
 * `validateSkillText` cannot re-parse, e.g. one containing double quotes).
 */
export function copySkill(payload: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  const p = payload as { name?: string; fromScope?: string; fromWorkspacePath?: string; toScope?: string; toWorkspacePath?: string }
  const from = skillAddress(p.name, p.fromScope, p.fromWorkspacePath)
  if (!from.ok) return from
  const to = skillAddress(p.name, p.toScope, p.toWorkspacePath)
  if (!to.ok) return to
  const name = p.name!.trim()
  const fromDir = join(from.targetDir, name)
  const toDir = join(to.targetDir, name)
  if (!existsSync(join(fromDir, 'SKILL.md'))) return badRequest('skill copy source has no SKILL.md')
  if (from.targetDir === to.targetDir) return { ok: true, value: { ok: true, name, installedPath: toDir } }
  mkdirSync(to.targetDir, { recursive: true })
  rmSync(toDir, { recursive: true, force: true })
  cpSync(fromDir, toDir, { recursive: true })
  return { ok: true, value: { ok: true, name, installedPath: toDir } }
}

/**
 * Move one installed skill between install roots — the "edit install location"
 * action (global ⇄ a project's `.agents/skills`). Copies the directory to the
 * target root (overwriting an existing same-name skill there), then removes
 * the source. A no-op when the two roots coincide.
 */
export function moveSkill(payload: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  const p = payload as { name?: string; fromScope?: string; fromWorkspacePath?: string; toScope?: string; toWorkspacePath?: string }
  const from = skillAddress(p.name, p.fromScope, p.fromWorkspacePath)
  if (!from.ok) return from
  const to = skillAddress(p.name, p.toScope, p.toWorkspacePath)
  if (!to.ok) return to
  const name = p.name!.trim()
  const fromDir = join(from.targetDir, name)
  const toDir = join(to.targetDir, name)
  if (!existsSync(join(fromDir, 'SKILL.md'))) return badRequest('skill move source has no SKILL.md')
  if (from.targetDir === to.targetDir) return { ok: true, value: { ok: true, name, installedPath: toDir } }
  mkdirSync(to.targetDir, { recursive: true })
  rmSync(toDir, { recursive: true, force: true })
  cpSync(fromDir, toDir, { recursive: true })
  rmSync(fromDir, { recursive: true, force: true })
  return { ok: true, value: { ok: true, name, installedPath: toDir } }
}

/** Validate a skill edit/uninstall address and return its target dir (or a badRequest result). */
export function skillAddress(name: string | undefined, scope: string | undefined, workspacePath: string | undefined):
  | { ok: true; targetDir: string }
  | { ok: false; error: unknown } {
  if (typeof name !== 'string' || name.trim() === '') return badRequest('skill operation requires name')
  if (scope !== 'global' && scope !== 'project') return badRequest('skill operation requires scope "global" | "project"')
  if (scope === 'project' && (typeof workspacePath !== 'string' || workspacePath.trim() === '')) {
    return badRequest('skill operation with project scope requires workspacePath')
  }
  const targetDir = skillTargetDir(scope, workspacePath)
  if (dirname(join(targetDir, name.trim())) !== targetDir) return badRequest('skill operation name must be a single path segment')
  return { ok: true, targetDir }
}

/** List installed skills across the global root and the given project roots. */
export function listSkills(payload: unknown, includeGlobal = true): { ok: true; value: unknown } {
  const p = payload as { workspacePaths?: unknown }
  const paths = Array.isArray(p.workspacePaths)
    ? p.workspacePaths.filter((item): item is string => typeof item === 'string')
    : []
  const rows: InstalledSkillRow[] = []
  if (includeGlobal) {
    for (const dir of listSkillDirs(join(dshHome(), 'skills'))) {
      const info = skillInfoFrom(dir)
      if (info !== undefined) rows.push({ ...info, scope: 'global', workspacePath: undefined, installedPath: dir })
    }
  }
  for (const workspacePath of paths) {
    for (const dir of listSkillDirs(join(workspacePath, '.agents', 'skills'))) {
      const info = skillInfoFrom(dir)
      if (info !== undefined) rows.push({ ...info, scope: 'project', workspacePath, installedPath: dir })
    }
  }
  rows.sort((a, b) => a.name.localeCompare(b.name))
  return { ok: true, value: { ok: true, skills: rows } }
}

/** Remove one installed skill directory. */
export function uninstallSkill(payload: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  const p = payload as { name?: string; scope?: string; workspacePath?: string }
  const address = skillAddress(p.name, p.scope, p.workspacePath)
  if (!address.ok) return address
  rmSync(join(address.targetDir, p.name!.trim()), { recursive: true, force: true })
  return { ok: true, value: { ok: true } }
}

/** YAML-safe single-line scalar for a frontmatter rewrite. */
function yamlScalar(value: string): string {
  const single = value.replace(/\r?\n/g, ' ').trim()
  return /^[A-Za-z0-9_./,()\- \u4e00-\u9fff]+$/.test(single) && !single.includes('#') ? single : JSON.stringify(single)
}

/** Set a single-line frontmatter field in place, inserting it after `name:` when absent. */
function setFrontmatterField(raw: string, key: string, value: string): string {
  const lines = raw.split('\n')
  const line = (i: number): string => lines[i] ?? ''
  if (line(0).replace(/\r$/, '') !== '---') return raw
  let close = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (line(i).replace(/\r$/, '') === '---') { close = i; break }
  }
  if (close < 0) return raw
  const field = new RegExp(`^${key}:`)
  for (let i = 1; i < close; i += 1) {
    if (field.test(line(i).replace(/\r$/, ''))) {
      lines[i] = `${key}: ${yamlScalar(value)}`
      return lines.join('\n')
    }
  }
  let insertAt = close
  for (let i = 1; i < close; i += 1) {
    if (/^name:/.test(line(i).replace(/\r$/, ''))) { insertAt = i + 1; break }
  }
  lines.splice(insertAt, 0, `${key}: ${yamlScalar(value)}`)
  return lines.join('\n')
}

/** Rewrite one installed skill's description frontmatter field. */
export function editSkill(payload: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  const p = payload as { name?: string; scope?: string; workspacePath?: string; description?: string }
  const address = skillAddress(p.name, p.scope, p.workspacePath)
  if (!address.ok) return address
  const md = join(address.targetDir, p.name!.trim(), 'SKILL.md')
  if (!existsSync(md)) return badRequest('skill operation target has no SKILL.md')
  const raw = readFileSync(md, 'utf8')
  writeFileSync(md, setFrontmatterField(raw, 'description', typeof p.description === 'string' ? p.description : ''))
  return { ok: true, value: { ok: true } }
}

// ---------------------------------------------------------------------------
// market manifest (docs/06-skill-standard §6)
// ---------------------------------------------------------------------------

/** One market manifest entry. */
export interface MarketEntry {
  id: string
  name: string
  description: string
  whenToUse?: string
  source: { type: 'github'; repo: string; ref: string; path: string }
  tags?: string[]
  license?: string
}

/** The market manifest shape (version + entries). */
export interface MarketManifest {
  version: number
  skills: MarketEntry[]
}

/**
 * Read the bundled market manifest (`lib/skills-market.json`, copied from
 * `market/skills-market.json` at build). Missing/unparsable → empty market
 * (fail-soft; the market page degrades to an empty state, never crashes).
 * @returns the parsed manifest.
 */
export function readMarketManifest(): MarketManifest {
  try {
    const url = new URL('./skills-market.json', import.meta.url)
    const raw = readFileSync(url, 'utf8')
    const parsed = JSON.parse(raw) as Partial<MarketManifest>
    if (!Array.isArray(parsed.skills)) return { version: 1, skills: [] }
    const entries = parsed.skills.filter((entry): entry is MarketEntry =>
      typeof entry?.id === 'string'
      && typeof entry?.name === 'string'
      && entry?.source?.type === 'github'
      && typeof entry.source.repo === 'string'
      && typeof entry.source.ref === 'string'
      && typeof entry.source.path === 'string')
    return { version: typeof parsed.version === 'number' ? parsed.version : 1, skills: entries }
  } catch {
    return { version: 1, skills: [] }
  }
}

/** Business error in the envelope's documented shape. */
export function badRequest(message: string): { ok: false; error: { code: string; message: string; details: { issues: [] } } } {
  return { ok: false, error: { code: 'bad-request', message, details: { issues: [] } } }
}
