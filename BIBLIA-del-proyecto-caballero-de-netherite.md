# 📕 EL CABALLERO DE NETHERITE — Biblia del Proyecto (índice maestro)

> El documento **"empezá acá"**. Ata todo: visión, identidad visual, stack, assets, fases y orden de ataque. Cuando abras un chat nuevo o sumes a alguien, este es el ancla.
> Versión del pack según los conceptos: **v1.0.0** · Estudio: **Emigrete Studios** · Facción del lore: **Team Mafia** · *Sin reglas. Sin límites. Solo supervivencia.*

---

## 🎯 El proyecto en 30 segundos

Campaña **hardcore-RPG single-player / co-op** donde **sos Farfa, el Caballero de Netherite**, en una odisea hacia las **Far Lands** a través de un mundo que se deshace. La mecánica estrella: **cuanto más te acercás al borde, la realidad se corrompe y escala**. Se entrega por un **launcher propio**, con mapa hecho en un **editor propio**, mecánicas de un **mod propio**, texturas **asistidas por IA** y **cinemáticas** entre actos. Nivel de producción tipo Eufonía, pero full Farfadox.

---

## 🎨 Identidad visual — LOCKED ✅

**Jerarquía de marca (dos capas que conviven):**
- **Emigrete Studios** = el **estudio/autor**. Logo: cubo isométrico "ES" + rombos cyan. Va en la firma (splash, footer, ícono de app). Paleta fría: **cyan `#3FE0E0` + blanco + oscuro**.
- **Team Mafia / El Caballero de Netherite** = la marca del **contenido/lore**. Va en el corazón de la pantalla. Paleta cálida: **violeta + naranja**.
- Regla: las dos paletas **no se pisan** — Emigrete en los bordes, el lore en el centro. Da aspecto de estudio profesional presentando su juego.

Los 7 conceptos que generaste **fijan la dirección de arte**. Ya no es abstracto:

- **Logo / título del contenido**: "EL CABALLERO DE NETHERITE" en bloque de piedra con vetas de lava (netherite ardiente). Subtítulo: *Campaña hardcore-RPG hacia las Far Lands*.
- **Logo del estudio**: Emigrete Studios (cubo ES cyan/blanco sobre negro).
- **Paleta**: violeta-corrupción + naranja-forja/lava + gris-piedra. La corrupción sube de verde → naranja → rojo → violeta (la escala del mapa).
- **Protagonista**: Farfa con armadura negra/roja, espada oscura, escudo con emblema Team Mafia.
- **HUD** (Imagen 1): barra de Corrupción central, buffs, boss bar, minimapa, paneles de región/amenaza/jugador. Es la mecánica estrella hecha interfaz.
- **Launcher** (Imagen 7): JUGAR / MODS / SETTINGS / SALIR, con panel de "Actos y amenazas".
- **Bestiario** (Imagen 3): 3 jefes (Caballero Caído, Guardián del Umbral, La Causa) + fauna corrupta.
- **Mapa de campaña** (Imagen 2): los 5 actos con ruta y escala de corrupción → sirve de biblia y de marketing.
- **Cinemáticas** (Imágenes 4–6): El Borde, combate corrupto, La Forja del Caballero.

> Estos renders son **concept/promo art** (alta fidelidad). El asset in-game es **pixel art 16×16**. Los renders son la guía de estilo y el material de difusión, no la textura final. Mantené una guía de paleta para consistencia.

---

## 🗂️ Documentos del proyecto (subí todos al Proyecto)

| Documento | Para qué sirve |
|---|---|
| **Biblia del Proyecto** (este) | Índice maestro / punto de entrada |
| **concepto-caballero-de-netherite.md** | Biblia creativa: mundo, historia, mecánicas, jefes, finales |
| **plan-maestro-caballero-de-netherite.md** | Plan de producción: stack, fases, hitos, MVP, ruta crítica |
| **Manifiesto de assets** (tu doc con IDs) | Registro canónico de las ~270–360 texturas |
| **El_Caballero_ResourcePack.zip** | Esqueleto real del resource pack (namespace `elcaballero`, format 34) |
| **Los 7 conceptos** (imágenes) | Guía de arte + material de marketing |

---

## ⚙️ Stack técnico definitivo

- **Loader + versión**: **NeoForge 1.21.1** (hogar del contenido pesado en 2026; API rica para tu mod; máxima librería estable; Connector para sumar mods Fabric).
- **Java**: el que pida NeoForge para 1.21.1 (verificá; el launcher lo gestiona).
- **Pila de mods** (verificá versión al fijar el pack):
  - Quests → **FTB Quests (NeoForge)**
  - Worldgen → **Terralith + Tectonic**
  - Progresión → **Skill Tree (RPG Series)**
  - Jefes listos → **Bosses'Rise** · Jefes propios → **Brutal Bosses** (por datapack ⭐)
  - Combate → **Better Combat** o **Epic Fight** (verificá build)
  - Performance → **Embeddium + Oculus** (shaders)
  - Compat → **Sinytra Connector**
  - **Tu mod custom** → Corrupción, equipo corrupto, triggers, HUD, jefes
- **Referencias a estudiar**: DawnCraft, Legendary Edition (hizo sus propios mods = nuestro modelo), RLCraft.
- ⚠️ **Licencias**: varios mods no permiten redistribución → el launcher los baja de la fuente oficial, no los servís vos.

---

## 🗺️ Los 5 Actos

1. **El Corazón** — Farfania. La esperanza perdura. (tutorial/hub)
2. **La Frontera** — La corrupción despierta. + La Forja del Caballero.
3. **Las Tierras Rotas** — Nada es estable. Equipo corrupto + su precio.
4. **El Umbral** — El Guardián te juzga. (boss: Guardián del Umbral)
5. **El Borde / Las Far Lands** — Solo queda la verdad final. (boss: La Causa)

**Jefes**: Caballero Caído (espejo oscuro) · Guardián del Umbral (coloso de obsidiana) · La Causa (entidad final).

---

## 🧵 Pipeline de assets

- **Registro**: el manifiesto con IDs `ECB-XXX-hash` es la fuente de verdad.
- **Esqueleto**: `El_Caballero_ResourcePack.zip` (ya con estructura + `pack.mcmeta` format 34).
- **Generación**: IA para concept/UI, pixel a mano para el 16×16 final (limpieza en Aseprite).
- **Slice de arranque** (~17 PNG): UI core + Caballero + Corrupción + 3 mobs + 1 jefe.
- ⚠️ Verificá la ruta de **armadura equipada** para 1.21.1 (el sistema cambió a "equipment" en versiones recientes).

---

## 🔧 Herramientas propias (autonomía con criterio)

- **Ahora**: packager + generador de manifiesto (pegamento pack↔launcher) · editor de mapas (Fase 2).
- **Cuando duela**: autor de quests, dashboard de tuneo de Corrupción, pipeline de texturas, diseñador de jefes por datapack.
- Regla: automatizás lo que repetís, no lo que imaginás que vas a repetir.

---

## 🎯 Ruta crítica (orden de ataque)

1. Cerrar Fase 0: repos Git + NeoForge 1.21.1 + URL de distribución.
2. Instancia NeoForge 1.21.1 + pila base de mods → **que corra estable**.
3. "Hello mod": tu mod agrega 1 ítem tonto → **valida tu pipeline de modding**.
4. **Prototipo de Corrupción** (medidor + escalado por distancia + equipo corrupto con precio) → **el hito que prueba que el concepto vive**.
5. **Slice de texturas** (~17 PNG) para que se vea como El Caballero.
6. **Rebanada vertical**: Acto 1 + Corrupción + 1 jefe (Brutal Bosses).
7. **Packager** propio → empaqueta + manifiesto.
8. **Launcher MVP** → baja y lanza la rebanada.
9. **Playtest** con gente real vía el launcher.

**Si el paso 4 se siente bien, el proyecto vive.** Todo lo demás es repetir el molde con más contenido.

---

## 🏁 MVP global

> **La rebanada vertical (Acto 1 + Corrupción + 1 jefe), con el slice de texturas, entregada por el launcher MVP, jugable solo o en co-op.**

---

## 🧩 Cómo montar el Proyecto (respondiendo a tu idea)

Tu instinto es correcto: **creá un Proyecto y subí todo ahí.** Un Proyecto guarda los documentos como conocimiento persistente, así **cada chat nuevo arranca con todo el contexto** (concepto, plan, assets, conceptos visuales) sin que tengas que re-explicar nada. Para algo de meses y muchos documentos, es exactamente la herramienta.

**Qué subir al Proyecto:**
- Los 3 documentos `.md` (biblia, concepto, plan maestro).
- Tu manifiesto de assets.
- El `.zip` del resource pack.
- Los 7 conceptos (imágenes).

**Instrucciones sugeridas del Proyecto** (para que cada chat entienda el contexto):
> "Estoy construyendo *El Caballero de Netherite*, un modpack hardcore-RPG de Minecraft (NeoForge 1.21.1) basado en el lore de Farfadox. La biblia, el concepto y el plan maestro están en los archivos del proyecto. Ayudame fase por fase según la ruta crítica."

Después, cada sesión: "seguimos con el paso 4, el prototipo de Corrupción" y ya está — sin repetir historia.

---

## ✅ Estado actual

- [x] Concepto creativo cerrado
- [x] Stack técnico decidido (NeoForge 1.21.1 + mods verificados)
- [x] Plan de producción con fases/hitos/MVP
- [x] Identidad visual definida (7 conceptos)
- [x] Manifiesto de assets
- [x] Esqueleto del resource pack (format 34)
- [ ] Fase 0: repos + instancia corriendo
- [ ] Prototipo de Corrupción (el hito clave)
- [ ] Rebanada vertical + launcher MVP

---

## 📌 Decisiones abiertas
1. Nombre definitivo de la **"Mena Fantasma"** (el mineral corrupto).
2. **Tono**: épica oscura pura vs. fusión sci-fi/distopía.
3. Combate: **Better Combat** (simple) vs **Epic Fight** (animado/pesado).
