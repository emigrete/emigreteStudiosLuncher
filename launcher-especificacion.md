# 🚀 LAUNCHER — Especificación completa

> Documento de construcción del launcher de **El Caballero de Netherite**. Pensado para arrancar YA y para pasarle tareas a Claude Code.
> Target del pack: **NeoForge 1.21.1**. Estudio: **Emigrete Studios** · Facción del lore: **Team Mafia**.

---

## 🧭 Por dónde arrancar (la recomendación)

**Primer ladrillo: el shell visual del launcher** (el menú de la Imagen 7), con logo placeholder. No necesitás el logo final para empezar — se cambia en un archivo. Orden:

1. **M0 — Shell**: app Electron que abre y muestra el menú con tu marca (JUGAR / MODS / SETTINGS / SALIR). *No hace nada aún, pero se ve.*
2. **M1 — Auth**: login con Microsoft.
3. **M2 — Sync + Launch**: baja NeoForge 1.21.1 + la pila base de mods y lanza el juego.
4. **M3 — Update + Pulido**: auto-actualización y detalles.

> Nudge honesto: el launcher es la parte de **menor riesgo** del proyecto (está muy pisado el camino). No le metas meses de pulido antes de validar el prototipo de Corrupción, que es donde está el riesgo real. Shell + auth + launch de la pila base = MVP, y seguís.

---

## 🎯 Qué es (alcance)

Programa de escritorio con tu marca que **autentica**, **instala/sincroniza** el modpack y **lanza** el juego conectado al evento.

- **MVP**: login MS → descarga NeoForge 1.21.1 + mods base (verificados por hash) → lanza. Un botón.
- **v1**: auto-update del launcher y del pack, estado del server, noticias, gestión de RAM, reparación de archivos.

---

## 🎨 Cómo se ve (Imagen 7 → componentes reales)

- **Ventana** ~1280×720, sin marco nativo (frameless), bordes propios.
- **Fondo**: arte del Caballero + Farfania/Far Lands (usás tu concept art).
- **Header izq**: escudo Team Mafia + "ORDEN DE CABALLEROS / Unidos contra la corrupción".
- **Header der**: perfil (avatar del jugador logueado) + dificultad "HARDCORE" + engranaje settings.
- **Centro/izq**: botones grandes **JUGAR** (rojo, primario) / **MODS** / **SETTINGS** / **SALIR**.
- **Panel der**: "LAS FAR LANDS — Más allá del borde" + lista "Actos y amenazas" (Corrupción del Borde, Equipo Corrupto, Jefes).
- **Footer**: "MODPACK BY TEAM MAFIA · versión x.x.x" + iconos Discord / YouTube / Twitter / Modrinth.
- **Estado de descarga**: barra de progreso que reemplaza a JUGAR mientras sincroniza.

Todo esto es **HTML/CSS/JS** dentro de Electron. La UI hermosa que ya diseñaste es directamente implementable (a diferencia del HUD in-game, que sí necesita el mod).

---

## 🧱 Stack recomendado

**Electron** (JavaScript/TypeScript) — el estándar de facto para launchers de Minecraft, muchísimos ejemplos.

Principio: **la app es tuya; los protocolos no se reinventan.** Escribís tu UI y tu lógica, y usás librerías probadas para lo espinoso (auth de Microsoft, descarga/lanzamiento del juego). Después, si querés autonomía total, reemplazás esas piezas por implementación propia.

**Opción A — recomendada para máximo control (más "tuyo"):**
- **`msmc`** → autenticación con cuenta Microsoft (tiene soporte Electron y localización a español).
- **`minecraft-launcher-core` (MCLC)** → descarga y lanza Minecraft; soporta instalar **NeoForge** (le pasás el instalador).
- Vos escribís: UI, sincronización del pack, manifiesto, updater.

**Opción B — más "baterías incluidas" (más rápido):**
- **`EML-Lib`** (eml-project) → auth Microsoft + auto-instalación de **Java** + soporte **NeoForge/Fabric/Forge** + auto-update, todo en uno (MIT). Tiene un backend opcional (AdminTool) para noticias/mantenimiento.

> Para arrancar con control y aprender: **Opción A**. Si querés el launcher funcionando lo antes posible: **Opción B**. Ambas soportan NeoForge 1.21.1 — **verificá versiones actuales al instalar** (las libs se actualizan).

---

## 🏗️ Arquitectura

```
launcher/
├─ src/
│  ├─ main/            (proceso principal Electron - Node)
│  │  ├─ main.ts       (ventana, ciclo de vida)
│  │  ├─ auth.ts       (msmc: login, refresh, guardar sesión)
│  │  ├─ packSync.ts   (lee manifiesto, descarga, verifica hashes)
│  │  ├─ launch.ts     (MCLC: instala NeoForge, arma JVM, lanza)
│  │  ├─ updater.ts    (auto-update del launcher)
│  │  └─ config.ts     (RAM, rutas, preferencias)
│  ├─ renderer/        (UI - HTML/CSS/JS)
│  │  ├─ index.html
│  │  ├─ styles/       (tu marca)
│  │  └─ ui.ts         (menú, estados, progreso)
│  └─ preload.ts       (puente seguro main<->renderer)
├─ assets/             (logo, fondo, iconos - placeholders al inicio)
├─ package.json
└─ electron-builder.yml (empaquetado/instalador)
```

**Comunicación**: el renderer (UI) nunca toca Node directo; habla con el main por IPC vía `preload` (seguro). La UI pide "logueá", "sincronizá", "lanzá"; el main hace el trabajo y devuelve progreso.

---

## 🔄 Flujo del usuario

1. Abre el launcher → ve el menú.
2. Si no hay sesión → login Microsoft (ventana de `msmc`).
3. Aprieta **JUGAR** → el launcher lee el **manifiesto**, compara con lo local, descarga lo que falta, verifica hashes.
4. Instala NeoForge 1.21.1 si no está + Java correcto.
5. Lanza el juego (opcional: con `--server` para conectar directo al evento).

---

## 📄 El manifiesto del modpack (lo que lee el launcher)

Un JSON en tu URL base. Los mods que **sí** podés redistribuir van con `url`; los que **no** (licencia restrictiva) van en `external` para bajarlos de su fuente oficial.

```json
{
  "packName": "El Caballero de Netherite",
  "packVersion": "0.1.0",
  "minecraft": "1.21.1",
  "loader": { "type": "neoforge", "version": "VERIFICAR" },
  "java": { "major": 21 },
  "server": { "host": "", "port": 25565 },
  "files": [
    {
      "path": "mods/mi-mod-corrupcion.jar",
      "url": "https://TU-CDN/mods/mi-mod-corrupcion-0.1.0.jar",
      "sha1": "…",
      "size": 123456
    },
    {
      "path": "config/mi-mod/corruption.json",
      "url": "https://TU-CDN/config/corruption.json",
      "sha1": "…"
    }
  ],
  "external": [
    {
      "name": "Bosses'Rise",
      "source": "curseforge",
      "projectId": 1314084,
      "fileId": 0,
      "targetPath": "mods/bossesrise.jar"
    }
  ]
}
```

El **packager propio** (la herramienta de la que hablamos) genera este JSON automáticamente: calcula hashes, tamaños y arma la lista.

---

## 🔐 Autenticación

- `msmc` maneja el flujo OAuth de Microsoft y devuelve el token para lanzar.
- ⚠️ **Registro en Azure**: para el login necesitás una *aplicación* registrada en Azure (client ID). Es el trámite molesto pero necesario — hacelo temprano. `msmc` documenta qué permisos pedir.
- Guardá la sesión (refresh token) para no pedir login cada vez.

---

## 🌐 Distribución y hosting

- **Manifiesto + mods propios**: en una URL base (GitHub Releases para empezar, o un bucket/CDN).
- **Instalador del launcher**: `electron-builder` genera .exe (Windows), .dmg (Mac), etc.
- **Auto-update**: `electron-updater` (con GitHub Releases o tu servidor).
- ⚠️ **Firma de código**: sin firmar, Windows/Mac muestran advertencias de seguridad al instalar. Para difusión masiva conviene firmar (tiene costo). Para testeo con amigos, no hace falta.

---

## 🧭 Roadmap del launcher (hitos)

- **M0 — Shell** ✦ *primera tarea de Claude Code*: Electron abre, menú con marca, placeholders, botones que responden (aunque no hagan nada real). Corre en tu máquina.
- **M1 — Auth**: login MS con `msmc`, muestra tu perfil en el header, guarda sesión.
- **M2 — Sync + Launch**: lee manifiesto → descarga base + verifica hashes → instala NeoForge 1.21.1 → lanza. **Un amigo aprieta un botón y juega.**
- **M3 — Update + Pulido**: auto-update, estado del server, gestión de RAM, reparación.

---

## 🎨 Branding (jerarquía de marca)

Dos capas que **conviven** (como "Mojang Studios presenta Minecraft"):

- **Emigrete Studios** = el **estudio** (autor). Logo: cubo isométrico con "ES" + rombos cyan. Va en la **firma**: splash de apertura, footer, ícono de la app.
- **Team Mafia / El Caballero de Netherite** = la marca del **contenido/lore**. Va en el **corazón** de la pantalla: header del menú, temática.

**Regla visual: dos paletas que no se pisan.**
- Marca **Emigrete** (fría, tech) → oscuro + blanco + cyan. Solo en bordes/firma.
  - Cyan `#3FE0E0` · Fondo `#141018` · Blanco `#EDE7F6`
- Contenido **lore** (cálida, épica) → violeta + naranja. En el centro.
  - Violeta corrupción `#9D4EDD` / `#7B2CBF`
  - Naranja forja `#E85D04` / `#FF6B1A`
  - Rojo acción (botón JUGAR) `#C1121F`
  - Piedra `#3A3A3A`

**Assets de marca:**
- **Ícono de app**: logo de Emigrete (cubo ES), 256×256, `.ico`/`.icns`.
- **Splash de apertura**: logo Emigrete centrado sobre `#141018`, "presenta" debajo.
- **Wordmark del contenido**: "EL CABALLERO DE NETHERITE" (piedra con vetas de lava, de tus conceptos) + escudo Team Mafia.

---

## 🤖 PROMPT PARA CLAUDE CODE (copiar y pegar) — Hito M0

```
Contexto: estoy construyendo el launcher de escritorio de un modpack de Minecraft.
- Estudio (autor): "Emigrete Studios" (logo: cubo isométrico con "ES" + rombos cyan).
- Contenido/lore del modpack: "El Caballero de Netherite", facción "Team Mafia".
Target del pack: NeoForge 1.21.1. El launcher es una app Electron. Este es el primer hito:
SOLO el shell visual, sin auth ni descargas todavía.

Regla de marca importante: DOS paletas que NO se mezclan.
- Marca Emigrete (fría/tech): usar SOLO en el splash, el footer y el ícono de la app.
  cyan #3FE0E0, blanco #EDE7F6, fondo #141018.
- Contenido/lore (cálida/épica): usar en el corazón del menú.
  violeta #9D4EDD / #7B2CBF, naranja #E85D04, rojo-acción #C1121F, piedra #3A3A3A.

Objetivo de esta tarea (Hito M0):
Crear un proyecto Electron nuevo con TypeScript que:
1) Muestre una PANTALLA DE SPLASH de ~1.5s al abrir: fondo #141018, logo de Emigrete
   (placeholder) centrado, y debajo en chico la palabra "presenta". Luego hace fade al menú.
2) Abra una ventana frameless de 1280x720 con el menú principal, estética de launcher de
   Minecraft oscuro y épico. Debe correr con `npm start`.

Antes de empezar:
- Verificá las versiones actuales y estables de: electron, electron-builder, typescript.
- NO integres auth ni MCLC/msmc todavía (hitos siguientes). Dejá stubs comentados para:
  auth, packSync, launch, updater.

Estructura del proyecto:
- src/main/main.ts (ventana + ciclo de vida + splash)
- src/preload.ts (puente IPC seguro; contextIsolation ON, nodeIntegration OFF)
- src/renderer/splash.html + index.html + styles/ + ui.ts
- assets/ con placeholders: emigrete_logo.png (cubo ES), background.png, shield_teammafia.png.
  Generá placeholders simples de color sólido si no hay imágenes reales.
- package.json con scripts start/build, y electron-builder.yml básico (icon = emigrete_logo).

UI del menú principal (renderer), layout tipo:
- Header izquierda: escudo Team Mafia (placeholder) + "TEAM MAFIA / ORDEN DE CABALLEROS /
  Unidos contra la corrupción".
- Header derecha: bloque de perfil (avatar placeholder + "Invitado") + etiqueta
  "DIFICULTAD: HARDCORE" + botón engranaje (Settings).
- Centro-izquierda: botones grandes verticales: JUGAR (primario, rojo #C1121F), MODS,
  SETTINGS, SALIR.
- Panel derecha: "LAS FAR LANDS — Más allá del borde" + lista de 3 items
  (Corrupción del Borde, Equipo Corrupto, Jefes) con ícono + texto corto.
- Footer (zona de firma Emigrete, tonos cyan/blanco): logo chico de Emigrete +
  "El Caballero de Netherite · por Emigrete Studios · v0.1.0" + 4 iconos placeholder
  (Discord, YouTube, Twitter, Modrinth).
- Estado: el botón JUGAR debe poder cambiar a un estado "barra de progreso" (con un botón
  de prueba que simule progreso 0→100%).

Paleta (variables CSS, respetando la separación de marcas):
- Lore:    --violeta:#9D4EDD; --violeta-osc:#7B2CBF; --naranja:#E85D04; --rojo-accion:#C1121F;
           --piedra:#3A3A3A
- Emigrete:--emigrete-cyan:#3FE0E0
- Base:    --fondo:#141018; --texto:#EDE7F6

Comportamiento M0:
- SALIR cierra la app.
- SETTINGS / MODS abren un panel/modal vacío con título (placeholder).
- JUGAR: por ahora dispara la simulación de barra de progreso y vuelve a "JUGAR".
- Controles de ventana (minimizar/cerrar) vía IPC (por ser frameless).

Entregable: proyecto que corre con `npm install && npm start`, muestra el splash de Emigrete,
luego el menú pulido con la marca del lore, y deja los módulos auth/sync/launch stubbeados.
Explicame la estructura al final y qué haríamos en el Hito M1 (auth con msmc).
```

> Este prompt está acotado a propósito (solo M0). Cuando lo tengas corriendo, te paso el prompt del M1 (auth) y así sucesivamente. Es la forma correcta de usar Claude Code: hitos chicos y verificables, no "hacé todo el launcher".
