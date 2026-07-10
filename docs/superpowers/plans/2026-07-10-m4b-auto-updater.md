# M4b — Auto-updater Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The launcher checks GitHub Releases for a newer version, asks before downloading, shows progress in the HUD, and restarts to install — via `electron-updater`.

**Architecture:** A pure `wireUpdater(updater, emit)` maps `electron-updater` events to a discriminated `UpdaterStatus` and is unit-tested with a fake EventEmitter. The main process activates the real `autoUpdater` only when `app.isPackaged`, pushes status to the renderer over a one-way `updater:status` channel, and exposes `check`/`download`/`install` invokes. A React hook + a small HUD pill drive the UX. `autoDownload` is off (prompt-before-download).

**Tech Stack:** Electron + electron-vite + React + TypeScript. `electron-updater` + electron-builder GitHub publish. Native `node:test` runner.

**Prerequisite:** git is already initialized (Plan M4a, Task 1). This plan runs on branch `m4-auto-updater` (branched from `m4-auto-java` or main after M4a merges).

## Global Constraints

- Platforms: Windows (NSIS) + Linux (AppImage) only. Remove the `mac` target from `electron-builder.yml`.
- Feed: GitHub Releases, PUBLIC repo (no token on the user's machine).
- `autoDownload = false` (prompt before downloading); `autoInstallOnAppQuit = true`.
- The `autoUpdater` must run ONLY when `app.isPackaged` (it throws in dev). In dev, `updater:check` is a no-op.
- The updater must NEVER block or crash launching/playing — every path is best-effort; errors surface as a dismissible status.
- Renderer UX matches the HUD aesthetic (custom pill + progress), not the OS notification.
- New code targets ≥80% coverage; the event→status mapping is the unit under test.
- Test style: `import { test } from 'node:test'` + `import assert from 'node:assert/strict'`; source imports use explicit `.ts`.
- Commit message format: `<type>: <description>`.

---

### Task 1: Branch for this plan

- [ ] **Step 1: Create the branch**

Run (from the repo initialized in M4a):
```bash
cd /home/teodoro/emigreteStudiosLuncher
git checkout -b m4-auto-updater
```
Expected: on branch `m4-auto-updater`.

---

### Task 2: `UpdaterStatus` shared type

**Files:**
- Create: `src/shared/updater.ts`

**Interfaces:**
- Produces:
  ```ts
  export type UpdaterStatus =
    | { state: 'idle' }
    | { state: 'checking' }
    | { state: 'available'; version: string }
    | { state: 'none' }
    | { state: 'downloading'; percent: number }
    | { state: 'ready'; version: string }
    | { state: 'error'; message: string }
  ```

- [ ] **Step 1: Create the type**

Create `src/shared/updater.ts`:

```ts
/** Estado del auto-updater, empujado del main al renderer por 'updater:status'. */
export type UpdaterStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'none' }
  | { state: 'downloading'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

export const IDLE_UPDATER: UpdaterStatus = { state: 'idle' }
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck`
Expected: PASS.
```bash
git add src/shared/updater.ts
git commit -m "feat: UpdaterStatus shared type"
```

---

### Task 3: `wireUpdater` event→status mapping (pure, tested)

**Files:**
- Create: `src/main/services/updater.ts`
- Test: `test/updater.test.ts`

**Interfaces:**
- Consumes: `UpdaterStatus` (Task 2).
- Produces:
  - `interface AutoUpdaterLike { on(event: string, listener: (...args: unknown[]) => void): unknown }`
  - `wireUpdater(updater: AutoUpdaterLike, emit: (status: UpdaterStatus) => void): void`

- [ ] **Step 1: Write the failing test**

Create `test/updater.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { wireUpdater } from '../src/main/services/updater.ts'
import type { UpdaterStatus } from '../src/shared/updater.ts'

test('wireUpdater mapea cada evento de electron-updater a un status', () => {
  const em = new EventEmitter()
  const seen: UpdaterStatus[] = []
  wireUpdater(em, (s) => seen.push(s))

  em.emit('checking-for-update')
  em.emit('update-available', { version: '0.2.0' })
  em.emit('update-not-available', { version: '0.1.0' })
  em.emit('download-progress', { percent: 42.7 })
  em.emit('update-downloaded', { version: '0.2.0' })
  em.emit('error', new Error('boom'))

  assert.deepEqual(seen, [
    { state: 'checking' },
    { state: 'available', version: '0.2.0' },
    { state: 'none' },
    { state: 'downloading', percent: 43 },
    { state: 'ready', version: '0.2.0' },
    { state: 'error', message: 'boom' }
  ])
})

test('wireUpdater tolera payloads raros sin romperse', () => {
  const em = new EventEmitter()
  const seen: UpdaterStatus[] = []
  wireUpdater(em, (s) => seen.push(s))

  em.emit('update-available', undefined)
  em.emit('download-progress', {})
  em.emit('error', 'texto suelto')

  assert.deepEqual(seen, [
    { state: 'available', version: '?' },
    { state: 'downloading', percent: 0 },
    { state: 'error', message: 'texto suelto' }
  ])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="wireUpdater"`
Expected: FAIL — module `updater.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/main/services/updater.ts`:

```ts
import type { UpdaterStatus } from '../../shared/updater'

/**
 * Cablea los eventos de electron-updater a un UpdaterStatus tipado. El mapeo es puro
 * y se testea con un EventEmitter falso; el main le pasa el autoUpdater real y un emit
 * que empuja el status al renderer. Tolerante a payloads inesperados: nunca tira.
 */

export interface AutoUpdaterLike {
  on(event: string, listener: (...args: unknown[]) => void): unknown
}

function readVersion(info: unknown): string {
  if (info && typeof info === 'object' && 'version' in info) {
    const v = (info as { version: unknown }).version
    if (typeof v === 'string') return v
  }
  return '?'
}

function readPercent(progress: unknown): number {
  if (progress && typeof progress === 'object' && 'percent' in progress) {
    const p = (progress as { percent: unknown }).percent
    if (typeof p === 'number' && Number.isFinite(p)) return Math.round(p)
  }
  return 0
}

function readError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return 'Error desconocido del updater.'
}

export function wireUpdater(updater: AutoUpdaterLike, emit: (status: UpdaterStatus) => void): void {
  updater.on('checking-for-update', () => emit({ state: 'checking' }))
  updater.on('update-available', (info) => emit({ state: 'available', version: readVersion(info) }))
  updater.on('update-not-available', () => emit({ state: 'none' }))
  updater.on('download-progress', (progress) => emit({ state: 'downloading', percent: readPercent(progress) }))
  updater.on('update-downloaded', (info) => emit({ state: 'ready', version: readVersion(info) }))
  updater.on('error', (err) => emit({ state: 'error', message: readError(err) }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` then `npm run typecheck`
Expected: PASS + clean typecheck.

- [ ] **Step 5: Commit**

```bash
git add src/main/services/updater.ts test/updater.test.ts
git commit -m "feat: wireUpdater maps electron-updater events to UpdaterStatus"
```

---

### Task 4: Install `electron-updater`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install**

Run:
```bash
cd /home/teodoro/emigreteStudiosLuncher
npm install electron-updater
```
Expected: `electron-updater` in `dependencies`.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add electron-updater dependency"
```

---

### Task 5: Main-process updater wiring

**Files:**
- Modify: `src/main/index.ts` (capture the window; add activation + IPC handlers; replace the STUB M4 block at lines 113-117)

**Interfaces:**
- Consumes: `wireUpdater` (Task 3), `autoUpdater` from `electron-updater`, `UpdaterStatus` (Task 2).
- Produces: IPC `updater:check` / `updater:download` / `updater:install`; one-way channel `updater:status`.

- [ ] **Step 1: Capture the main window in a module variable**

In `src/main/index.ts`, add a module-level ref near the top constants:

```ts
let mainWindow: BrowserWindow | null = null
```

In `createWindow`, assign it and clear on close:

```ts
  const win = new BrowserWindow({ /* ...unchanged... */ })
  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
```

- [ ] **Step 2: Add the updater setup function**

Add near the bottom of the file (replacing the `STUB M4` comment block at lines 113-117):

```ts
/* ------------------------------ M4 updater ------------------------------ *
 * Auto-update desde GitHub Releases (repo público). autoDownload OFF: se
 * pregunta antes de bajar. Solo activo en producción (empaquetado): el
 * autoUpdater tira si corre en dev. Nunca bloquea el jugar.
 * ------------------------------------------------------------------------ */
function setupUpdater(): void {
  if (!app.isPackaged) return
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  wireUpdater(autoUpdater, (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updater:status', status)
  })
  // Chequeo al arrancar, no bloqueante; los errores los maneja wireUpdater.
  setTimeout(() => void autoUpdater.checkForUpdates()?.catch(() => undefined), 3000)
}
```

Add the imports at the top:

```ts
import { autoUpdater } from 'electron-updater'
import { wireUpdater } from './services/updater'
```

- [ ] **Step 3: Register IPC handlers and call setup**

Inside `app.whenReady().then(() => { … })`, after the `config:*` handlers, add:

```ts
  // M4 — auto-updater. check/download/install; el status vuelve por 'updater:status'.
  ipcMain.handle('updater:check', () => (app.isPackaged ? autoUpdater.checkForUpdates() : null))
  ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate())
  ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall())
```

And call `setupUpdater()` right after `createWindow()`:

```ts
  createWindow()
  setupUpdater()
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: activate electron-updater in the main process (packaged only)"
```

---

### Task 6: Preload `api.updater`

**Files:**
- Modify: `src/preload/index.ts` (add `updater` namespace; remove the stale stub comment at line 52)
- Modify: `src/preload/index.d.ts` (type the new namespace)

**Interfaces:**
- Consumes: `UpdaterStatus` (Task 2).
- Produces: `window.api.updater = { check, download, install, onStatus }`.

- [ ] **Step 1: Add the namespace in `src/preload/index.ts`**

Add an import:

```ts
import type { UpdaterStatus } from '../shared/updater'
```

Add to the `api` object (after `game`), and delete the old `// onUpdaterStatus` stub comment:

```ts
  ,

  // M4 — auto-updater.
  updater: {
    check: (): Promise<unknown> => ipcRenderer.invoke('updater:check'),
    download: (): Promise<unknown> => ipcRenderer.invoke('updater:download'),
    install: (): Promise<unknown> => ipcRenderer.invoke('updater:install'),
    onStatus: (callback: (status: UpdaterStatus) => void): (() => void) => {
      const listener = (_event: unknown, status: UpdaterStatus): void => callback(status)
      ipcRenderer.on('updater:status', listener)
      return () => ipcRenderer.removeListener('updater:status', listener)
    }
  }
```

- [ ] **Step 2: Type it in `src/preload/index.d.ts`**

Add the import and the `updater` block inside `Window['api']`:

```ts
import type { UpdaterStatus } from '../shared/updater'
```
```ts
      updater: {
        check: () => Promise<unknown>
        download: () => Promise<unknown>
        install: () => Promise<unknown>
        onStatus: (callback: (status: UpdaterStatus) => void) => () => void
      }
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (both `tsconfig.node.json` and `tsconfig.web.json`).

- [ ] **Step 4: Commit**

```bash
git add src/preload/index.ts src/preload/index.d.ts
git commit -m "feat: expose window.api.updater to the renderer"
```

---

### Task 7: `useUpdater` renderer hook

**Files:**
- Create: `src/renderer/src/hooks/useUpdater.ts`

**Interfaces:**
- Consumes: `window.api.updater`, `UpdaterStatus`.
- Produces: `useUpdater(): { status: UpdaterStatus; download: () => void; install: () => void }`.

- [ ] **Step 1: Write the hook (mirrors `useAuth`/`usePlay` patterns)**

Create `src/renderer/src/hooks/useUpdater.ts`:

```ts
import { useEffect, useState, useCallback } from 'react'
import type { UpdaterStatus } from '@shared/updater'

/** Estado del auto-updater. El trabajo real ocurre en el main; acá solo reflejamos. */
export function useUpdater(): {
  status: UpdaterStatus
  download: () => void
  install: () => void
} {
  const [status, setStatus] = useState<UpdaterStatus>({ state: 'idle' })

  useEffect(() => {
    const unsubscribe = window.api?.updater?.onStatus(setStatus)
    return () => unsubscribe?.()
  }, [])

  const download = useCallback((): void => {
    void window.api?.updater?.download()
  }, [])

  const install = useCallback((): void => {
    void window.api?.updater?.install()
  }, [])

  return { status, download, install }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (Confirm `@shared` resolves — it is used by `useAuth`/`usePlay`.)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/hooks/useUpdater.ts
git commit -m "feat: useUpdater hook"
```

---

### Task 8: Updater pill in the HUD

**Files:**
- Create: `src/renderer/src/components/UpdaterPill.tsx`
- Modify: `src/renderer/src/App.tsx` (render the pill)
- Modify: `src/renderer/src/styles/hud.css` (pill styles)

**Interfaces:**
- Consumes: `useUpdater` (Task 7).

- [ ] **Step 1: Create the component**

Create `src/renderer/src/components/UpdaterPill.tsx`:

```tsx
import type { JSX } from 'react'
import { useUpdater } from '../hooks/useUpdater'

/**
 * Aviso de actualización en la HUD. No molesta: solo aparece cuando hay algo que
 * mostrar (disponible / bajando / lista / error). autoDownload OFF => pregunta.
 */
export default function UpdaterPill(): JSX.Element | null {
  const { status, download, install } = useUpdater()

  switch (status.state) {
    case 'available':
      return (
        <div className="updater" role="status">
          <span className="updater__label">Actualización v{status.version}</span>
          <button className="updater__btn" onClick={download}>
            Descargar
          </button>
        </div>
      )
    case 'downloading':
      return (
        <div className="updater" role="status">
          <span className="updater__label">Bajando actualización… {status.percent}%</span>
          <div className="updater__bar" aria-hidden="true">
            <div className="updater__bar-fill" style={{ width: `${status.percent}%` }} />
          </div>
        </div>
      )
    case 'ready':
      return (
        <div className="updater updater--ready" role="status">
          <span className="updater__label">Listo v{status.version}</span>
          <button className="updater__btn" onClick={install}>
            Reiniciar para actualizar
          </button>
        </div>
      )
    case 'error':
      return (
        <div className="updater updater--error" role="status">
          <span className="updater__label">Update falló: {status.message}</span>
        </div>
      )
    default:
      return null // idle / checking / none: nada que mostrar
  }
}
```

- [ ] **Step 2: Render it in `App.tsx`**

Add the import and place `<UpdaterPill />` inside the fragment (after `<TitleBar />`):

```tsx
import UpdaterPill from './components/UpdaterPill'
```
```tsx
      <TitleBar />
      <UpdaterPill />
```

- [ ] **Step 3: Add styles to `src/renderer/src/styles/hud.css`**

Append (uses the existing dark palette; sits below the titlebar, out of the drag zone):

```css
/* ---------------------------- Updater pill --------------------------- */
.updater {
  position: fixed;
  top: 44px;
  right: 16px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(10, 7, 16, 0.86);
  border: 2px solid rgba(120, 220, 255, 0.35);
  border-radius: 4px;
  color: #e8f6ff;
  font-size: 12px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
}
.updater--ready {
  border-color: rgba(140, 255, 170, 0.5);
}
.updater--error {
  border-color: rgba(255, 120, 120, 0.5);
  color: #ffd9d9;
}
.updater__btn {
  padding: 4px 10px;
  background: rgba(120, 220, 255, 0.16);
  border: 1px solid rgba(120, 220, 255, 0.45);
  border-radius: 3px;
  color: inherit;
  cursor: pointer;
  transition: background 150ms ease;
}
.updater__btn:hover {
  background: rgba(120, 220, 255, 0.3);
}
.updater__bar {
  width: 120px;
  height: 6px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
  overflow: hidden;
}
.updater__bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #6fd6ff, #9cf0ff);
  transition: width 150ms ease;
}
```

- [ ] **Step 4: Typecheck + dev smoke**

Run: `npm run typecheck`
Expected: PASS. (In dev the pill stays hidden because `updater:check` is a no-op — that is correct.)

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/UpdaterPill.tsx src/renderer/src/App.tsx src/renderer/src/styles/hud.css
git commit -m "feat: HUD updater pill (available/downloading/ready/error)"
```

---

### Task 9: electron-builder publish config + drop macOS

**Files:**
- Modify: `electron-builder.yml`

- [ ] **Step 1: Edit `electron-builder.yml`**

Remove the `mac:` block (lines 20-22) and add a `publish:` block. Replace `OWNER` and `REPO` with the actual GitHub owner/repo you will create in Task 10:

```yaml
win:
  target: nsis
linux:
  target: AppImage
  category: Game

publish:
  provider: github
  owner: OWNER
  repo: REPO
```

- [ ] **Step 2: Verify the build still packages (no publish yet)**

Run:
```bash
cd /home/teodoro/emigreteStudiosLuncher
npm run build
npx electron-builder --linux AppImage --publish never
```
Expected: an AppImage is produced under `release/` with no errors. (The version embedded is `package.json` `version`.)

- [ ] **Step 3: Commit**

```bash
git add electron-builder.yml
git commit -m "chore: electron-builder GitHub publish config; drop macOS target"
```

---

### Task 10: Publish + real end-to-end update verification (user-gated)

**Outward-facing — requires the user's explicit go-ahead.** This creates a PUBLIC GitHub repo and pushes the source there. Do NOT run these steps without the user creating/authorizing the repo. Confirm `OWNER/REPO` with the user and that `gh auth status` is logged in.

- [ ] **Step 1: Create the public repo and push (user confirms first)**

```bash
cd /home/teodoro/emigreteStudiosLuncher
gh repo create OWNER/REPO --public --source=. --remote=origin --push
```
Expected: repo exists on GitHub with the current branch pushed. Ensure `electron-builder.yml`'s `owner`/`repo` match `OWNER`/`REPO`.

- [ ] **Step 2: Publish baseline v0.1.0**

With `package.json` at `0.1.0`:
```bash
export GH_TOKEN="$(gh auth token)"
npm run build
npx electron-builder --win nsis --linux AppImage --publish always
```
Expected: a GitHub Release `v0.1.0` with the NSIS `.exe`, the `.AppImage`, `latest.yml`, and `latest-linux.yml`.

- [ ] **Step 2b: Install the baseline**

Install v0.1.0 from the release on a Windows machine (run the `.exe`) and/or on the Arch box download+run the `.AppImage` (it must run as the AppImage — the in-place self-update needs `APPIMAGE` set).

- [ ] **Step 3: Cut v0.1.1**

Bump the version and publish again:
```bash
npm version patch --no-git-tag-version   # 0.1.0 -> 0.1.1
git commit -am "chore: release v0.1.1"
export GH_TOKEN="$(gh auth token)"
npm run build
npx electron-builder --win nsis --linux AppImage --publish always
```
Expected: GitHub Release `v0.1.1` with fresh artifacts + `latest*.yml`.

- [ ] **Step 4: Verify the update flow**

Launch the installed v0.1.0. Within a few seconds expect the HUD pill "Actualización v0.1.1" → click Descargar → progress → "Reiniciar para actualizar" → click → app relaunches as v0.1.1.
Confirm: on Windows the SmartScreen warning appears at first install but the auto-update itself succeeds; on Linux the AppImage replaces itself.

- [ ] **Step 5: Document the release process in README**

Add a "Releases / auto-update" section to `README.md`: bump `package.json` version → `GH_TOKEN=$(gh auth token) npm run build && npx electron-builder --win nsis --linux AppImage --publish always` → a GitHub Release is created and clients auto-detect it. Note: unsigned (Windows SmartScreen warning); macOS not distributed.

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: document the release + auto-update process (M4b)"
```

---

## Self-Review

- **Spec coverage (Fase B):** GitHub public feed (Tasks 9-10), `electron-updater` install (Task 4), `autoDownload=false` prompt-first (Tasks 5+8), `app.isPackaged` guard (Task 5), `updater:status` + check/download/install (Tasks 5-6), custom HUD UX with restart-to-install (Task 8), never-block-play (best-effort setup + `.catch` on startup check, Task 5), Windows+Linux only / drop mac (Task 9), release process documented (Task 10). All covered.
- **Placeholder scan:** `OWNER`/`REPO` are intentional fill-ins resolved with the user in Task 10 (a real value can't be invented). No logic placeholders.
- **Type consistency:** `UpdaterStatus`, `wireUpdater`, `AutoUpdaterLike`, `useUpdater`, `api.updater.{check,download,install,onStatus}`, channel names `updater:status`/`updater:check`/`updater:download`/`updater:install` are consistent across Tasks 2-8.
- **Note:** Task 3's `download-progress` test asserts `Math.round(42.7) === 43`; the impl uses `Math.round` — consistent.
</content>
