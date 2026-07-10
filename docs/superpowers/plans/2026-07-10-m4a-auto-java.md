# M4a — Auto-Java Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When no suitable system Java is found, download a Java 21 JRE automatically (Mojang-parity, via `@xmcl/installer`) and launch the game with it, instead of failing.

**Architecture:** A pure, dependency-injected wrapper (`ensureManagedJava`) owns the logic (component selection, idempotent caching, post-install validation) and is fully unit-tested with fake deps. A thin real adapter wires `@xmcl/installer` and is verified manually. Integration point is the existing `detectJava` failure branch in `launch/index.ts`. Download progress rides the existing `play:progress` channel via a new `PlayState` phase.

**Tech Stack:** Electron + electron-vite + React + TypeScript. Native `node:test` runner (`npm test`), tests import source with `.ts` extensions. MCLC stays; `@xmcl/installer` is used as a library only.

## Global Constraints

- Keep `minecraft-launcher-core` for launch — do NOT migrate to `@xmcl`.
- System Java takes priority; managed JRE is only a fallback. `PACK_JAVA_PATH` / `JAVA_HOME` must still win.
- Required Java major comes from `manifest.java?.major`, falling back to `MIN_JAVA` (21).
- Managed JRE lives at `userData/runtime/<component>` (sibling of `userData/instance`).
- Component mapping: `21 → java-runtime-delta`, `17 → java-runtime-gamma`, `8 → jre-legacy`.
- New code targets ≥80% coverage; every pure unit is tested with injected deps (no network in unit tests).
- Never launch the game with an unvalidated/broken JRE — abort with a clear message instead.
- Test style: `import { test } from 'node:test'` + `import assert from 'node:assert/strict'`; source imports use explicit `.ts`.
- Commit message format: `<type>: <description>` (feat/fix/refactor/test/chore).

---

### Task 1: Initialize git repository

The project is not yet a git repo, but the TDD flow commits after every task. This task establishes git locally. It does NOT create or push to any remote (that is Plan M4b, and is user-gated).

**Files:**
- Create: `.gitignore`

- [ ] **Step 1: Create `.gitignore`**

Create `/home/teodoro/emigreteStudiosLuncher/.gitignore`:

```gitignore
node_modules/
out/
release/
dist/
*.log
.DS_Store
# JRE gestionado y datos de instancia se guardan en userData, no en el repo.
```

- [ ] **Step 2: Initialize the repo on a feature branch**

Run:
```bash
cd /home/teodoro/emigreteStudiosLuncher
git init
git checkout -b m4-auto-java
git add -A
git commit -m "chore: baseline commit before M4 (auto-java + auto-updater)"
```
Expected: repo initialized, one baseline commit on branch `m4-auto-java`.

---

### Task 2: Generalize `detectJava` to accept a required major

**Files:**
- Modify: `src/main/services/launch/java.ts:45-56`
- Test: `test/launch-java.test.ts`

**Interfaces:**
- Consumes: existing `MIN_JAVA`, `parseJavaMajor`, `execJavaVersion`.
- Produces: `detectJava(candidates, run?, requiredMajor?): Promise<JavaInfo | null>` — `requiredMajor` is the THIRD, optional param (default `MIN_JAVA`) so existing 2-arg calls keep working.

- [ ] **Step 1: Write the failing test**

Append to `test/launch-java.test.ts`:

```ts
test('detectJava respeta un requiredMajor explícito (17 acepta 17)', async () => {
  const run = async (): Promise<{ ok: boolean; output: string }> => ({ ok: true, output: 'openjdk version "17.0.9"' })
  assert.deepEqual(await detectJava(['x'], run, 17), { path: 'x', major: 17 })
})

test('detectJava con requiredMajor 25 rechaza un Java 21', async () => {
  const run = async (): Promise<{ ok: boolean; output: string }> => ({ ok: true, output: 'openjdk version "21.0.2"' })
  assert.equal(await detectJava(['x'], run, 25), null)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="requiredMajor"`
Expected: FAIL — the 17 case returns `null` because `detectJava` still compares against `MIN_JAVA` (21).

- [ ] **Step 3: Implement the change**

In `src/main/services/launch/java.ts`, change the `detectJava` signature and comparison:

```ts
/** Devuelve el primer candidato que sea Java >= requiredMajor, o null. */
export async function detectJava(
  candidates: readonly string[],
  run: JavaRunner = execJavaVersion,
  requiredMajor: number = MIN_JAVA
): Promise<JavaInfo | null> {
  const tried = new Set<string>()
  for (const path of candidates) {
    if (!path || tried.has(path)) continue
    tried.add(path)
    const { ok, output } = await run(path)
    if (!ok) continue
    const major = parseJavaMajor(output)
    if (major !== null && major >= requiredMajor) return { path, major }
  }
  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all existing java tests + the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/main/services/launch/java.ts test/launch-java.test.ts
git commit -m "refactor: detectJava accepts an explicit requiredMajor"
```

---

### Task 3: Add a `downloading-java` phase to `PlayState`

**Files:**
- Modify: `src/shared/play.ts`
- Test: `test/play-state.test.ts`

**Interfaces:**
- Produces: `PlayState` union gains `{ phase: 'downloading-java'; percent: number }`. `playLabel`, `playPercent` handle it; `isPlayBusy` returns `true` for it.

- [ ] **Step 1: Write the failing test**

Append to `test/play-state.test.ts` (imports there already pull `playLabel`, `playPercent`, `isPlayBusy` from `../src/shared/play.ts` — reuse them):

```ts
test('downloading-java: label muestra el porcentaje y cuenta como ocupado', () => {
  const s = { phase: 'downloading-java', percent: 40 } as const
  assert.equal(playLabel(s, true), 'JAVA 40%')
  assert.equal(playPercent(s), 40)
  assert.equal(isPlayBusy(s), true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="downloading-java"`
Expected: FAIL — TypeScript/type error or wrong label, because the phase does not exist yet.

- [ ] **Step 3: Implement the change**

In `src/shared/play.ts`, add the phase to the union (after `preparing`):

```ts
export type PlayState =
  | { phase: 'idle' }
  | { phase: 'syncing'; sync: SyncProgress }
  | { phase: 'preparing' } // detectando Java
  | { phase: 'downloading-java'; percent: number } // bajando el JRE gestionado
  | { phase: 'installing-loader' }
  | { phase: 'launching'; loader?: LoaderProgress }
  | { phase: 'running' }
  | { phase: 'error'; message: string }
```

Add a `case` in `playLabel` (before `installing-loader`):

```ts
    case 'downloading-java':
      return `JAVA ${Math.round(state.percent)}%`
```

Add a `case` in `playPercent` (before `launching`):

```ts
    case 'downloading-java':
      return state.percent
```

`isPlayBusy` already returns `true` for any phase other than `idle`/`error`, so it needs no change.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` then `npm run typecheck`
Expected: PASS and clean typecheck.

- [ ] **Step 5: Commit**

```bash
git add src/shared/play.ts test/play-state.test.ts
git commit -m "feat: add downloading-java phase to PlayState"
```

---

### Task 4: Add `runtimeDir()` helper

**Files:**
- Modify: `src/main/services/pack/index.ts` (next to `instanceDir()`)

**Interfaces:**
- Produces: `runtimeDir(): string` → `join(app.getPath('userData'), 'runtime')`.

- [ ] **Step 1: Read the existing helper**

Run: `grep -n "instanceDir" src/main/services/pack/index.ts`
Confirm `instanceDir()` uses `app.getPath('userData')`. Match its exact style.

- [ ] **Step 2: Add `runtimeDir`**

In `src/main/services/pack/index.ts`, directly below `instanceDir`, add:

```ts
/** Raíz del JRE gestionado (hermano de la instancia): userData/runtime. */
export function runtimeDir(): string {
  return join(app.getPath('userData'), 'runtime')
}
```

(Reuse the file's existing `app` and `join` imports; do not re-import.)

- [ ] **Step 3: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/services/pack/index.ts
git commit -m "feat: add runtimeDir() for the managed JRE"
```

---

### Task 5: `ensureManagedJava` wrapper (pure, injected deps)

**Files:**
- Create: `src/main/services/launch/java-runtime.ts`
- Test: `test/launch-java-runtime.test.ts`

**Interfaces:**
- Consumes: `join` from `node:path`.
- Produces:
  - `componentForMajor(major: number): string`
  - `javaBinPath(runtimeDir: string, platform: NodeJS.Platform): string`
  - `interface InstallJavaDeps { exists(path): Promise<boolean>; validate(path): Promise<number | null>; install(args: { component: string; destination: string; platform: NodeJS.Platform; onProgress: (percent: number) => void; signal: AbortSignal }): Promise<void> }`
  - `ensureManagedJava(requiredMajor, runtimeRoot, platform, onProgress, deps, signal): Promise<string>` — returns the `bin/java` path.

- [ ] **Step 1: Write the failing tests**

Create `test/launch-java-runtime.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  componentForMajor,
  javaBinPath,
  ensureManagedJava,
  type InstallJavaDeps
} from '../src/main/services/launch/java-runtime.ts'

test('componentForMajor mapea 21/17/8 y falla en lo desconocido', () => {
  assert.equal(componentForMajor(21), 'java-runtime-delta')
  assert.equal(componentForMajor(17), 'java-runtime-gamma')
  assert.equal(componentForMajor(8), 'jre-legacy')
  assert.throws(() => componentForMajor(99))
})

test('javaBinPath usa java.exe en Windows y java en el resto', () => {
  assert.equal(javaBinPath('/r/delta', 'win32'), '/r/delta/bin/java.exe')
  assert.equal(javaBinPath('/r/delta', 'linux'), '/r/delta/bin/java')
})

function depsWith(overrides: Partial<InstallJavaDeps>): InstallJavaDeps {
  return {
    exists: async () => false,
    validate: async () => 21,
    install: async () => undefined,
    ...overrides
  }
}

test('si ya existe un JRE válido, no reinstala (idempotente)', async () => {
  let installed = false
  const deps = depsWith({
    exists: async () => true,
    validate: async () => 21,
    install: async () => {
      installed = true
    }
  })
  const path = await ensureManagedJava(21, '/root', 'linux', () => {}, deps, new AbortController().signal)
  assert.equal(path, '/root/java-runtime-delta/bin/java')
  assert.equal(installed, false)
})

test('si no existe, instala y devuelve la ruta validada', async () => {
  const calls: string[] = []
  const deps = depsWith({
    exists: async () => false,
    install: async ({ component }) => {
      calls.push(component)
    },
    validate: async () => 21
  })
  const path = await ensureManagedJava(21, '/root', 'linux', () => {}, deps, new AbortController().signal)
  assert.deepEqual(calls, ['java-runtime-delta'])
  assert.equal(path, '/root/java-runtime-delta/bin/java')
})

test('si el JRE instalado no valida, tira error (no lanza roto)', async () => {
  const deps = depsWith({ exists: async () => false, install: async () => {}, validate: async () => null })
  await assert.rejects(
    ensureManagedJava(21, '/root', 'linux', () => {}, deps, new AbortController().signal),
    /no es válido/i
  )
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --test-name-pattern="ensureManagedJava|componentForMajor|javaBinPath|idempotente|instala y devuelve|no valida"`
Expected: FAIL — module `java-runtime.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/main/services/launch/java-runtime.ts`:

```ts
import { join } from 'node:path'

/**
 * JRE gestionado (fallback cuando no hay Java del sistema). La lógica es pura y
 * se testea con deps inyectadas; el adaptador real de @xmcl vive aparte
 * (java-runtime-real.ts) y se verifica a mano.
 */

const JAVA_COMPONENTS: Record<number, string> = {
  8: 'jre-legacy',
  17: 'java-runtime-gamma',
  21: 'java-runtime-delta'
}

export function componentForMajor(major: number): string {
  const component = JAVA_COMPONENTS[major]
  if (!component) throw new Error(`No hay componente de Java conocido para el major ${major}.`)
  return component
}

export function javaBinPath(runtimeDir: string, platform: NodeJS.Platform): string {
  const exe = platform === 'win32' ? 'java.exe' : 'java'
  return join(runtimeDir, 'bin', exe)
}

export interface InstallJavaDeps {
  /** ¿Existe ya el ejecutable? */
  exists: (path: string) => Promise<boolean>
  /** Corre `<path> -version` y devuelve el major, o null si no valida. */
  validate: (path: string) => Promise<number | null>
  /** Descarga+extrae el JRE del componente dado en `destination`. */
  install: (args: {
    component: string
    destination: string
    platform: NodeJS.Platform
    onProgress: (percent: number) => void
    signal: AbortSignal
  }) => Promise<void>
}

/**
 * Garantiza un JRE >= requiredMajor en `runtimeRoot/<component>` y devuelve la ruta
 * a `bin/java`. Idempotente: si ya está y valida, no re-descarga.
 */
export async function ensureManagedJava(
  requiredMajor: number,
  runtimeRoot: string,
  platform: NodeJS.Platform,
  onProgress: (percent: number) => void,
  deps: InstallJavaDeps,
  signal: AbortSignal
): Promise<string> {
  const component = componentForMajor(requiredMajor)
  const destination = join(runtimeRoot, component)
  const javaPath = javaBinPath(destination, platform)

  if (await deps.exists(javaPath)) {
    const major = await deps.validate(javaPath)
    if (major !== null && major >= requiredMajor) return javaPath
  }

  await deps.install({ component, destination, platform, onProgress, signal })

  const major = await deps.validate(javaPath)
  if (major === null || major < requiredMajor) {
    throw new Error('El Java descargado no es válido. Reintentá o instalá Java 21 manualmente.')
  }
  return javaPath
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` then `npm run typecheck`
Expected: PASS + clean typecheck.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/launch/java-runtime.ts test/launch-java-runtime.test.ts
git commit -m "feat: ensureManagedJava wrapper with injected deps"
```

---

### Task 6: Real `@xmcl/installer` adapter + real deps

This task wires the actual library. Its correctness is verified by the real-run in Task 8, not by unit tests (it does network IO). Keep it thin — all branching logic already lives in Task 5.

**Files:**
- Create: `src/main/services/launch/java-runtime-real.ts`
- Modify: `package.json` (add `@xmcl/installer`)

**Interfaces:**
- Consumes: `InstallJavaDeps` (Task 5), `execJavaVersion` + `parseJavaMajor` (`./java`).
- Produces: `realInstallJavaDeps: InstallJavaDeps`.

- [ ] **Step 1: Add the dependency**

Run:
```bash
cd /home/teodoro/emigreteStudiosLuncher
npm install @xmcl/installer
```
Expected: `@xmcl/installer` appears in `dependencies`.

- [ ] **Step 2: Inspect the installed API before coding**

Run:
```bash
grep -RhoE "export (declare )?(async )?function (installJavaRuntime|fetchJavaRuntimeManifest|getPotentialJavaRuntimeManifest|installJavaRuntimeTask)[^(]*" node_modules/@xmcl/installer/**/*.d.ts | sort -u
```
Note the exact exported names and their option shapes (destination, manifest, and how progress/tasks are reported). Use those exact names in Step 3; adjust the calls below if the installed version differs. This adapter is the ONLY place that touches `@xmcl`, so a signature mismatch is contained here.

- [ ] **Step 3: Write the adapter**

Create `src/main/services/launch/java-runtime-real.ts`:

```ts
import { access } from 'node:fs/promises'
import { fetchJavaRuntimeManifest, installJavaRuntime } from '@xmcl/installer'
import type { InstallJavaDeps } from './java-runtime'
import { execJavaVersion, parseJavaMajor } from './java'

/**
 * Adaptador real de @xmcl/installer. Baja el JRE con parity Mojang (sha1 por
 * archivo, LZMA y extracción los hace la lib). Es fino a propósito: la lógica de
 * decisión vive en ensureManagedJava (java-runtime.ts).
 *
 * NOTA: verificá los nombres/firmas exactos contra node_modules/@xmcl/installer
 * (ver Step 2 de la tarea). Si la versión instalada difiere, ajustá SOLO este archivo.
 */
export const realInstallJavaDeps: InstallJavaDeps = {
  exists: async (path) => {
    try {
      await access(path)
      return true
    } catch {
      return false
    }
  },

  validate: async (path) => {
    const { ok, output } = await execJavaVersion(path)
    if (!ok) return null
    return parseJavaMajor(output)
  },

  install: async ({ component, destination, onProgress }) => {
    const manifest = await fetchJavaRuntimeManifest({ target: component })
    let lastPercent = -1
    await installJavaRuntime({
      destination,
      manifest,
      // @xmcl reporta progreso por su Task API; adaptá según lo visto en Step 2.
      onProgress: (chunkSize: number, written: number, total: number) => {
        if (total <= 0) return
        const percent = Math.min(100, Math.round((written / total) * 100))
        if (percent !== lastPercent) {
          lastPercent = percent
          onProgress(percent)
        }
      }
    } as Parameters<typeof installJavaRuntime>[0])
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS. If `@xmcl` option names differ, fix them here per Step 2 until it typechecks.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/main/services/launch/java-runtime-real.ts
git commit -m "feat: real @xmcl/installer adapter for managed JRE"
```

---

### Task 7: Wire managed Java into the launch flow

**Files:**
- Modify: `src/main/services/launch/index.ts:13,44-48`

**Interfaces:**
- Consumes: `ensureManagedJava` (Task 5), `realInstallJavaDeps` (Task 6), `runtimeDir` (Task 4), `execJavaVersion` (`./java`), `manifest.java?.major`.

- [ ] **Step 1: Update imports**

In `src/main/services/launch/index.ts`, extend the existing imports:

```ts
import { instanceDir, runtimeDir } from '../pack'
import { detectJava, execJavaVersion, javaCandidates, MIN_JAVA } from './java'
import { ensureManagedJava } from './java-runtime'
import { realInstallJavaDeps } from './java-runtime-real'
```

(Adjust the existing `instanceDir` and `./java` import lines rather than duplicating them.)

- [ ] **Step 2: Replace the Java resolution block (lines 44-48)**

Replace:

```ts
    // --- Java ---
    emit({ phase: 'preparing' })
    const java = await detectJava(javaCandidates(process.env, process.platform))
    if (!java) {
      return fail('Necesitás Java 21 para jugar. Instalalo (Temurin/Adoptium) o definí PACK_JAVA_PATH.')
    }
```

with:

```ts
    // --- Java ---
    emit({ phase: 'preparing' })
    const requiredMajor = manifest.java?.major ?? MIN_JAVA
    let java = await detectJava(javaCandidates(process.env, process.platform), execJavaVersion, requiredMajor)
    if (!java) {
      // No hay Java del sistema: bajamos un JRE gestionado (una sola vez).
      emit({ phase: 'downloading-java', percent: 0 })
      const javaPath = await ensureManagedJava(
        requiredMajor,
        runtimeDir(),
        process.platform,
        (percent) => emit({ phase: 'downloading-java', percent }),
        realInstallJavaDeps,
        signal
      )
      java = { path: javaPath, major: requiredMajor }
    }
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (`java` is now `let`; `java.path` is still used downstream at the MCLC call.)

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: PASS — no unit test exercises this integration branch directly, but nothing regresses.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/launch/index.ts
git commit -m "feat: download a managed JRE when no system Java is found"
```

---

### Task 8: Real-run verification (manual, on the dev's Arch box)

No code. Proves the feature end-to-end with the real `@xmcl` download and a real Minecraft launch. Requires a logged-in session and a configured manifest.

- [ ] **Step 1: Hide system Java so the fallback triggers**

Run the app with `PACK_JAVA_PATH` pointed at a non-Java path and `JAVA_HOME` unset, so `detectJava` misses:
```bash
cd /home/teodoro/emigreteStudiosLuncher
npm run build
JAVA_HOME= PACK_JAVA_PATH=/nonexistent/java npx electron-vite preview
```
(If `java` is on PATH and ≥21, temporarily rename it or run in an env without it — the goal is that no candidate resolves.)

- [ ] **Step 2: Press JUGAR and watch the phase**

Expected: the button shows `JAVA 0% … 100%` (the `downloading-java` phase), the JRE lands under `userData/runtime/java-runtime-delta/`, and then the game proceeds to install NeoForge and launch. Minecraft opens on the RTX 4070.
`userData` on Linux ≈ `~/.config/El Caballero de Netherite/`.

- [ ] **Step 3: Confirm idempotency**

Close the game, press JUGAR again. Expected: NO `JAVA %` phase this time — the cached JRE is reused (goes straight to preparing/launching).

- [ ] **Step 4: Confirm the escape hatch still works**

Run once more with a real `PACK_JAVA_PATH` (a system Java 21). Expected: no download, uses the provided path.

- [ ] **Step 5: Update the README Java note**

In `README.md`, replace the "MCLC no descarga Java… queda para más adelante" note with: the launcher now auto-downloads a Java 21 JRE (Mojang-parity via `@xmcl/installer`) to `userData/runtime` when no system Java ≥ the required major is found; `PACK_JAVA_PATH` / `JAVA_HOME` / PATH still take priority.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: document automatic Java download (M4a)"
```

---

## Self-Review

- **Spec coverage (Fase A):** component mapping (Task 5), system-first priority (Task 7 keeps `detectJava` first), managed JRE at `userData/runtime` (Tasks 4+5), progress via `play:progress` new phase (Task 3+7), `@xmcl/installer` as library keeping MCLC (Task 6, MCLC call untouched), abort-on-invalid-JRE (Task 5), required major from manifest (Task 7). All covered.
- **Placeholder scan:** the only deliberate "verify against installed types" is Task 6 Step 2 — required because the external lib's exact API can vary by version; the adapter is isolated so this is contained, not a placeholder in our own logic.
- **Type consistency:** `ensureManagedJava`, `InstallJavaDeps`, `componentForMajor`, `javaBinPath`, `realInstallJavaDeps`, `runtimeDir`, `detectJava(…, requiredMajor)` names/signatures are consistent across Tasks 2–7.
</content>
