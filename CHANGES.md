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

## 2026-05-09 — sesion-19: evaluación IA de documentos con Gemini

- **Qué**: Cuando el estudiante sube un PDF, una edge function (`evaluate-document`) lo descarga del bucket privado, lo envía a Gemini 1.5 Flash con una rúbrica específica por tipo de documento, y guarda puntuación (1–5) + feedback en la BD. La evaluación aparece tanto en el portal del estudiante como en el CRM del asesor.
- **Por qué**: Reduce el tiempo del asesor en revisar documentos triviales y orienta al estudiante sobre la calidad del archivo subido antes de que llegue a admisiones.
- **Archivos modificados**: `src/App.jsx`, `supabase/functions/evaluate-document/index.ts` (nuevo)
- **Cambios principales**:
  - SQL: 3 columnas en `student_documents` (`ai_score INTEGER`, `ai_feedback TEXT`, `ai_evaluated_at TIMESTAMPTZ`)
  - Edge Function `evaluate-document` (verify_jwt: true): descarga PDF con service_role → base64 (chunked) → Gemini 1.5 Flash con `inline_data` + rúbrica → parsea JSON → update DB
  - 10 rúbricas específicas (Carta motivación, CV, Recomendación, Expediente, Título, Idioma, Solvencia, Seguro, DENM, Homologación) + 1 default
  - `PortalCliente`: fire-and-forget tras upload exitoso; bloque "Evaluación IA" con estrellas+feedback en card del documento; mensaje "Evaluación pendiente" si hay archivo sin evaluar
  - `StudentDetail` CRM: cada `doc-row` envuelto en wrapper vertical para acomodar el bloque IA debajo (estrellas+feedback compactos)
  - Modelo: `gemini-1.5-flash`, `temperature: 0.1`, `maxOutputTokens: 512`, soporta PDFs nativamente
- **Podría afectar**: Tab Documentos del portal (estudiante) y Tab Documentos del CRM (asesor). El wrapper vertical en CRM no rompe el layout existente — el `doc-row` mantiene su flex horizontal.
- **Costes**: 0 €/día mientras se mantenga bajo el tier gratuito de Gemini (1.500 req/día, 15 RPM)
- **Prerequisito configurado**: `GEMINI_API_KEY` en Supabase Edge Functions Secrets
- **Verificado**: build limpio (288.65 kB), edge function deployada (version 1, status ACTIVE)

---

## 2026-05-09 — sesion-18: formulario de onboarding + edge function `onboard-student`

- **Qué**: El `SolicitudForm` público deja de delegar en n8n (`public_leads`) y crea directamente el expediente, los matches y el checklist de documentos vía la nueva edge function `onboard-student`.
- **Por qué**: Reduce latencia entre lead y expediente operativo, elimina el round-trip por n8n y permite generar el checklist correcto según el tipo de programa (`master` / `grado` / `fp_superior`) en el momento del envío.
- **Archivos modificados**: `src/App.jsx`, `supabase/functions/onboard-student/index.ts` (nuevo)
- **Cambios principales**:
  - `SolicitudForm`: 3 estados nuevos (`studentOrigin`, `educationLevel`, `submitError`)
  - `SolicitudForm`: 2 selects obligatorios (origen del estudiante + nivel de estudios) antes del campo Presupuesto
  - `SolicitudForm`: `handleSubmit` reemplazado — `publicInsert("public_leads", ...)` → `fetch` a `/functions/v1/onboard-student` con try/catch + bloque visual de error
  - Botón deshabilitado hasta los 4 campos obligatorios (nombre, email, origen, nivel)
  - Edge Function `onboard-student` (verify_jwt: false): inserta lead → inserta matches → consulta `programas.tipo` para detectar tipo dominante → inserta checklist (10 / 7 / 6 docs según master/grado/fp_superior)
- **Podría afectar**:
  - Flujo "decidido" del formulario público — los nuevos leads YA NO llegan a `public_leads`, sino directamente a `student_leads` + `matches` + `student_documents`
  - n8n: si tenía workflow sobre `public_leads.flow_type='decidido'`, queda sin tráfico (el flujo "indeciso" de `MatchResults` sigue intacto)
  - CRM: los nuevos `document_type` (`Equivalencia nota media DENM`, `Homologación o Volante Inscripción`, `Seguro médico privado`) no están en `DOCUMENT_TYPES` → caen en el bloque de "documentos extra" del `StudentDetail`, funcionan pero quedan separados del listado principal
- **Verificado**: build limpio (286.13 kB), edge function deployada (version 1, status ACTIVE)

---

## 2026-05-05 — sesion-17: subida de PDFs a Supabase Storage

- **Qué**: El estudiante sube PDFs reales (max 10 MB) en la pestaña Documentos del portal en lugar de pegar texto en un `textarea`. El asesor ve un enlace "↗ Ver PDF" en la pestaña Documentos del CRM.
- **Por qué**: Prerequisito de la Sesión 19 (evaluación con IA). La columna `content` se preserva intacta para guardar el texto extraído del PDF más adelante.
- **Archivos modificados**: `src/App.jsx`, Supabase (DB + Storage policies)
- **Cambios principales**:
  - SQL: 4 columnas nuevas en `student_documents` (`file_url`, `file_name`, `file_size`, `file_type`)
  - SQL: 3 políticas RLS en `storage.objects` para bucket `student-documents` (INSERT propio, SELECT autenticado, UPDATE propio)
  - `PortalCliente`: `editContent`/`savingDoc` reemplazados por `uploadingDoc`/`uploadError`
  - `PortalCliente`: nueva función `uploadDocFile(docId, file)` con validación PDF + 10 MB y subida a `student-documents/{user_id}/{docId}.pdf` con `x-upsert`
  - `PortalCliente`: textarea + botón "Guardar" sustituidos por card del archivo subido + botón "Seleccionar PDF"
  - `StudentDetail`: enlace `↗ Ver PDF` condicional en cada `doc-row` cuando `doc.file_url` existe
  - **Add-on**: botón "Eliminar" en la card verde + función `deleteDocFile(docId)` con `window.confirm` + 4ª policy RLS `Students delete own documents` (DELETE)
- **Podría afectar**: pestaña Documentos del portal (estudiante) y pestaña Documentos del CRM (asesor). Otras pestañas (Programas, Solicitudes, Requisitos) no tocadas.
- **Verificado**: build limpio, queries existentes sin cambios

---

## 2026-05-04 — sesion-16: selector manual de tipo de programa en panel Requisitos

- **Qué**: El asesor puede elegir manualmente el tipo de programa (Grado / FP Superior / Máster-Doctorado) en la pestaña Requisitos de cada expediente
- **Por qué**: La auto-detección usaba `education_level` como proxy del tipo deseado, generando falsos positivos (ej. estudiante con `education_level=grado` veía requisitos de máster en vez de grado)
- **Archivos modificados**: `src/App.jsx`
- **Cambios principales**:
  - `selectedPtype` state (null = auto-detección); se resetea a null al cambiar de expediente
  - `ptypeAuto` calculado una vez del estudiante; `ptype = selectedPtype || ptypeAuto`
  - `loadRequirements(ptypeOverride)` acepta override explícito — también actualiza `regionData` con el mismo tipo
  - Selector visual de 3 botones pill encima del `RequirementsPanel`; botón activo resaltado en azul; link "Restablecer auto" aparece solo si hay selección manual
- **Podría afectar**: pestaña Requisitos en `StudentDetail` — comportamiento igual a antes si el asesor no toca el selector
- **Verificado**: build limpio (vite build ✓ en 467ms, 0 errores)

---

## 2026-05-04 — sesion-15: portal responsive para móvil

- **Qué**: Portal del estudiante (`PortalCliente`) adaptado para pantallas ≤600px
- **Por qué**: Los estudiantes abren el portal desde el móvil al recibir el email de invitación; el layout anterior se desbordaba
- **Archivos modificados**: `src/App.jsx` (CSS + JSX)
- **Cambios CSS** (nueva `@media (max-width: 600px)` en `const css`):
  - `.portal-header`: padding reducido a 16px; `.user-badge` con `text-overflow: ellipsis`
  - `.portal-stats` / `.portal-stat-card`: tarjetas en 2 columnas (50% - 8px cada una)
  - `.portal-conv-row`: convocatorias en columna con fecha debajo
  - `.portal-solicitud-row` / `.portal-solicitud-btn`: botón "Solicitar plaza" a ancho completo
  - `.portal-perfil-row` / `.portal-perfil-label`: label y valor apilados verticalmente
- **Cambios JSX**: añadidas clases `portal-*` en 7 elementos sin modificar lógica ni `style` existente
- **No afecta**: CRM de admin (`PortalAdmin`), parte pública — clases exclusivamente del portal del estudiante
- **Verificado**: build limpio (vite build ✓ en 469ms, 0 errores)

---

## 2026-05-03 — sesion-14: status_updated_at — badge de inactividad corregido

- **Qué**: Nueva columna `status_updated_at` en `student_leads` con trigger automático; badge naranja de inactividad usa este campo en lugar de `created_at`
- **Por qué**: Falsos positivos — expedientes creados hace >14 días aparecían como inactivos aunque se hubieran actualizado ayer; el badge ahora refleja la última vez que se cambió el status
- **Archivos modificados**: Supabase migration + `src/App.jsx`
- **Cambios SQL**:
  - `ALTER TABLE student_leads ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ`
  - Backfill con `created_at` para registros históricos
  - Trigger `trg_status_updated_at`: se dispara en BEFORE UPDATE, actualiza `status_updated_at = NOW()` solo cuando `status` cambia
- **Cambio App.jsx (línea 3169)**: `daysSince(s.created_at)` → `daysSince(s.status_updated_at || s.created_at)`
- **Podría afectar**: lista de expedientes — badge naranja "inactivo" ya no aparece para expedientes viejos cuyo status se haya actualizado recientemente
- **Verificado**: columna y trigger verificados en `information_schema`; build limpio

---

## 2026-05-03 — sesion-13: notificaciones email al estudiante — estado documentos, mensajes del equipo, matches nuevos (Resend + Edge Function)

- **Qué**: Notificaciones automáticas por email al estudiante en 3 eventos: cambio de estado de documento, mensaje del equipo, y matches nuevos
- **Por qué**: El estudiante no sabía cuándo pasaba algo en su expediente — tenía que entrar al portal a comprobarlo
- **Archivos modificados**: `src/App.jsx`, `supabase/functions/notify-student/index.ts` (nuevo), Supabase SQL
- **Cambios principales**:
  - **Edge Function `notify-student`** (nueva, desplegada): 3 templates HTML con el diseño Meridian; detecta tanto llamadas desde App.jsx como Database Webhooks de Supabase; throttle para matches (solo notifica en el 1.º o cada 10 para evitar spam si n8n inserta en bulk)
  - **`notifyStudent(payload)`** helper global en App.jsx: fire-and-forget — errores no bloquean el flujo del equipo
  - **Trigger en `patchDocument`**: cuando el equipo cambia el estado de un doc y el estudiante tiene portal activo (`client_user_id`), dispara notificación tipo `doc_status_changed`
  - **`sendTeamComment()`** en `StudentDetail`: nueva función que inserta en `document_comments` con `author_type: 'team'` y `student_id` (sin FK a doc específico), luego dispara notificación tipo `team_comment`
  - **UI caja de mensaje**: aparece en la pestaña Documentación de cada expediente cuando el estudiante tiene portal activo; botón deshabilitado si el campo está vacío
  - **SQL `document_comments`**: `student_document_id` ahora permite NULL (comentarios generales de expediente); nueva columna `student_id UUID` con FK a `student_leads`; política RLS `client_read_own_comments` actualizada para incluir ambos tipos de comentario
- **Parte E pendiente (manual)**: En Supabase Dashboard → Database → Webhooks → crear hook `notify-on-new-matches` en tabla `matches`, evento INSERT, tipo Edge Function `notify-student`
- **Podría afectar**: `PortalCliente` tab Documentos — los comentarios de equipo con `author_type: 'team'` ya se renderizan correctamente (misma lógica de sesión anterior)
- **Verificado**: build limpio (vite build ✓ en 675ms, 0 errores); Edge Function desplegada (status ACTIVE)

---

## 2026-05-02 — sesion-12: RLS y permisos por rol — aislamiento de datos entre roles

- **Qué**: Modelo de permisos correcto para admin/team/cliente en las 5 tablas principales; equipo ve todos los expedientes
- **Por qué**: La política permisiva `authenticated_rw` dejaba que cualquier estudiante autenticado leyera todos los datos de otros estudiantes vía REST API
- **Archivos modificados**: Supabase migrations + `src/App.jsx`
- **Cambios SQL (5 migraciones):**
  - `student_leads`: eliminadas 3 políticas permisivas → 2 nuevas (`team_all_leads` para admin+team, `client_read_own_lead` para cliente vía `client_user_id`)
  - `matches`: habilitado RLS + eliminada `authenticated_rw` → 3 nuevas (`team_all_matches`, `client_read_own_matches`, `client_update_own_matches`)
  - `student_documents`: eliminada `authenticated_full_access` → 3 nuevas (`team_all_docs`, `client_read_own_docs`, `client_update_own_docs`)
  - `document_comments`: eliminada `authenticated_rw` → 3 nuevas (`team_all_comments`, `client_read_own_comments`, `client_insert_own_comments` — esta última fuerza `author_id = auth.uid()` y `author_type = 'cliente'`)
  - `programas`: añadida `team_write_programas` (ALL para admin+team) para que los PATCH de visa_eligible/URLs funcionen sin necesidad de service_role key en el frontend
- **Cambio App.jsx**: eliminado filtro `if (user.role === "team") url += assigned_to=eq...` — el team ahora ve todos los expedientes (controlado por RLS)
- **Podría afectar**: portal del estudiante (si `user_metadata.role` no es exactamente `'cliente'`, sus matches no cargarán — verificar); funciones n8n no afectadas (usan service_role key que bypasea RLS)
- **Verificado**: build limpio (vite build ✓ en 673ms, 0 errores); políticas verificadas con `pg_policies`

---

## 2026-05-02 — sesion-11: lista expedientes con badge de matches, alerta inactividad, indicador portal y asesor

- **Qué**: Tres indicadores nuevos en cada item de la lista de estudiantes para priorizar atención de un vistazo
- **Por qué**: El equipo tenía que abrir cada expediente para saber si tenía matches o llevaba tiempo sin avanzar
- **Archivos modificados**: `src/App.jsx`
- **Cambios principales**:
  - **Estado `matchCounts` / `matchCountsLoaded`**: nueva query ligera a `matches?select=student_id` que construye un mapa `{ student_id: count }` — se carga en paralelo con `loadDocsPendientes` al abrir el panel
  - **Badge de matches** (fila 4): verde "X prog." si tiene matches, rojo "Sin matches" si tiene 0, "…" mientras carga
  - **Alerta de inactividad** (fila 1): badge naranja con número de días si el estudiante lleva >14 días en estado `nuevo`
  - **Indicador portal** (fila 1): icono 🔑 si `client_user_id` no es nulo (tiene acceso activo al portal)
  - **Nombre asesor** (fila 3): resuelto desde `TEAM_FALLBACK` — muestra "grado · María" en vez de email largo
  - **Helper `daysSince`**: nueva función global junto a `formatDate`
  - **Botón ↻ Actualizar**: ahora llama también a `loadMatchCounts()` para refrescar los badges
- **Podría afectar**: solo la lista de items en la vista Expedientes — sin cambios en `StudentDetail`, portal ni parte pública
- **Verificado**: build limpio (vite build ✓ en 623ms, 0 errores)

---

## 2026-05-02 — sesion-10: portal tracker navegable como tabs + fix próxima convocatoria muestra plazo inscripción

- **Qué**: Tracker de 4 pasos pasa de decorativo a navegación por pestañas; fix de "Próxima convocatoria" que mostraba inicio de clases en vez del plazo de inscripción más próximo
- **Por qué**: El portal era scroll plano sin estructura; "Sep 2026" no es accionable para el estudiante; "Feb–Abr 2026" para masters no estaba marcado como pasado
- **Archivos modificados**: `src/App.jsx`
- **Cambios principales**:
  - **Estado `portalTab`**: nuevo `useState("programas")` — el portal abre directamente en la sección de programas
  - **Tracker interactivo**: clic en cualquier paso cambia la sección activa; paso activo tiene halo purple (#7c3aed) y label en negrita
  - **Contenido por tabs**: 4 secciones condicionales (Perfil / Programas+Convocatorias / Documentos / Solicitudes) reemplazan el scroll continuo
  - **Fix `convocatorias`**: "Plazo general universidades públicas Feb–Abr 2026" y "Másters con nota de corte Ene–Mar 2026" ahora con `past: true`; convocatorias pasadas muestran tachado, opacity 0.5 y prefijo "✓"
  - **Fix `proximaConv`**: lógica dinámica que busca el primer plazo no vencido y sin "Inicio de clases"; label de la tarjeta también es dinámico (`proximaConvLabel`)
  - **Stats clickables**: tarjetas de stats con `onClick` navegan al tab correcto (Programas/Documentos)
  - **Tab Perfil**: vista de solo lectura con datos del `lead` (nombre, país, nivel, área, ciudades, origen)
  - **Tab Solicitudes**: muestra programas en `match_stage === 'solicitud'` con enlace "Solicitar plaza", o estado vacío
- **Podría afectar**: solo `PortalCliente` — sin cambios en panel admin ni parte pública
- **Verificado**: build limpio (vite build ✓ en 659ms, 0 errores)

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
