# QueEstudiar — Sistema de Identidad Visual
**Meridian Navigation** · Edición 2026

> Este documento es la fuente de verdad del diseño de QueEstudiar.
> Todo componente nuevo debe referenciarse aquí antes de implementarse.

---

## Filosofía: Meridian Navigation

El lenguaje visual de QueEstudiar se construye sobre la metáfora de la precisión cartográfica encontrándose con el calor mediterráneo. Como una brújula que encuentra el norte a través de capas de complejidad, el sistema comunica orientación, confianza y posibilidad.

El espacio es silencio estructurado. Los márgenes amplios, el respiro controlado y los intervalos deliberados permiten que el significado se acumule sin ruido. Cada elemento —cada rectángulo, cada arco, cada línea tipográfica— ha ganado su lugar por lógica compositional rigurosa.

---

## Paleta de color

### Colores primarios

| Token            | Hex       | Uso                                           |
|------------------|-----------|-----------------------------------------------|
| `azure`          | `#2563eb` | Acción primaria, navegación, estado activo    |
| `terra`          | `#e8531a` | Acento cultural, CTAs urgentes, calidez       |
| `sage`           | `#16a34a` | Progreso, estado completado, éxito            |

### Neutros

| Token            | Hex       | Uso                                           |
|------------------|-----------|-----------------------------------------------|
| `midnight`       | `#0f172a` | Texto primario, fondos oscuros                |
| `graphite`       | `#334155` | Texto secundario                              |
| `slate`          | `#94a3b8` | Texto terciario, labels, placeholders         |
| `rule`           | `#e2e8f0` | Bordes, divisores, hairlines                  |
| `parchment`      | `#faf6f0` | Fondo principal (warm off-white)              |
| `ice`            | `#f0f4ff` | Fondo alternativo (cool off-white)            |
| `white`          | `#ffffff` | Superficies de tarjeta                        |

### Tints (fondos de badge)

| Token            | Hex       | Par con        |
|------------------|-----------|----------------|
| `azure-light`    | `#dbeafe` | `azure`        |
| `terra-light`    | `#fde8df` | `terra`        |
| `sage-light`     | `#dcfce7` | `sage`         |
| `warning-light`  | `#fef9c3` | `#ca8a04`      |

### Reglas de contraste
- Texto `midnight` sobre `parchment` o `white` → ✓ AAA
- Texto `white` sobre `azure`, `terra`, `sage`, `midnight` → ✓ AA+
- Nunca combinar `azure` y `terra` como pesos visuales iguales
- Mínimo ratio 4.5:1 entre texto y fondo (WCAG AA)

---

## Tipografía

### Sistema

| Rol               | Familia                | Variante       | Tamaño ref.  |
|-------------------|------------------------|----------------|--------------|
| Display / Titulares | Bricolage Grotesque  | Bold           | 28–42pt      |
| Subtítulos H3/H4  | Bricolage Grotesque    | Bold           | 13–20pt      |
| Cuerpo editorial  | Lora                   | Regular        | 11–13pt      |
| Cuerpo UI         | Work Sans              | Regular / Bold | 8–11pt       |
| Datos / Monoespaciado | IBM Plex Mono     | Regular / Bold | 7–11pt       |

### Uso

- **Bricolage Grotesque Bold** → cualquier titular, nombre de sección, wordmark
- **Lora Regular / Italic** → texto largo, descripciones, citas, taglines
- **Work Sans** → labels, botones, navegación, contenido de tarjeta
- **IBM Plex Mono** → IDs de expediente, precios, fechas, estados del sistema, métricas

### Escala tipográfica

```
42pt — Display (portada, héroes)
28pt — H1
20pt — H2
16pt — H3
13pt — H4
12pt — Cuerpo
11pt — Cuerpo pequeño
10pt — Caption
8–9pt — Label / Tag
7.5pt — Micro / Mono label
```

---

## Logo y marca

### Construcción

```
▸ QueEstudiar
```

El símbolo `▸` (triángulo de reproducción) comunica movimiento hacia adelante.
Separación entre símbolo y wordmark: `0.5×` la altura del símbolo.

### Versiones

| Versión     | Fondo          | Símbolo       | Wordmark       |
|-------------|----------------|---------------|----------------|
| Estándar    | Pergamino/White | Azure         | Midnight       |
| Digital activo | Azure      | White         | White          |
| Nocturno    | Midnight       | Terra         | White          |
| Ícono solo  | Cualquiera     | Color primario | —             |

### Zona de exclusión
Mínimo `1×` la altura total del símbolo en todos los lados.

### Prohibiciones
- No deformar ni rotar el logo
- No usar sobre fondos que no cumplan contraste mínimo
- No aplicar efectos (sombra, gradiente, relieve)
- No combinar Azure y Terra en el mismo elemento del logo

---

## Componentes

### Botones

```
Primario:    bg=azure,     texto=white,    borde-radius=6px
Secundario:  bg=white,     texto=azure,    borde=1.5px azure
Destructivo: bg=terra,     texto=white
Éxito:       bg=sage,      texto=white
Ghost:       bg=parchment, texto=graphite, borde=1px rule
```

Altura estándar: `36px` desktop · `44px` móvil
Font: `Work Sans Bold 9pt`

### Tarjetas de programa

Estructura:
1. Barra de acento superior (4px) en `azure` o `terra`
2. Nombre del programa — `WorkSans Bold 10pt, midnight`
3. Universidad — `WorkSans 8.5pt, graphite`
4. Hairline
5. Precio — `Bricolage Bold 13pt, azure` (o `terra` si es favorito)
6. Detalles secundarios — `WorkSans 8pt, graphite`
7. Badges (visa, match %) en tints

Borde: `1px rule` · Radio: `8px` · Fondo: `white`

### Badges de estado

| Estado               | Fondo          | Texto           |
|----------------------|----------------|-----------------|
| Nuevo                | `azure-light`  | `azure`         |
| En proceso           | `warning-light`| `#ca8a04`       |
| Documentación lista  | `sage-light`   | `sage`          |
| Acción requerida     | `terra-light`  | `terra`         |
| Archivado            | `#f1f5f9`      | `graphite`      |

### Campos de formulario

```
Inactivo: borde 1px rule, bg white
Focus:    borde 1.5px azure, label color azure
Error:    borde 1.5px terra, mensaje error terra
```

Radio: `6px` · Altura: `48px` · Font: `Work Sans`

### Navegación (portal)

- Sidebar: `bg #f8fafc`, ancho `160px` desktop
- Item activo: `bg azure-light`, texto `azure bold`
- Item normal: texto `graphite`
- Labels de sección: `IBM Plex Mono 7pt, slate, uppercase`

---

## Voz de marca

Si QueEstudiar fuera una persona, sería un orientador universitario experto que conoce España como la palma de su mano y habla con calidez mediterránea y precisión académica.

### Atributos

**Orientador, no vendedor**
- Somos: guiamos con datos y empatía, no con presión
- No somos: marketplace frío ni agente de ventas

**Preciso, no técnico**
- Somos: información clara sobre visas, costes, plazos — en lenguaje humano
- No somos: una burocracia confusa ni un PDF gubernamental

**Cálido, no informal**
- Somos: cercanía con profesionalismo, tuteo con respeto
- No somos: un amigo de WhatsApp ni una institución distante

**Optimista, no ingenuo**
- Somos: celebramos logros, somos honestos sobre los retos del proceso
- No somos: promesas vacías ni letra pequeña escondida

### Tono por contexto

| Contexto           | Tono                              |
|--------------------|-----------------------------------|
| Onboarding         | Bienvenida cálida, pasos claros   |
| Resultados de match | Celebración medida, datos claros |
| Documento pendiente | Urgencia amable, sin alarmar     |
| Error / fallo      | Empático, solución inmediata      |
| Email de invitación | Formal pero cercano, confiable   |

---

## Elementos decorativos

### Arcos de navegación
Arcos concéntricos a trazos finos (`0.2–0.8pt`) en `azure`, `terra` o `slate`.
Uso: esquinas de páginas, fondos de cabeceras, separadores visuales.
Nunca rellenos — siempre stroke.

### Barra lateral de página
`4px` vertical, altura completa, color varía por sección:
- Azure → sección digital/técnica
- Terra → sección cultural/identidad
- Sage → sección de logros/progreso
- Midnight → sección oscura/cierre

### Hairlines
`0.4–0.8pt` en `rule (#e2e8f0)`. Nunca más gruesas.
Uso: separar secciones, enmarcar datos, estructurar layouts.

---

## Aplicación — Tema claro

El panel admin y el portal del estudiante operan en tema **claro** por defecto.

```
Fondo de página:    parchment (#faf6f0)
Fondo de tarjeta:   white (#ffffff)
Fondo de sidebar:   #f8fafc
Texto primario:     midnight (#0f172a)
Texto secundario:   graphite (#334155)
Texto terciario:    slate (#94a3b8)
Bordes:             rule (#e2e8f0)
```

El tema oscuro se reserva para páginas de portada, estados especiales y elementos de énfasis.

---

## Pendientes de implementación

- [ ] Migrar colores de App.jsx de variables hardcodeadas a CSS custom properties / tokens
- [ ] Implementar Bricolage Grotesque en titulares del admin panel (actualmente sistema font)
- [ ] Actualizar fondo del admin panel de `#1e293b` a `#faf6f0` (parchment)
- [ ] Aplicar sistema de badges a columna de estado en tabla de expedientes
- [ ] Unificar tarjetas de programa con barra de acento superior
- [ ] Revisar spacing: adoptar escala 4px (4, 8, 12, 16, 24, 32, 48, 64)

---

*Meridian Navigation — QueEstudiar 2026*
