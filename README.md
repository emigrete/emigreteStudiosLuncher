# El Caballero de Netherite — Launcher

Launcher de escritorio para el modpack **El Caballero de Netherite** de **Emigrete Studios**.
Target del pack: **NeoForge 1.21.1**.

> **Hito actual: M3 — lanzar el juego.** JUGAR ahora hace todo: login → sincroniza el modpack →
> instala NeoForge 1.21.1 → lanza Minecraft, con progreso real. Falta solo el auto-update (M4).

## Stack

Construido con el stack profesional para launchers de escritorio (el mismo de GDLauncher v1):

- **Electron 43** + **electron-vite 5** (bundler: main / preload / renderer con HMR)
- **React 19** + **TypeScript 7** en el renderer
- **Vite 7** para el build; **electron-builder** para empaquetar
- **msmc 5** para el login con Microsoft (proceso main)
- **minecraft-launcher-core 3** para lanzar Minecraft; instalador de NeoForge por CLI
- **zod 4** para validar el manifiesto remoto (dato no confiable)
- Tipografía **Monocraft** (pixel estilo Minecraft, acentos españoles completos, licencia OFL),
  auto-hospedada en `src/renderer/src/assets/fonts/`

## Correr

```bash
npm install
npm start      # build de producción + preview (abre la app)
```

Durante el desarrollo, con hot-reload:

```bash
npm run dev
```

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | `electron-vite dev` con HMR |
| `npm start` | build + `electron-vite preview` (app de producción) |
| `npm run build` | genera marca + `electron-vite build` → `out/` |
| `npm run dist` | build + `electron-builder` (instaladores) |
| `npm run typecheck` | typecheck de main/preload y renderer |
| `npm test` | tests (runner nativo de Node, sin dependencias) |
| `npm run pack:manifest` | genera el manifiesto del modpack (ver abajo) |
| `npm run gen:assets` | regenera `stone.png` (textura de piedra procedural) |

## Estructura

```
├─ electron.vite.config.ts     config Vite (main / preload / renderer)
├─ electron-builder.yml        empaquetado (icon = build/icon.png)
├─ tsconfig.node.json / .web.json
├─ build/icon.png              ícono de app (logo Emigrete real)
├─ scripts/gen-placeholders.mjs  genera stone.png (textura) sin dependencias
└─ src/
   ├─ shared/                  tipos y helpers compartidos main <-> preload <-> renderer
   │  ├─ types.ts              auth
   │  ├─ pack.ts               manifiesto y progreso
   │  └─ progress.ts           % y formato de bytes (puro, testeado)
   ├─ main/
   │  ├─ index.ts              ventana frameless + ciclo de vida + IPC + CSP (dev/prod)
   │  └─ services/
   │     ├─ auth.ts            login/refresh/logout con msmc
   │     ├─ auth-errors.ts     códigos de msmc -> mensajes en español (puro, testeado)
   │     ├─ avatar.ts          cabeza del skin (8x8) desde Mojang -> data URL
   │     ├─ csp.ts             CSP dev/prod + a qué URLs se aplica (puro, testeado)
   │     ├─ login-window.ts    ventana OAuth propia (partición en memoria)
   │     ├─ session-store.ts   refresh token cifrado con safeStorage
   │     ├─ config.ts         config persistida (URL del manifiesto, RAM)
   │     ├─ play.ts           orquestador de JUGAR (sync -> launch)
   │     ├─ play-runner.ts    single-flight + cancelación de JUGAR
   │     ├─ pack/             M2: sync del modpack (paths, manifest, downloader,
   │     │                    hash-cache, net/SSRF, sync)
   │     └─ launch/           M3: java.ts (detección Java 21), neoforge.ts (instala
   │                          NeoForge), process.ts (subprocesos), minecraft.ts (MCLC),
   │                          index.ts (pegamento real)
   ├─ preload/index.ts         puente seguro -> window.api (contextIsolation ON)
   └─ renderer/
      ├─ index.html            entry de Vite
      └─ src/
         ├─ main.tsx           root React; importa fuentes + estilos
         ├─ App.tsx            splash -> menú + estado de modal
         ├─ components/        HeroBackground, TitleBar, Menu, ProfilePlaque, PlayButton,
         │                     SyncStatus, Splash, Modal, icons
         ├─ hooks/             useAuth · usePackSync
         ├─ data/content.ts    actos de Far Lands + redes
         ├─ assets/            arte real (versionado): hero.jpg, title_netherite.png,
         │                     banner_teammafia.png, emigrete_logo.png
         │                     generado: stone.png (textura)
         │                     fonts/: monocraft.woff2 (+ licencia OFL)
         └─ styles/            fonts · tokens · global · hud · splash
```

## Diseño

- **Fondo cinemático full-bleed** (`assets/hero.jpg`) con **scrims** (gradientes) para legibilidad.
- **HUD en paneles de obsidiana texturada** anclados a los bordes (biselado pixel duro, trim de
  lava y gemas púrpura, como el estandarte); el centro deja ver al Caballero.
- **Título de arte real** (`title_netherite.png`) y botones de piedra/metal con bisel chunky
  que se hunde al presionar. Textura procedural (`stone.png`) vía `background-blend-mode: overlay`.
- **Pantalla de carga in-app**: logo Emigrete + barra de progreso pixel (~2.4s) y fade al menú,
  sin flash de ventana. Paleta fría de marca (cyan/blanco).

### Regla de marca (dos paletas que no se mezclan)

- **Emigrete** (fría) — SOLO splash, footer e ícono: cyan `#3FE0E0`, blanco `#EDE7F6`, fondo `#141018`.
- **Lore** (cálida/épica) — corazón del menú: violeta `#9D4EDD`/`#7B2CBF`, naranja `#E85D04`, rojo `#C1121F`.

## Autenticación (M1)

Login con cuenta de Microsoft usando [`msmc`](https://github.com/Hanro50/MSMC). Todo corre en el
**proceso main**; el renderer solo habla por IPC (`window.api.auth`).

La ventana de OAuth la abrimos nosotros (`services/login-window.ts`) con la API pública de msmc
(`createLink()` + `login(code)`), en vez de `msmc.launch('electron')`. Así controlamos la ventana,
detectamos bien la cancelación y la corremos en una **partición en memoria** (`ms-login`): las
cookies del login no ensucian la sesión de la app y desaparecen al cerrarla.

- **No hace falta registrar nada en Azure.** `msmc` trae el client ID del launcher oficial.
  Si querés usar tu propia app, definí las variables `MSMC_CLIENT_ID` y `MSMC_REDIRECT`.
- **Sesión persistida**: se guarda el *refresh token* de Microsoft cifrado con `safeStorage`
  (keychain del SO) en `userData/session.bin`. Al abrir la app se hace un login silencioso.
  Si el SO no ofrece cifrado (Linux sin keyring), **no se guarda nada**: preferimos pedir login
  otra vez antes que dejar un token de larga vida en texto plano.
- **Avatar sin terceros**: se baja el skin oficial de Mojang, se recorta la cabeza (8×8, con capa
  de sombrero) con `nativeImage` y se pasa al renderer como `data:` URL. Así no dependemos de
  Crafatar/Minotar y la CSP sigue siendo `img-src 'self' data:`.
- El botón primario refleja el estado: `INICIAR SESIÓN` → `JUGAR`. Los errores de Microsoft se
  traducen a español; cerrar la ventana de login **no** se considera un error.

## Sincronización del modpack (M2)

`JUGAR` baja el modpack desde un **manifiesto JSON** y verifica cada archivo por `sha1`.

```bash
# 1. Generá el manifiesto a partir de la carpeta del pack
npm run pack:manifest -- \
  --root ./pack --base-url https://tu-cdn/pack \
  --out manifest.json --pack-version 0.1.0 --loader neoforge:21.1.0

# 2. Subí `pack/` y `manifest.json` a tu CDN (GitHub Releases / gist sirve para empezar)
```

**Configurar la URL en el launcher:** abrí **Settings** (engranaje o botón), pegá la URL del
manifiesto, **GUARDAR**, y **PROBAR SYNC** baja y verifica el modpack (no necesitás iniciar
sesión para probar). Se guarda en `userData/launcher-config.json`. Para desarrollo, la env var
`PACK_MANIFEST_URL` sigue teniendo prioridad.

Los archivos van a `userData/instance`. Los mods que no podés redistribuir se declaran en
`external[]` del manifiesto: el launcher los cuenta y avisa, pero no los baja (llega en M3).

**Seguridad** (el manifiesto es dato remoto y decide **dónde se escribe**):

- Las rutas se validan con `isSafeRelativePath` + `safeResolve`: nada de `..`, absolutas,
  backslash, segmentos vacíos ni bytes nulos. Nunca se escribe fuera de la instancia.
- Solo se aceptan URLs `http(s)` — ni `file://` ni `data:`.
- Cada archivo se verifica por `sha1` **mientras se descarga**, se escribe en `.part` y recién
  se renombra si el hash coincide (escritura atómica: nunca queda un `.jar` corrupto).
- Se rechaza escribir a través de un **symlink**, y se aborta si el cuerpo excede el `size`
  declarado. Un `.part` huérfano se limpia siempre.
- **HTTPS obligatorio** y **defensa SSRF**: se rechazan hosts privados/loopback/metadata de la
  nube (por IP literal y por lo que resuelve DNS), y los redirects se revalidan salto a salto.
  Para desarrollo/LAN se afloja con `PACK_ALLOW_INSECURE_HTTP=1` / `PACK_ALLOW_PRIVATE_HOSTS=1`.
- Topes anti-DoS: máximo de archivos, cuerpo del manifiesto acotado, y límite de bytes por archivo
  aunque el manifiesto no declare `size`. Se rechazan rutas duplicadas.
- `sha1` da **integridad**, no autenticidad: la autenticidad la aporta HTTPS sobre tu CDN.

Todo esto está cubierto por tests (`test/pack-*.test.ts`): path traversal, symlink de archivo y de
directorio padre, `file://`, redirects a IP privada, manifiestos mentirosos y cancelación.

**Performance**: los hashes se cachean por `(tamaño, mtime)` en `.sync-cache.json`, así el
segundo arranque no vuelve a leer cientos de MB. La verificación hashea **de a un archivo** (en
paralelo thrashea un HDD por los seeks) mientras que las **descargas van en paralelo (4)** para
esconder la latencia de red. Reintentos solo en errores que lo ameritan, timeout por inactividad,
cancelación en cascada, y el progreso a la UI va throttleado (~8/s).

## Lanzar el juego (M3)

JUGAR ejecuta, en orden, emitiendo un progreso unificado:

1. **Sincroniza** el modpack (M2).
2. **Resuelve Java 21** (necesario para 1.21.1). Busca en `PACK_JAVA_PATH`, `JAVA_HOME`, el PATH y
   ubicaciones típicas por SO. **Si no hay Java del sistema, baja un JRE gestionado** (una sola vez).
3. **Instala NeoForge** la primera vez: baja el instalador oficial de `maven.neoforged.net`
   (verificado por sha1), corre `java -jar …-installer.jar --install-client <instancia>` y deja
   `versions/neoforge-21.1.235/`. Idempotente: no reinstala si ya está.
4. **Lanza** con `minecraft-launcher-core` (`version.custom = neoforge-<ver>`), pasándole tu
   sesión de Microsoft, la RAM configurada y el Java detectado. La salida del juego va a
   `instance/logs/launch.log`. Se detecta cuándo abrió la ventana vs. un crash temprano.

> **NeoForge + MCLC:** MCLC mergea los argumentos de *juego* de NeoForge pero no los de *JVM*
> (los módulos JPMS: `--add-opens`, `-p`, `--add-modules`). Sin ellos la JVM tira
> `InaccessibleObjectException` y el juego no arranca. El launcher los lee del version json de
> NeoForge, resuelve los placeholders y se los pasa a MCLC como `customArgs`.

La versión de NeoForge sale del `loader.version` del manifiesto; si ponés `latest` o un
placeholder, se resuelve la última `21.1.x` desde el maven-metadata (nunca una de otro Minecraft).

> **Java (M4a):** MCLC no descarga Java, así que el launcher lo resuelve solo. Si hay un Java del
> sistema `>=` el major requerido (`PACK_JAVA_PATH` / `JAVA_HOME` / PATH / rutas típicas), lo usa.
> Si no, **descarga automáticamente un JRE** con parity Mojang (`@xmcl/installer`, el mismo JRE que
> el launcher oficial) a `userData/runtime/<componente>` y valida que corra antes de lanzar. El
> major sale de `java.major` del manifiesto (default 21). Se baja una sola vez y queda cacheado.
>
> Nota de dependencia: `@xmcl/installer@6.1.2` trae una `undici` v7 incompatible con su propio
> `throwOnError`; se fija a `undici@6.21.3` vía `overrides`. Además, en modo raw no setea el bit
> `+x`, así que el launcher aplica `chmod` según los flags `executable` del manifest (Linux/mac).

## Seguridad

`contextIsolation: true`, `nodeIntegration: false`. El renderer solo habla con el main por
`window.api` (preload).

**CSP** aplicada por header en el main (`services/csp.ts`), estricta en producción y relajada en
dev (para el HMR de Vite). Se inyecta **solo en las URLs de la app** (`file://` en prod, el server
de Vite en dev): meterla en respuestas de terceros rompe el login de Microsoft — `default-src
'self'` le bloquea los scripts y la página queda en blanco.

## Roadmap

- **M0** — shell visual: splash + menú sobre el hero real. ✅
- **M1** — Auth Microsoft con `msmc`: login, sesión persistida, perfil real. ✅
- **M2** — Sync del modpack: manifiesto, descarga verificada y progreso real. ✅
- **M3 (actual)** — Lanzar Minecraft con NeoForge 1.21.1 (instala loader, detecta Java, MCLC). ✅
- **M4** — Auto-updater del launcher (`electron-updater`) + descarga automática de Java.
