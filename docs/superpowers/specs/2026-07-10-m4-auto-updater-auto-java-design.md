# M4 — Auto-updater + Auto-Java (Design)

**Fecha:** 2026-07-10
**Proyecto:** Emigrete Launcher ("El Caballero de Netherite") — Electron + electron-vite + React + TS
**Estado previo:** M0–M3 hechos y verificados (lanza Minecraft/NeoForge real en la RTX 4070 del dev).

---

## 1. Objetivo y alcance

M4 son **dos features independientes**:

- **Fase A — Auto-Java:** descargar automáticamente el JRE (Java 21) cuando no hay Java del
  sistema, porque `minecraft-launcher-core` (MCLC) no baja Java. Hoy, sin Java 21, el launch
  falla en seco (`src/main/services/launch/index.ts:45-48`).
- **Fase B — Auto-updater:** actualizar el launcher solo, vía `electron-updater`, desde
  GitHub Releases.

**Orden:** Fase A primero (valor inmediato para los jugadores), Fase B después (requiere
prerequisito de infraestructura: repo git + GitHub + `publish`).

### Decisiones tomadas (con el usuario)

1. **Plataformas:** Windows (NSIS) + Linux (AppImage). **macOS queda afuera** (se elimina el
   target `mac` del `electron-builder.yml`). Ambas plataformas soportan auto-update sin firma
   (Windows muestra warning de SmartScreen; Linux actualiza en su lugar).
2. **Feed de updates:** **GitHub Releases, repo público.** Con repo público el updater baja sin
   token en la máquina del usuario (se evita el problema del token embebido de un repo privado).
3. **Estrategia de Java:** `@xmcl/installer.installJavaRuntime` usado **como librería**,
   manteniendo MCLC para el launch. Baja el mismo JRE que el launcher oficial (parity Mojang),
   con sha1 por archivo, LZMA y extracción resueltos por la lib. **No se migra a `@xmcl`** el
   launch: sería reescribir la capa que ya funciona sin ganancia visible.
4. **Prioridad de Java:** Java del sistema primero (respeta `PACK_JAVA_PATH`, `JAVA_HOME`, PATH,
   dirs conocidos); JRE gestionado solo como fallback.
5. **Descarga del update:** `autoDownload = false` — **preguntar antes de bajar**. Pill
   "Actualización vX disponible" → botón "Descargar" → progreso → "Reiniciar para actualizar".

### Fuera de alcance (YAGNI)

- Firma de código / notarización (Windows y macOS). Windows queda unsigned con warning de
  SmartScreen; se planifica firmar antes de una distribución amplia, no ahora.
- macOS por completo.
- Limpieza/pruning de JRE viejos en `userData/runtime`.
- Auto-update vía package manager de Linux (pacman/deb/rpm). Solo AppImage.
- CI/CD (hoy no existe `.github/`). Los releases se hacen a mano con `npm run dist`.

---

## 2. Fase A — Auto-Java

### 2.1 Estado actual relevante

- `src/main/services/launch/java.ts`: `MIN_JAVA = 21`; `detectJava()` resuelve por candidatos
  (`PACK_JAVA_PATH` → `JAVA_HOME/bin/java` → `java` en PATH → dirs conocidos por OS) y devuelve
  el primero `≥ 21`.
- `src/main/services/launch/index.ts:45-48`: si no hay Java → falla con
  "Necesitás Java 21… o definí `PACK_JAVA_PATH`." **Este es el punto de enganche.**
- El manifest (`src/main/services/pack/manifest.ts:46`) ya trae `java: { major }` opcional →
  fuente de verdad del major requerido.
- Patrón de progreso: `pack/sync.ts:199-209` `createThrottledEmitter` (≤ cada 120 ms); progreso
  del flujo Play viaja por el canal one-way `play:progress`.

### 2.2 Módulo nuevo: `src/main/services/launch/java-runtime.ts`

```
ensureManagedJava(requiredMajor: number, onProgress: (p) => void): Promise<string>
```

- Devuelve la ruta al ejecutable `bin/java` del JRE gestionado.
- Instala en `userData/runtime/<componente>`, hermano de `userData/instance`.
- Mapeo major → componente Mojang: **21 → `java-runtime-delta`**, 17 → `java-runtime-gamma`,
  8 → `jre-legacy`.
- Usa `fetchJavaRuntimeManifest` + `installJavaRuntime` de `@xmcl/installer` (la lib hace la
  descarga con verificación sha1 por archivo, descompresión LZMA y extracción).
- **Idempotente:** si `<dir>/bin/java` ya existe y valida (`java -version` parseado ≥ requerido),
  no re-descarga. Se baja una sola vez y queda cacheado.
- Progreso: la Task API de `@xmcl` → `createThrottledEmitter` → `onProgress`.

### 2.3 Integración en la resolución de Java

En `launch/index.ts` (donde hoy falla, líneas 45-48), nuevo orden:

1. `detectJava(requiredMajor)` primero. **Si hay Java del sistema ≥ requerido → se usa, no baja
   nada.** Fast path para el dev y escape hatch (`PACK_JAVA_PATH`) intactos.
2. Si no hay → `ensureManagedJava(requiredMajor, onProgress)` baja el JRE una vez y devuelve la
   ruta.

`detectJava` se generaliza para aceptar `requiredMajor` (hoy hardcodea 21). El major sale de
`manifest.java.major` si está presente, si no de `MIN_JAVA` (21). El path resultante se pasa a
MCLC como `javaPath` (igual que hoy, `launch/index.ts:95`).

### 2.4 UX de progreso

La descarga de Java es una **fase más del flujo Play** existente:
`sync → java → install NeoForge → launch`. Reusa el canal `play:progress` que el renderer ya
pinta. Etiqueta tipo "Descargando Java 21… 40%". Solo la primera vez.

### 2.5 Errores

- Fallo de red durante la descarga → error tipado por el path de error de Play, con reintento.
- `@xmcl` valida sha1 por archivo; archivo corrupto → re-fetch (lo maneja la lib).
- Si instala pero `java -version` no valida → **se aborta el launch** (no se arranca con un JRE
  roto), con error claro.

---

## 3. Fase B — Auto-updater

### 3.1 Prerequisito de infraestructura (una vez)

- Convertir el proyecto en repo git + crear repo **público** en GitHub + push.
- Agregar dep `electron-updater`.
- `electron-builder.yml`: agregar bloque `publish: { provider: github, owner, repo }`; **sacar el
  target `mac`**; dejar `win` (nsis) + `linux` (AppImage).
- Release: bumpear `version` en `package.json` → `npm run dist` con
  `electron-builder --publish always` → sube instaladores + `latest.yml` / `latest-linux.yml`
  al GitHub Release.

### 3.2 Módulo nuevo: `src/main/services/updater.ts`

- Configura el `autoUpdater` de `electron-updater`:
  - `autoDownload = false` (preguntar antes de bajar).
  - `autoInstallOnAppQuit = true` (si no reinicia ahora, se aplica al cerrar).
  - `logger` conectado al logging existente.
  - **Solo corre si `app.isPackaged`** (en dev electron-updater tira error → no-op en dev).
- Cablea los eventos del `autoUpdater` al canal **`updater:status`** (ya stubeado en
  `preload/index.ts:52` y `main/index.ts:115`), reemplazando el `// STUB M4` actual:
  - `checking-for-update` → `{ state: 'checking' }`
  - `update-available` → `{ state: 'available', version }`
  - `update-not-available` → `{ state: 'none' }`
  - `download-progress` → `{ state: 'downloading', percent }`
  - `update-downloaded` → `{ state: 'ready', version }`
  - `error` → `{ state: 'error', message }`
- API por IPC (invoke): `updater:check` → `checkForUpdates()`; `updater:download` →
  `downloadUpdate()`; `updater:install` → `quitAndInstall()`.

### 3.3 Trigger

- Chequeo automático al arrancar, unos segundos después de abrir la ventana, **no bloqueante**.
- Nunca interrumpe si el usuario está en medio de un "Play".
- Botón manual de "Buscar actualizaciones".

### 3.4 UX en el renderer (estilo HUD Minecraft)

- Indicador sutil en la HUD (esquina / titlebar). Update disponible → pill "Actualización vX".
- Click en "Descargar" → `updater:download` → barra de progreso con el mismo lenguaje visual que
  el progreso de "Play".
- Al terminar → botón **"Reiniciar para actualizar"** → `updater:install` (`quitAndInstall()`).
- Nunca fuerza: se puede seguir jugando; se aplica al próximo cierre.

### 3.5 Preload

`api.updater = { check, download, install, onStatus }`, siguiendo el patrón subscribe/unsubscribe
existente (`ipcRenderer.on` que devuelve función de desuscripción).

---

## 4. Transversal

### 4.1 Canales IPC (resumen final)

- **Java:** sin canal nuevo — viaja por `play:progress` (es una fase del flujo Play).
- **`updater:status`** (one-way main→renderer): `checking / available / downloading(%) / ready /
  error`.
- **`updater:check` · `updater:download` · `updater:install`** (invoke).

### 4.2 Manejo de errores

- Java: ver §2.5.
- Updater: cualquier error → `updater:status` `error` mostrado sin molestar. **El updater nunca
  bloquea ni crashea** el jugar/lanzar; es best-effort.

### 4.3 Tests (runner nativo `npm test`, target 80 % en código nuevo)

- `java-runtime`: mapeo major→componente; idempotencia; validación post-install (mock de `@xmcl`
  + fs).
- `detectJava` generalizado: lógica del umbral `requiredMajor`.
- `updater`: mapeo evento→status (mock del EventEmitter de `autoUpdater`) + guard `isPackaged`.
- No unit-testeable (descarga/update reales) → verificación manual en el Arch real del dev.

### 4.4 Proceso de release (documentar en README)

Bumpear `version` en `package.json` → `npm run dist` (build + publish a GitHub Release) → los
clientes lo detectan solos. El primer release fija la baseline (el auto-update solo funciona
desde una versión previa ya instalada).

### 4.5 Verificación real (Arch del dev, RTX 4070)

- **Fase A:** con el Java del sistema fuera de vista, "Play" baja el JRE una vez a
  `userData/runtime` y Minecraft arranca de verdad.
- **Fase B:** build AppImage v0.1.0 → instalar → publicar v0.1.1 → confirmar el flujo de update
  completo en la HUD (detectar → descargar → reiniciar → nueva versión).

---

## 5. Dependencias nuevas

- `@xmcl/installer` (+ `@xmcl/core` para validar/`resolveJava` si hace falta) — Fase A.
- `electron-updater` — Fase B.

## 6. Riesgos / notas

- **Windows sin firma:** SmartScreen "editor desconocido" al instalar; el auto-update igual
  funciona. Firmar antes de distribución amplia.
- **AppImage:** el auto-update en su lugar requiere correr como AppImage real (`APPIMAGE` seteado),
  no el binario desempaquetado.
- **@xmcl baja por su propio pipeline** (no el `downloadFile`/`createSafeFetch` auditado del
  proyecto), pero verifica sha1 por archivo contra los hosts conocidos de Mojang. Trade-off
  aceptado a cambio de parity Mojang + menos código de extracción propio.
</content>
</invoke>
