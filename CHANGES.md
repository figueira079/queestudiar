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
