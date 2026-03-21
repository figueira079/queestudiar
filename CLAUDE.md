# QueEstudiar — Claude Context File
Last updated: 2026-03-21

## Qué hace este proyecto
Plataforma para estudiantes internacionales que quieren estudiar en España.
Parte pública: test vocacional + explorador de programas.
Parte admin (CRM): gestión de expedientes de estudiantes y sus matches con programas.

## Stack
- Frontend: React 18 + Vite 5 (SPA de un solo archivo)
- Backend: Supabase (PostgreSQL + GoTrue Auth)
- Deploy: Vercel (auto-deploy desde GitHub main)
- DNS: IONOS → Vercel

## Arquitectura

```
queestudiar.es (público)          app.queestudiar.es (admin/CRM)
        │                                    │
        └──────────────┬─────────────────────┘
                       │ fetch directo (REST)
                       ▼
              Supabase PostgreSQL
              nplwpuywgqagdedwbenm.supabase.co
```

## Estructura de archivos

```
queestudiar-repo/
├── CLAUDE.md           ← este archivo
├── index.html          ← SEO (Open Graph, Twitter Cards)
├── package.json
├── vite.config.js
├── .env.local          ← NO subir a git (contiene keys)
├── public/
│   ├── sitemap.xml
│   └── robots.txt      ← PENDIENTE crear
└── src/
    ├── main.jsx        ← Entry point (213 bytes, no tocar)
    └── App.jsx         ← TODA la app (2,078 líneas)
```

## ADVERTENCIA CRÍTICA: App.jsx es monolítico

**TODA la aplicación vive en `src/App.jsx` (2,078 líneas).**
Este es el mayor riesgo del proyecto. Cualquier cambio puede afectar
partes no relacionadas. Leer el mapa de secciones antes de editar.

### Mapa de secciones en App.jsx
| Líneas | Contenido | Riesgo si se toca |
|--------|-----------|-------------------|
| 1-170 | Helpers, config, funciones de autenticación y query | CRÍTICO — todo depende de esto |
| 350-895 | Componentes admin (Login, StudentDetail, FeedbackPopup...) | ALTO — afecta CRM |
| 1150-1890 | Componentes públicos (Landing, MatchForm, ProgramBrowser...) | ALTO — afecta web pública |
| 1895 | Detección de dominio (public vs admin) | CRÍTICO — lógica de routing |
| 1902-2078 | App raíz + TEAM_FALLBACK + routing por hash | ALTO |

## Base de datos — Tablas y contratos

### `programas` (10,135 registros, 29 columnas)
Columnas clave: `id, nombre, tipo, familia_area, ciudad, modalidad, precio_anual_eur, precio_extracomunitario_eur, horas_semanales, activo, url_detalle, url_detalle_status, url_solicitud, url_solicitud_status, idioma`

Distribución tipo: master(5017) · grado(3414) · doctorado(1614) · fp_superior(90)

⚠ Valores NULL conocidos (no son bugs):
- `horas_semanales` NULL en master y doctorado — el equipo los rellena manualmente
- `modalidad` NULL en ~93% — solo fp_superior tiene "presencial"
- `precio_extracomunitario_eur` NULL cuando el precio es igual al de UE o no aplica
- `url_detalle_status` / `url_solicitud_status` valores posibles: NULL · `"generica"` · `"rota"` · `"manual_ok"`
- `idioma` NULL en la mayoría de registros

### `student_leads` (28 registros)
Columnas clave: `id, full_name, email, country_of_origin, status, assigned_to`

### `matches` (908 registros)
Relación: `student_leads.id → matches.student_id → programas.id`
Si se borra un programa → verificar que no queden matches huérfanos

### `public_leads` (tabla de captación pública)
Columnas: `full_name, email, phone, country_of_origin, flow_type, student_origin, education_level, study_area, preferred_cities, selected_programa_ids`

Valores de `flow_type`: `"indeciso"` (viene del test vocacional / MatchResults) · `"decidido"` (viene del explorador / SolicitudForm)
RLS: debe permitir INSERT anónimo (sin autenticación). No leer desde el CRM — estos leads los procesa n8n.

### `feedback` (tabla nueva)
`id, user_email, user_name, action_type, rating(1-5), comment, created_at, reviewed`
RLS habilitado. Solo accesible para authenticated.

### `admission_requirements` y `admission_by_region`
Solo lectura desde el frontend. No modificar esquema sin revisar `RequirementsPanel` y `RegionPanel`.

## Autenticación — Cómo funciona

```
Login → Supabase GoTrue → JWT token → localStorage → headers en cada request
```

Funciones críticas en App.jsx líneas 1-170:
- `authSignIn` / `authRefreshToken` / `authSignOut`
- `saveSession` / `loadSession` / `clearSession`
- `query()` / `patch()` — wrappers REST que añaden el token automáticamente

⚠ Si `VITE_SUPABASE_KEY` es la key `anon` en lugar de `service_role`:
- Login funciona ✓
- Queries normales funcionan ✓
- `adminListUsers` / `adminCreateUser` / `adminDeleteUser` fallan SILENCIOSAMENTE ✗

## Routing

Detección por dominio (App.jsx ~línea 1895):
- `queestudiar.es` → parte pública
- `app.queestudiar.es` → panel admin
- `localhost` → ambos accesibles

Routing por hash:
| Hash | Componente |
|------|-----------|
| `#/` | LandingPage |
| `#/match` | MatchForm |
| `#/match/resultados` | MatchResults |
| `#/programas` | ProgramBrowser |
| `#/solicitud` | SolicitudForm |
| `#/admin` | Panel CRM (requiere login) |

⚠ Edge case documentado: En `app.queestudiar.es` las rutas públicas (`#/`, `#/programas`, etc.) son accesibles cambiando el hash manualmente. Comportamiento esperado para el equipo interno — no es un bug.

## Variables de entorno necesarias

```bash
VITE_SUPABASE_URL=https://nplwpuywgqagdedwbenm.supabase.co
VITE_SUPABASE_KEY=TU_SERVICE_ROLE_KEY_AQUI  # service_role key (no commitear el valor real)
```

En local: `.env.local` (no subir a git)
En producción: configuradas en Vercel dashboard

## Zonas de alto riesgo

| Zona | Riesgo | Por qué |
|------|--------|---------|
| App.jsx líneas 1-170 | CRÍTICO | Base de toda la autenticación y queries. Si falla, nada funciona. |
| Detección de dominio (~línea 1895) | CRÍTICO | Decide qué app mostrar. Error aquí → admin expuesto o público roto. |
| `TEAM_FALLBACK` (~línea 1902) | MEDIO | Lista hardcodeada. Si se añaden miembros, actualizar aquí también. |
| Tabla `matches` | ALTO | 908 relaciones. Cambios en `programas.id` o `student_leads.id` rompen matches. |
| `VITE_SUPABASE_KEY` | CRÍTICO | Si se cambia a anon key, las funciones admin fallan en silencio. |

## Workarounds documentados (no "arreglar" sin entender)

- **`TEAM_FALLBACK` hardcodeado**: La API de Supabase para listar usuarios requiere service_role key. Como workaround de desarrollo, los miembros del equipo están hardcodeados para el dropdown de asignación. La solución real es llamar a `adminListUsers()`, pero depende de que la key correcta esté configurada.
- **Hash routing en lugar de path routing**: Se usa `#/ruta` para evitar configuración de redirects en Vercel para SPA. Si se migra a path routing, hay que añadir `vercel.json` con rewrite rules.

## Pendientes conocidos (no son bugs, son tareas)

- [x] Crear `.gitignore` ✓
- [ ] Crear `public/robots.txt`
- [ ] Verificar que `VITE_SUPABASE_KEY` en Vercel es service_role (no anon)
- [ ] Rellenar `horas_semanales` para masters y doctorados (tarea del equipo)
- [ ] Google Search Console: enviar sitemap
- [ ] Workflow n8n para revisión automática de feedback
- [ ] Estadísticas en `LandingPage` hardcodeadas (10.135 programas, 28 ciudades) — actualizar manualmente cuando cambien
- [ ] Fechas en `SolicitudForm` hardcodeadas (sept-2026, ene-2027, sept-2027) — actualizar cuando lleguen

## Cómo deployar

```bash
git add .
git commit -m "tipo: descripción"
git push origin main
# Vercel despliega automáticamente
```

## Protocolo obligatorio para Claude Code

Antes de cualquier cambio en App.jsx:
1. Identificar en qué líneas está el código a modificar
2. Listar qué otros componentes podrían verse afectados
3. Confirmar antes de editar

Durante el desarrollo:
- Un solo cambio conceptual por paso
- No refactorizar Y añadir funcionalidad en el mismo paso
- Si algo falla inesperadamente → parar y reportar, no continuar
- Mejoras fuera de scope → anotar aquí en Pendientes, no implementar ahora

Después de cada cambio:
- Verificar que el login sigue funcionando
- Verificar que la parte pública sigue cargando
- Añadir entrada a CHANGES.md

## DO NOT

- No cambiar la estructura de columnas de `programas` sin verificar todos los componentes que las usan
- No reemplazar `query()` o `patch()` por fetch directo — estos wrappers añaden el token de auth
- No mover lógica de la detección de dominio sin probar en los dos dominios
- No subir `.env.local` al repositorio
- No cambiar el hash routing a path routing sin añadir rewrite rules en Vercel
