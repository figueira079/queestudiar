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
