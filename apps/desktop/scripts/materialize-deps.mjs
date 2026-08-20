/**
 * 依赖物化（P1-0，P0-5 §4.3 分发 + 参考项目 hoisted 语义的替代）：把
 * apps/desktop 的顶层 production 依赖闭包从 pnpm store **扁平物化为真实目录**
 * 到 staging（仓库外），electron-builder 从 staging 收集。
 *
 * 为什么需要：electron-builder 26 的 npm collector 对 pnpm 隔离布局（symlink +
 * .pnpm 虚拟根 + platform 预编译包）**系统性漏收集**——dsh 闭包成员
 * （@img/colour、@koromix/koffi-win32-x64、@img/sharp-win32-x64 等）被打包后
 * 缺失，packaged 启动 fail-loud。物化后 staging 的 node_modules 是真实扁平目录
 * （无 symlink），npm collector 能完整收集。
 *
 * 策略：BFS 遍历闭包（dependencies + optionalDependencies），每个包从父包的
 * pnpm store 嵌套 node_modules 解析真实路径，**扁平**复制（排除 node_modules，
 * 每包一次到 staging/node_modules 顶层）。staging 是 hoisted 语义的扁平真实树。
 * @module desktop/scripts/materialize-deps
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** pnpm 虚拟根：被 hoist 的共享依赖（@scope 包、platform 预编译包等）放这。 */
function virtualRootOf(desktopDir) {
  return join(desktopDir, '..', '..', 'node_modules', '.pnpm', 'node_modules')
}

/** 从多个候选位置解析包的 store 真实路径（父嵌套 → 虚拟根）。 */
function resolvePackage(fromDir, virtualRoot, segments) {
  try { return realpathSync(join(fromDir, ...segments)) } catch { /* fallthrough */ }
  try { return realpathSync(join(virtualRoot, ...segments)) } catch { /* fallthrough */ }
  return undefined
}

/** 从 package.json 读全部依赖键（dependencies + optionalDependencies）。 */
function allDeps(pkgJson) {
  return new Set([
    ...Object.keys(pkgJson.dependencies ?? {}),
    ...Object.keys(pkgJson.optionalDependencies ?? {}),
  ])
}

/** 复制一个 store 包目录（扁平：排除 node_modules，嵌套依赖由 BFS 顶层处理）。 */
function copyPackageFlat(realDir, target) {
  mkdirSync(target, { recursive: true })
  for (const entry of readdirSync(realDir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue
    cpSync(join(realDir, entry.name), join(target, entry.name), { recursive: true, dereference: true })
  }
}

/**
 * 物化 apps/desktop 顶层依赖闭包到 staging/node_modules（扁平真实目录）。
 * @param options - desktopDir（apps/desktop）+ stagingDir（仓库外 staging 根）。
 */
export function materializeDeps(options) {
  const desktopDir = options.desktopDir
  const stagingNm = join(options.stagingDir, 'node_modules')
  const pkgJson = JSON.parse(readFileSync(join(desktopDir, 'package.json'), 'utf8'))

  const seen = new Set()
  let count = 0
  const virtualRoot = virtualRootOf(desktopDir)
  // fromDir 统一为「node_modules 层」：顶层 = desktopDir/node_modules，
  // 传递依赖 = 父包的 store node_modules 层（dirname(real)，pnpm 把嵌套依赖
  // symlink 放那）；解析不到再回退虚拟根。
  const queue = [...allDeps(pkgJson)].map(name => ({ name, fromDir: join(desktopDir, 'node_modules') }))
  while (queue.length > 0) {
    const item = queue.shift()
    if (item === undefined || seen.has(item.name)) continue
    seen.add(item.name)
    const segments = item.name.split('/')
    const real = resolvePackage(item.fromDir, virtualRoot, segments)
    if (real === undefined) continue
    if (!existsSync(join(real, 'package.json'))) continue
    copyPackageFlat(real, join(stagingNm, ...segments))
    count += 1
    const deps = JSON.parse(readFileSync(join(real, 'package.json'), 'utf8'))
    // pnpm 布局：包的嵌套依赖 symlink 在 store 的 node_modules 层（dirname(real)），
    // 不在包目录内——后续依赖从该层解析。
    for (const dep of allDeps(deps)) queue.push({ name: dep, fromDir: dirname(real) })
  }

  process.stderr.write(`desktop: materialized ${count} packages into staging node_modules\n`)
  return count
}
