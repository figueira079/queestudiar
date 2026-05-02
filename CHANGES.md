# Change Log — QueEstudiar

Registra aquí cada cambio significativo: qué se hizo, por qué, y qué podría haberse afectado.

---

## 2026-03 — Estado actual del proyecto (auditoría inicial)

### Cambios recientes documentados
- **Nuevo campo `horas_semanales`** en tabla `programas`
  - Valores iniciales: fp_superior → 30h, grado → 25h, master/doctorado → NULL
  - Afecta: componente `EditableHours`, `VisaBadge`, `ProgramCard`
  - Pendiente: equipo debe rellenar manualmente los NULL de masters

- **Nuevo campo `assigned_to`** en tabla `student_leads`
  - Permite asignar estudiantes a miembros del equipo
  - Depende de `TEAM_FALLBACK` en App.jsx para el dropdown
  - Workaround: lista hardcodeada hasta que se confirme service_role key

- **Nueva tabla `feedback`**
  - Schema: `id, user_email, user_name, action_type, rating, comment, created_at, reviewed`
  - RLS habilitado (solo authenticated)
  - Componentes relacionados: `FeedbackPopup`, `FeedbackReview`

---

## 2026-04-30 — sesion-9: pulido dashboard — fuente métricas, badges status, fechas pasadas, fix duplicados

- **Qué**: 6 correcciones visuales y de datos en el AdminDashboard tras Sesión 8
- **Por qué**: Números con fuente monoespaciada (ø con barra), badges mostraban valor crudo con guión bajo, fecha pasada en azul, cerrados=0 siempre verde, emojis en tarjetas inconsistentes, duplicados en student_leads
- **Archivos modificados**: `src/App.jsx` (visual), Supabase SQL (duplicados)
- **Cambios principales**:
  - **Fuente métricas**: `var(--mono)` → `'Bricolage Grotesque', sans-serif` (28px) para números en tarjetas dashboard
  - **Emojis eliminados**: campo `icon` y línea del emoji (`<div>`) quitados de las tarjetas de métricas
  - **Color "Cerrados total"**: ahora muted (gris) cuando el valor es 0; verde sage solo si > 0
  - **Badges status**: `{status}` (valor crudo) → `{STATUS_CONFIG[status]?.label || status}`; eliminado `textTransform: "uppercase"`
  - **Fechas pasadas**: UPCOMING_DATES tiene campo `past`; "Feb–Abr 2026" se muestra con tachado, opacity 0.55 y prefijo "✓"
  - **Duplicados BD**: 2 registros duplicados sin matches eliminados de `student_leads` (`valelara0811@gmail.com`); 26 registros de test (`figueira079@gmail.com`) con 50 matches cada uno — NO eliminados, pendiente decisión del equipo
- **Podría afectar**: solo `AdminDashboard` — sin cambios funcionales en otras vistas
- **Verificado**: build limpio (vite build ✓)

---

## 2026-04-30 — sesion-8: fix RLS matches + dashboard como vista principal

- **Qué**: Bug crítico de RLS en `matches` corregido (frontend no veía matches); dashboard como vista por defecto del admin
- **Por qué**: La política `cliente_ve_sus_matches` referenciaba la tabla `clientes` del schema original (no existe en el schema actual) — bloqueaba silenciosamente todas las lecturas de matches desde el frontend
- **Archivos modificados**: Supabase migrations + `src/App.jsx`
- **Cambios SQL**:
  - `DROP POLICY "cliente_ve_sus_matches" ON matches` — eliminada política rota
  - `CREATE POLICY "authenticated_rw" ON matches FOR ALL TO authenticated USING (true) WITH CHECK (true)` — nueva política correcta
  - Verificado: 5+ estudiantes con 50 matches cada uno visibles vía SQL
- **Cambios App.jsx**:
  - Nuevo componente `AdminDashboard` con métricas expandidas (4 cards con borde coloreado), expedientes recientes clicables, desglose por tipo de estudio, fechas clave
  - `adminView` state reemplaza los 3 booleanos `showUserMgmt/showFeedbackReview/showExpedientes`
  - Header: nueva barra de navegación con 4 botones (Dashboard/Expedientes/Usuarios/Feedback), filtrada por rol
  - Vista por defecto al entrar: Dashboard (en lugar de lista de estudiantes)
  - Vista Expedientes: sidebar simplificado (solo búsqueda + lista, sin métricas duplicadas)
  - Navegación desde Dashboard: clic en expediente reciente → navega a Expedientes con ese estudiante seleccionado
- **Verificado**: build limpio (vite build ✓ en 645ms, 0 errores)

---

## 2026-04-30 — sesion-7: fix dashboard métricas, usuarios fallback, mensaje matches vacíos

- **Qué**: Correcciones del panel admin — métricas reales en el sidebar, usuarios con fallback, mensaje vacío mejorado
- **Por qué**: "Docs pendiente" siempre mostraba "—"; usuarios quedaba vacío sin service_role key; mensaje matches era incorrecto; "Cerrados este mes" siempre daba 0
- **Archivos modificados**: `src/App.jsx`
- **Cambios principales**:
  - **Docs pendiente**: nueva función `loadDocsPendientes()` con fetch a `student_documents` filtrando `status IN (pendiente, necesita_correccion)`; estado `docsPendientes` con null inicial (muestra "…" mientras carga); color terra si > 0
  - **Métricas sidebar**: "Seleccionados" → "Con matches" (counts.en_proceso como proxy); "Cerrados este mes" → "Cerrados" (total, sin filtro de mes que siempre daba 0)
  - **Desglose tipos de estudio**: sección bajo las métricas con conteo Máster/Grado/FP/Otro usando `students.filter`
  - **Próximas fechas clave**: sección con 4 fechas hardcodeadas en el sidebar del admin
  - **UserManagement fallback**: cuando `adminListUsers()` falla o devuelve vacío → muestra TEAM_FALLBACK; aviso azul informando que es lista predefinida; botón eliminar oculto para usuarios fallback; fecha de creación solo si existe
  - **Mensaje matches vacíos**: reemplazado texto de n8n por mensaje útil + botón "🔍 Buscar programas" → `queestudiar.es/#/programas`
- **Verificado**: build limpio (vite build ✓ en 614ms, 0 errores)

---

## 2026-04-29 — sesion-6: portal del estudiante rediseñado + fix invitación + eliminado drive URL

- **Qué**: Rediseño completo de `PortalCliente` con dashboard real; corrección del bug de re-invitación; eliminación del campo Drive URL del panel admin
- **Por qué**: Portal mínimo no era suficiente para el estudiante; reenviar invitación a un usuario existente fallaba; Drive URL no se usaba y ensuciaba la UI
- **Archivos modificados**: `src/App.jsx`
- **Cambios principales**:
  - **Drive URL eliminado**: `useState(driveUrl)`, `saveDriveUrl()`, `useEffect` setter y bloque JSX del input eliminados
  - **Bug invitación corregido**: nueva función `sendPasswordRecovery()` que llama a `/auth/v1/recover`; `handleInvite()` ahora bifurca: si `clientUserId` existe → recovery email, si no → Edge Function; botón cambia a "↺ Reenviar acceso" / "✉ Invitar a portal"
  - **TEAM_FALLBACK movido**: de línea ~2459 a antes de `PortalCliente` para que sea accesible dentro del componente
  - **PortalCliente rediseñado**: bienvenida personalizada con nombre + perfil + badge de estado; tracker de 4 pasos visual; 4 stats (programas, favoritos, docs aprobados, próxima convocatoria); tarjeta del asesor con azure-light; tarjetas de programa con barra de acento, precio correcto (extracomunitario si aplica), visa badge; sección de próximas convocatorias hardcodeada por nivel educativo; documentación con estados vacíos útiles
- **Podría afectar**: solo `PortalCliente` — lógica de datos intacta, solo JSX del render
- **Verificado**: build limpio (`vite build` ✓ en 663ms, 0 errores)

---

## 2026-04-26 — sesion-5: migración a tema claro (Meridian Navigation)

- **Qué**: Migración completa del panel admin y portal del cliente del tema oscuro al tema claro del sistema de identidad Meridian Navigation
- **Por qué**: Alinear la interfaz interna con el design system oficial (DESIGN.md) — parchment como fondo de página, white para superficies de tarjeta, colores semánticos accesibles
- **Archivos modificados**: `src/App.jsx`
- **Cambios principales**:
  - Fuentes: añadidas Bricolage Grotesque (titulares), Work Sans (UI), DM Mono (datos) vía Google Fonts
  - Variables CSS `:root`: `--bg` → `#faf6f0`, `--surface` → `#ffffff`, `--text` → `#0f172a`, `--accent` → `#2563eb`, `--accent2` → `#e8531a`, `--success` → `#16a34a`, `--mono` → DM Mono
  - `STATUS_CONFIG` y `DOC_STATUS_CONFIG`: colores actualizados a tokens Meridian (fondos tint + textos semánticos)
  - Clases CSS: eliminados fondos oscuros hardcodeados (`#1e293b`, `#0f1a2e`, etc.) → `var(--bg)` / `var(--surface)`
  - Inline styles: eliminados `#FFB74D` → `#ca8a04`, `#81C784` → `#16a34a`, dark backgrounds → equivalentes claros
  - Bloque PCE warning: `#1c1500` / `#FFB74D` → `#fef9c3` / `#ca8a04`
  - Comentarios portal: burbujas de asesor `#0d2238` → `#dbeafe` (azure-light)
- **Podría afectar**: todos los componentes del CRM admin y PortalCliente — cambio de apariencia global, sin cambios funcionales
- **Verificado**: grep confirma cero ocurrencias de colores oscuros hardcodeados residuales (`#FFB74D`, `#81C784`, `#1c1500`, `#0d2238`, `#0a1020`)

---

## Plantilla para próximas entradas

```
## [FECHA] — [Descripción breve]
- **Qué**: [descripción del cambio]
- **Por qué**: [motivación]
- **Archivos modificados**: [lista]
- **Podría afectar**: [componentes o tablas relacionadas]
- **Verificado**: [cómo se confirmó que funciona]
- **Descartado**: [alternativas que no se usaron y por qué]
```
