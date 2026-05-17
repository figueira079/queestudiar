# PROYECTO.md — queestudiar.es
## Registro vivo del proyecto: decisiones, lógica y estado actual

> Este documento se actualiza con cada cambio importante.
> Es la memoria del proyecto — qué se hizo, por qué, y qué queda pendiente.
> Leerlo antes de cualquier sesión de Claude Code.

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Base de datos | Supabase (proyecto `nplwpuywgqagdedwbenm`) |
| Automatización | N8N (`figueira079.app.n8n.cloud`) |
| Formulario captación | Tally → webhook → N8N |
| Frontend público | HTML/CSS/JS estático en `queestudiar.es` |
| CRM interno | Softr en `app.queestudiar.es` |
| Scraping | SerpAPI |
| Repo | GitHub `figueira079/queestudiar` |

---

## Datos de la plataforma

- **10.135 programas** — grado (3.414), máster (5.017), doctorado (1.614), fp_superior (90)
- **97 universidades** acreditadas (fuente: RUCT)
- **3.291 centros de FP** (fuente: TodaFP)
- **28 ciudades**
- CSV exportado: `queestudiar_programas_export.csv` (10.090 filas, 4.87 MB)

---

## Páginas del sitio

| URL | Estado | Descripción |
|-----|--------|-------------|
| `queestudiar.es/` | ✅ En producción, mejorada | Landing pública |
| `queestudiar.es/#/programas` | ✅ En producción, mejorando | Explorador de programas |
| `queestudiar.es/#/test` | ⚠️ Pendiente verificar | Test vocacional (Tally) |
| `app.queestudiar.es` | ✅ Activo | CRM interno Softr |

---

## Fuentes de verdad de diseño

| Archivo | Propósito |
|---------|-----------|
| `DESIGN.md` | Sistema de diseño completo — leer antes de cualquier UI |
| `PROYECTO.md` | Este archivo — registro vivo del proyecto |

---

## Historial de cambios

---

### [2026-05] Fase 1 — Landing inicial

**Qué se hizo:**
- Landing pública creada con hero, trust bar, cómo funciona, para quién, tipos de estudio, FAQs, CTA final, footer
- Integración con test vocacional (Tally) y explorador de programas
- Meta tags SEO básicos implementados

**Problemas que tenía:**
- Badge "Asesoría 100% gratuita" en el hero — prometía algo que no existe
- Paso 03 "Solicita asesoría gratuita" en cómo funciona — ídem
- FAQ "¿Es gratuita la asesoría?" — ídem
- Stat "0 € Coste de asesoría" en trust bar — falso
- Social proof "Miles de estudiantes..." — dato no verificable
- Emojis de globo terráqueo en cards "Para quién" — genéricos
- FAQs desplegadas por defecto — penaliza mobile y satura visualmente
- Botones sin jerarquía visual (mismo peso primario/secundario)
- Fondo blanco puro en lugar de Pergamino (#FAF6F0)

---

### [2026-05] Fase 2 — Correcciones landing (v2)

**Qué se cambió:**

**Hero:**
- Eliminado badge "Asesoría 100% gratuita"
- H1 nuevo: "Estudia en España. / El programa que encaja contigo." → mejorado a "Encuentra tu programa académico en España."
- Eyebrow label añadido: "ENCUENTRA TU CAMINO ACADÉMICO"
- Subtítulo reescrito: más corto y directo

**Trust bar:**
- 4º stat cambiado de "0 € Coste de asesoría" a "97 Universidades acreditadas"

**Cómo funciona:**
- Paso 03 reemplazado: "Solicita asesoría gratuita" → "Aplica con la información correcta"
- Números decorativos 01/02/03: color `var(--linea)` (#E2E8F0), no opacity

**Para quién:**
- Emojis reemplazados por iconos SVG inline coherentes

**Tipos de estudio:**
- Iconos reemplazados por SVG inline del brand kit
- Botones "Ver..." alineados al fondo con flexbox (`flex: 1` en `.card-body`)

**FAQs:**
- Convertidas a acordeón desplegable (cerrado por defecto)
- JS vanilla: un ítem abierto a la vez
- Eliminada la pregunta "¿Es gratuita la asesoría?"

**CTA final:**
- Headline: "El programa que buscas está aquí."
- Botón primario: `btn-white` (blanco sólido)
- Botón secundario: `btn-ghost-white` (ghost sobre azul)
- Eliminado: "Miles de estudiantes ya han descubierto..."

**Footer:**
- Añadido párrafo GEO sobre RUCT y TodaFP (señal para IAs generativas)
- Añadidos links: Política de privacidad · Aviso legal · Contacto

**Colores:**
- Body: `background: var(--pergamino)` (#FAF6F0) en lugar de blanco puro

**SEO/GEO:**
- Schema.org FAQPage añadido en JSON-LD
- Schema.org WebSite con SearchAction añadido
- Meta tags OG y Twitter Cards revisados

---

### [2026-05] Fase 3 — Explorador de programas

**Qué se implementó:**
- Grid de cards con filtros (ciudad, tipo, área, búsqueda)
- Filtros sticky debajo del nav
- Cards con: imagen placeholder, tags de tipo/ciudad, título, precio

**Problemas detectados (pendientes de fix):**

**Espaciado:**
- Demasiado espacio entre nav y filtros en desktop
- Demasiado espacio entre nav y filtros en mobile
- Causa probable: `padding-top` heredado de la landing o `var(--section-py)` aplicado incorrectamente

**Tipografía:**
- Input "Buscar programa..." usa `system-ui` en lugar de `Lora`
- Causa: los `<input>` no heredan font-family — requiere declaración explícita

**Mobile:**
- Nav se apelmaza: logo + "Test vocacional" + botón sin espacio suficiente
- Filtros apilados verticalmente en lugar de scroll horizontal

**Fix pendiente de aplicar:**
```css
/* Input — tipografía explícita */
.filter-search, input[type="text"] {
  font-family: 'Lora', serif;
  font-size: 14px;
}
.filter-search::placeholder {
  font-family: 'Lora', serif;
  font-style: italic;
  color: #94A3B8;
}

/* Nav mobile — evitar apelmazamiento */
@media (max-width: 480px) {
  .nav-link-test { display: none; }
  nav { padding: 12px 16px; height: 52px; }
}

/* Filtros mobile — scroll horizontal */
@media (max-width: 768px) {
  .filters-bar {
    flex-wrap: nowrap;
    overflow-x: auto;
    padding: 10px 16px;
    gap: 6px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .filters-bar::-webkit-scrollbar { display: none; }
}

/* Eliminar espacio entre nav y filtros */
.explorer-page { padding-top: 0; margin-top: 0; }
.filters-bar { margin-top: 0; top: 52px; }
```

---

### [2026-05-17] Migración hash routing → history routing

**Qué se hizo:**
- `vercel.json` creado con rewrite catch-all `/* → /index.html` (sin esto, refrescar `/programas` daba 404)
- `navigate(path)` helper global: usa `history.pushState` en public domain y `location.hash` en admin/localhost. También actualiza el `<link rel="canonical">` dinámicamente.
- Router en `App()`: lee `location.pathname` en public domain, `location.hash` en admin. Listener `popstate` en public, `hashchange` en admin.
- `PublicApp` route matching: acepta `/match`, `/programas`, `/solicitud` (y los `#/` como fallback para localhost)
- 18 ocurrencias de `location.hash = "#/X"` en UI pública → `navigate("/X")`
- Admin y portal routes (`#/admin`, `#/portal`) intactos — app.queestudiar.es sigue con hash routing

**Por qué:**
- `queestudiar.es/#/programas` era invisible para Google (ignora todo tras `#`)
- Con history routing, `/programas` y futuras páginas `/programas/[id]` son indexables independientemente

**Impacto SEO:**
- `/programas` indexable como página independiente
- Base técnica para `/programas/[id]` con Schema.org por programa
- El sitemap.xml con 10.135 URLs será efectivo cuando se implemente

---

### [2026-05-17] DESIGN NUEVO — Sistema de diseño completo aplicado

**Qué se implementó:**
- Tokens CSS: motion (`--ease-out`, `--spring`, `--dur-micro`…), spacing (`--max-width`, `--padding-x`), brand colors completos
- Google Fonts cargadas en `index.html`: Bricolage Grotesque, Lora, IBM Plex Mono, Work Sans
- Tipografía actualizada: headings Bricolage, body Lora, datos IBM Plex Mono, UI Work Sans
- Secciones landing con fondos alternos: pergamino / blanco / hielo / azure según DESIGN.md
- FAQ acordeón: un ítem abierto a la vez (estado React controlado), animación `max-height`
- SVGs inline actualizados: Para quién (3 icons 40×40), Tipos de estudio (4 icons 40×40)
- `prefers-reduced-motion`, `:focus-visible`, skip-link CSS

**Explorador de programas refactorizado:**
- `ProgramCardCompact` — tarjeta compacta que activa el drawer
- `DrawerProgramDetail` — vista de detalle compartida entre drawer desktop y bottom sheet mobile
- Desktop: grid 55%/45% (`pub-explorer-layout.drawer-open`)
- Drawer desktop: sticky, `height:calc(100vh - 64px)`, animación `drawerIn`
- Mobile: bottom sheet con spring animation + swipe-to-dismiss + body scroll lock

**Mecanismos de cierre del drawer desktop (añadidos en sesión posterior):**
- Botón × arriba a la derecha del drawer
- Toggle: click en la misma card la cierra
- Escape: cierra bottom sheet si está abierto, si no cierra el drawer

**Accesibilidad:**
- `<a href="#main" className="skip-link">` añadido al PublicApp
- `<main id="main">` para el skip-link
- `role="dialog" aria-modal="true"` en bottom sheet
- `aria-expanded` + `aria-controls` en FAQ

**Correcciones de contenido (regla crítica):**
- Eliminadas TODAS las referencias a "asesoría gratuita", "asesor", "equipo" de la UI pública
- `LeadCaptureModal`: "Solicitar asesoría gratuita" → "Contactar con QueEstudiar"
- Meta tags index.html: eliminado "asesoría" de description, OG y Twitter

**Bug crítico corregido:**
- `React.useRef` en ProgramBrowser crasheaba en runtime → añadido `useRef` a los named imports

**Fix de espaciado:**
- Barra de filtros y primera fila de tarjetas estaban demasiado juntas
- `pub-cards-panel` cambiado a `padding:0` (cada hijo maneja su propio padding)
- Count div: `padding-top` de 12px → 24px
- Grid: añadido `padding-bottom:32px`

---

### [2026-05] Fase 4 — Drawer lateral + Bottom sheet

**Qué se diseñó (pendiente de implementar):**
- Desktop: drawer lateral ocupa 45% derecho, cards panel 55% izquierdo
- Mobile: bottom sheet desde abajo, overlay oscuro con blur
- Contenido del drawer: descripción, tabla de requisitos por perfil, precios, botones

**Lógica de apertura:**
```javascript
// Click en card → selectProgram(id)
// Si ya está seleccionada → closeDrawer() (toggle)
// Si es nueva → cerrar anterior + abrir nueva
```

**Mecanismos de cierre (todos obligatorios):**

| Mecanismo | Desktop drawer | Mobile sheet |
|-----------|---------------|--------------|
| Botón × | ✅ arriba derecha | — (tiene overlay) |
| Click misma card | ✅ toggle | — |
| Escape | ✅ | ✅ |
| Swipe down >80px | — | ✅ |
| Click overlay | — (no es modal) | ✅ |

**CSS clave del drawer desktop:**
```css
.drawer-desktop {
  position: sticky;
  top: 52px;
  height: calc(100vh - 52px);
  overflow-y: auto;
  border-left: 1px solid var(--linea);
  background: var(--blanco);
}

/* Animación de entrada del contenido */
.drawer-content {
  animation: drawerIn 280ms cubic-bezier(0.0, 0.0, 0.2, 1);
}
@keyframes drawerIn {
  from { opacity: 0; transform: translateX(12px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

**CSS clave del bottom sheet mobile:**
```css
.bottom-sheet {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  border-radius: 18px 18px 0 0;
  transform: translateY(100%);
  /* Spring para sensación táctil */
  transition: transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1);
  max-height: 87dvh;
  z-index: 200;
}
.bottom-sheet.open { transform: translateY(0); }
```

**Swipe to dismiss:**
```javascript
let touchStart = 0;
sheet.addEventListener('touchstart', e => {
  touchStart = e.touches[0].clientY;
}, { passive: true });
sheet.addEventListener('touchend', e => {
  if (e.changedTouches[0].clientY - touchStart > 80) closeBottomSheet();
}, { passive: true });
```

---

## Estado actual de la base de datos

### Tabla `programas` — campos clave

| Campo | Descripción | Estado |
|-------|-------------|--------|
| `id` | UUID único | ✅ |
| `nombre` | Nombre oficial del programa | ✅ |
| `tipo` | grado / master / fp_superior / doctorado | ✅ |
| `ciudad` | Ciudad donde se imparte | ✅ parcial (null en algunos) |
| `modalidad` | presencial / online / semipresencial | ✅ parcial |
| `precio_anual_eur` | Precio residente UE | ✅ |
| `precio_extracomunitario_eur` | Precio no UE | ✅ |
| `url_detalle` | URL ficha RUCT | ✅ 100% |
| `url_solicitud` | URL solicitud en universidad | ⚠️ problemática |
| `url_solicitud_status` | ok / generica / rota / redirige | ✅ |
| `familia_area` | Categoría temática (50 categorías) | ⚠️ ~1.989 sin clasificar |
| `admite_internacionales` | Boolean | ✅ |
| `visa_eligible` | elegible / pendiente | ✅ parcial |

### Estado de `url_solicitud_status`

| Status | Cantidad | % | Acción |
|--------|----------|---|--------|
| `generica` | 8.578 | 84.6% | SerpAPI batch para buscar URL específica |
| `rota` | 804 | 7.9% | SerpAPI para encontrar nueva URL |
| `redirige` | 603 | 5.9% | HEAD request para seguir redirect y actualizar |
| `ok` | 150 | 1.5% | ✅ No tocar |

**Plan de mejora de URLs (pendiente):**
1. Reclasificar `redirige` → seguir el 301 y actualizar `url_solicitud` con la URL final. Gratis.
2. Para `rota` → SerpAPI: `"{nombre_programa}" "{universidad}" admisión`
3. Para `generica` → SerpAPI con query más específica por programa
4. Coste estimado: ~$35-50 en SerpAPI para cubrir rotas + genéricas prioritarias

---

## Bloqueantes activos

| Bloqueante | Impacto | Plan |
|-----------|---------|------|
| URLs genéricas/rotas en `url_solicitud` | El drawer no puede mostrar URL de solicitud real | SerpAPI batch en N8N |
| Descripciones de programas genéricas | Drawer muestra texto del RUCT sin valor | Gemini batch desde URL oficial |
| ~1.989 programas sin `familia_area` | Filtro por área incompleto | SQL UPDATE con clasificación manual o IA |
| Formulario Tally sin `desired_program_type` ni `base_degree` | Matching incorrecto | Añadir campos al formulario |

---

## Pendientes ordenados por prioridad

### Prioridad 1 — Bloquean uso real con clientes
- [x] Fix espaciado explorador (filtros ↔ tarjetas) ✅
- [x] Implementar drawer lateral + bottom sheet completo ✅
- [x] Añadir botón ×, toggle y Escape al drawer ✅
- [x] Fix formulario /match: origen diferencia por convenio, no solo geografía ✅
- [x] Fix formulario /match: áreas mapeadas a familia_area real de la DB (11 categorías) ✅
- [ ] Fix nav mobile (logo + links apelmazados en < 480px)
- [ ] Filtros mobile en scroll horizontal (nowrap + overflow-x:auto)
- [ ] Fix tipografía input búsqueda (Lora, no system-ui)

### Prioridad 2 — Mejoran experiencia significativamente
- [ ] SerpAPI batch para URLs rotas (804 programas)
- [ ] Reclasificar URLs `redirige` (603 programas, gratis)
- [ ] Descripciones enriquecidas con Gemini para programas con URL válida
- [ ] Filtros mobile en scroll horizontal

### Prioridad 3 — Expansión de funcionalidad
- [x] History routing migrado ✅ — base para indexación
- [ ] Páginas de detalle por programa (`/programas/[id]`) — SEO
- [ ] Sitemap.xml automático (10.135 URLs indexables)
- [ ] Formulario Tally: añadir `desired_program_type` y `base_degree`
- [ ] Completar clasificación `familia_area` (~1.989 sin clasificar)
- [ ] Softr frontend público para resultados del test

---

## Cómo usar este documento con Claude Code

Al iniciar cualquier sesión en terminal:

```
Lee DESIGN.md y PROYECTO.md antes de empezar.
DESIGN.md es la fuente de verdad visual.
PROYECTO.md tiene el contexto del proyecto, el estado actual y los pendientes.
```

Al terminar cada sesión, pide a Claude Code que actualice este archivo:
```
Actualiza PROYECTO.md con lo que acabamos de implementar.
Añade una entrada en el historial con: qué se hizo, por qué, y qué lógica usamos.
```
