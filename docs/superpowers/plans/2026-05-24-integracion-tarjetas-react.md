# Integración tarjetas rediseñadas en React

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `ProgramCardCompact` en `ProgramBrowser` con la nueva tarjeta rediseñada (favoritos localStorage, comparador localStorage con restricción de tipo, barra comparadora fija, modal comparativo).

**Architecture:** Todo en `src/App.jsx`. Se añade CSS al template string `publicCss` (línea 1755), se crea el componente `ProgramCardNew` después de `ProgramCardCompact` (~línea 2767), y se extiende `ProgramBrowser` con estado de favoritos/comparador + compare bar + modal. Sin dependencias externas nuevas.

**Tech Stack:** React 18 (useState, useEffect, useRef), localStorage, CSS en template string `publicCss`.

**Contexto crítico del codebase:**
- `src/App.jsx` tiene 4286 líneas. Líneas 1–170 son CRÍTICAS (auth/helpers) — no tocar.
- El CSS público está en `const publicCss` (líneas 1755–2120, cierra con `` `; `` en línea 2120).
- `TIPO_LABELS` está en línea 1733 y es accesible desde cualquier componente del archivo.
- `getAreaImage(familiaArea, offset)` está en línea 2734.
- La query de Supabase en `ProgramBrowser` (línea 2837) no incluye `idioma` aún.
- Los campos `empleabilidad`, `valoracion`, `num_resenas`, `sello`, `keywords`, `asignaturas`, `saved_count` **no existen en la BD** — el componente los maneja como `null` (secciones opcionales que no se renderizan si el dato es null).

---

## Archivos

| Acción | Ruta | Responsabilidad |
|---|---|---|
| Modificar | `src/App.jsx:2049` | Añadir CSS de la nueva card al final de la sección de card CSS en `publicCss` |
| Modificar | `src/App.jsx:2119` | Añadir CSS del compare bar, modal y toast al final de `publicCss` |
| Modificar | `src/App.jsx:2767` | Insertar `ProgramCardNew` tras el cierre de `ProgramCardCompact` |
| Modificar | `src/App.jsx:2820` | Extender `ProgramBrowser` con estado, compare bar, modal y toast |

---

### Task 1: CSS de la nueva card en `publicCss`

**Files:**
- Modify: `src/App.jsx` — insertar CSS dentro de `publicCss`, justo después de la línea 2049 (`.pub-card-compact-price{...}`)

- [ ] **Leer las líneas 2047–2052 para confirmar el punto de inserción**

```bash
sed -n '2047,2052p' src/App.jsx
```
Esperado: debe verse `.pub-card-compact-price{...}` en la última línea de estilos de la card compact.

- [ ] **Insertar el CSS de la nueva card**

Localizar la línea exacta:
```
.pub-card-compact-price{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:500;color:var(--azure);}
```

Después de esa línea, insertar:

```css
/* ── Nueva card rediseñada ── */
.qe-card{background:var(--blanco);border-radius:14px;border:1.5px solid var(--linea);box-shadow:0 2px 12px rgba(0,0,0,0.07);overflow:hidden;transition:box-shadow 0.2s,transform 0.2s,border-color 0.2s;display:flex;flex-direction:column;cursor:pointer;}
.qe-card:hover{box-shadow:0 8px 28px rgba(37,99,235,0.15);transform:translateY(-2px);}
.qe-card.is-favorited{border-color:#fbbf24;}
.qe-card.is-compared{border-color:var(--azure);box-shadow:0 0 0 3px rgba(37,99,235,0.12);}
.qe-card.is-favorited.is-compared{border-color:#fbbf24;}
.qe-card-header{position:relative;height:100px;overflow:hidden;flex-shrink:0;}
.qe-card-header-img{position:absolute;inset:0;background-size:cover;background-position:center;transition:transform 0.4s ease;}
.qe-card:hover .qe-card-header-img{transform:scale(1.04);}
.qe-card-header-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(10,10,30,.3) 0%,rgba(10,10,30,.78) 100%);}
.qe-card-header-content{position:absolute;inset:0;padding:10px 12px;display:flex;flex-direction:column;justify-content:space-between;}
.qe-card-header-top{display:flex;justify-content:space-between;align-items:flex-start;}
.qe-badge-tipo{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:3px 8px;border-radius:20px;background:rgba(255,255,255,.18);color:#fff;border:1px solid rgba(255,255,255,.25);}
.qe-badge-tipo.master{background:rgba(37,99,235,.8);}
.qe-badge-tipo.grado{background:rgba(22,163,74,.8);}
.qe-badge-tipo.fp_superior{background:rgba(245,158,11,.8);}
.qe-badge-tipo.doctorado{background:rgba(107,114,128,.8);}
.qe-badge-seal{font-size:9px;font-weight:700;padding:3px 8px;border-radius:20px;background:#fde68a;color:#78350f;}
.qe-card-title{font-size:12px;font-weight:700;color:#fff;line-height:1.3;margin-bottom:3px;text-shadow:0 1px 4px rgba(0,0,0,.4);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.qe-card-univ{font-size:10px;color:rgba(255,255,255,.75);display:flex;align-items:center;gap:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.qe-logo-badge{width:18px;height:18px;background:#fff;border-radius:3px;display:inline-flex;align-items:center;justify-content:center;font-size:7px;font-weight:800;color:var(--grafito);flex-shrink:0;}
.qe-logo-img{width:18px;height:18px;object-fit:contain;background:rgba(255,255,255,.9);border-radius:3px;flex-shrink:0;}
.qe-metrics{display:flex;border-bottom:1px solid var(--linea);flex-shrink:0;}
.qe-metric{flex:1;padding:7px 4px;text-align:center;border-right:1px solid var(--linea);}
.qe-metric:last-child{border-right:none;}
.qe-metric-val{font-size:11px;font-weight:700;color:var(--grafito);display:block;line-height:1.2;}
.qe-metric-val.empleo{color:var(--salvia);}
.qe-metric-val.na{font-size:9px;color:var(--pizarra);}
.qe-metric-lbl{font-size:8px;color:var(--pizarra);display:block;margin-top:1px;}
.qe-card-body{padding:10px 12px 0;flex:1;}
.qe-keywords{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;}
.qe-kw{font-size:9px;background:var(--hielo);color:var(--azure);padding:3px 7px;border-radius:20px;font-weight:500;}
.qe-rating{display:flex;align-items:center;gap:5px;margin-bottom:8px;}
.qe-stars{color:var(--generica);font-size:11px;letter-spacing:-.5px;}
.qe-rating-text{font-size:10px;color:var(--pizarra);}
.qe-quickview-btn{font-size:10px;color:var(--azure);background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;gap:3px;font-weight:500;}
.qe-quickview-arrow{transition:transform 0.2s;display:inline-block;font-style:normal;}
.qe-quickview-btn.open .qe-quickview-arrow{transform:rotate(90deg);}
.qe-quickview-content{overflow:hidden;max-height:0;transition:max-height 0.25s ease;}
.qe-quickview-content.open{max-height:60px;padding:6px 0 2px;}
.qe-quickview-content span{display:inline-block;background:var(--hielo);padding:2px 7px;border-radius:4px;margin:2px 2px 0 0;font-size:9px;color:var(--grafito-s);}
.qe-card-footer{display:flex;align-items:center;justify-content:space-between;padding:9px 12px 12px;margin-top:8px;border-top:1px solid var(--linea);flex-shrink:0;}
.qe-price{font-size:13px;font-weight:800;color:var(--grafito);line-height:1;font-family:'IBM Plex Mono',monospace;}
.qe-saved-count{font-size:9px;color:var(--pizarra);margin-top:2px;}
.qe-actions{display:flex;gap:5px;align-items:center;}
.qe-btn-icon{width:30px;height:30px;border:1.5px solid var(--linea);border-radius:8px;background:var(--blanco);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:14px;transition:background .15s,border-color .15s;flex-shrink:0;}
.qe-btn-icon:hover{background:var(--hielo);}
.qe-btn-icon.fav-active{background:#fff9e6;border-color:#fbbf24;}
.qe-btn-icon.cmp-active{background:var(--hielo);border-color:var(--azure);}
.qe-btn-icon.cmp-disabled{opacity:.35;cursor:not-allowed;}
.qe-btn-icon.cmp-disabled:hover{background:var(--blanco);}
.qe-btn-ver{background:var(--azure);color:#fff;border:none;border-radius:8px;padding:7px 12px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;transition:background .15s;text-decoration:none;display:inline-flex;align-items:center;}
.qe-btn-ver:hover{background:var(--azure-hover,#1d4ed8);}
```

- [ ] **Insertar CSS del compare bar, modal y toast al final de `publicCss`**

Localizar la línea que contiene:
```
}
@media(max-width:480px){
```
(el cierre `}` del bloque `@media(max-width:768px)` y el inicio del siguiente)

Insertar justo antes del cierre del backtick final de `publicCss` (línea `\`;` que está en línea 2120), es decir, después de la última regla CSS dentro de `publicCss`:

```css
/* ── Compare bar ── */
.qe-compare-bar{position:fixed;bottom:0;left:0;right:0;z-index:200;background:#0f172a;padding:12px 24px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;box-shadow:0 -4px 24px rgba(0,0,0,.3);animation:qeSlideUp .25s ease;}
@keyframes qeSlideUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
.qe-cmp-label{font-size:11px;color:rgba(255,255,255,.5);white-space:nowrap;}
.qe-cmp-tipo{font-size:12px;font-weight:700;color:#93c5fd;white-space:nowrap;}
.qe-cmp-chips{display:flex;gap:6px;flex:1;flex-wrap:wrap;}
.qe-cmp-chip{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:4px 10px;font-size:10px;color:#fff;display:flex;align-items:center;gap:5px;white-space:nowrap;}
.qe-cmp-chip-x{opacity:.55;cursor:pointer;font-size:14px;line-height:1;transition:opacity .15s;border:none;background:none;color:#fff;padding:0;}
.qe-cmp-chip-x:hover{opacity:1;}
.qe-cmp-btn-now{background:var(--azure);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;}
.qe-cmp-btn-now:hover{background:#1d4ed8;}
.qe-cmp-btn-now:disabled{background:#6b7280;cursor:not-allowed;}
.qe-cmp-btn-clear{background:transparent;color:rgba(255,255,255,.4);border:none;font-size:11px;cursor:pointer;white-space:nowrap;}
.qe-cmp-btn-clear:hover{color:rgba(255,255,255,.9);}
/* ── Compare modal ── */
.qe-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;}
.qe-modal-box{background:var(--blanco);border-radius:16px;width:100%;max-width:760px;max-height:85vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.2);}
.qe-modal-header{padding:16px 20px;border-bottom:1px solid var(--linea);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--blanco);z-index:1;}
.qe-modal-title{font-size:15px;font-weight:700;color:var(--grafito);font-family:'Bricolage Grotesque',system-ui,sans-serif;}
.qe-modal-close{background:none;border:none;font-size:22px;cursor:pointer;color:var(--pizarra);line-height:1;}
.qe-modal-close:hover{color:var(--grafito);}
.qe-cmp-table{width:100%;border-collapse:collapse;font-size:12px;}
.qe-cmp-table th{padding:10px 14px;text-align:left;background:#f9fafb;font-weight:600;color:var(--pizarra);font-size:11px;border-bottom:1px solid var(--linea);position:sticky;top:53px;z-index:1;}
.qe-cmp-table th.prog-col{color:var(--grafito);font-weight:700;min-width:160px;}
.qe-cmp-table td{padding:9px 14px;border-bottom:1px solid var(--linea);color:var(--grafito-s);vertical-align:top;}
.qe-cmp-table td.attr{font-weight:600;color:var(--pizarra);font-size:11px;background:#fafafa;width:100px;white-space:nowrap;}
.qe-cmp-table tr:last-child td{border-bottom:none;}
.qe-cmp-empleo-val{color:var(--salvia);font-weight:700;}
.qe-cmp-stars{color:var(--generica);font-size:11px;}
.qe-modal-footer{padding:14px 20px;border-top:1px solid var(--linea);display:flex;justify-content:flex-end;}
.qe-modal-btn-close{background:var(--azure);color:#fff;border:none;border-radius:8px;padding:8px 20px;font-size:12px;font-weight:700;cursor:pointer;}
/* ── Toast ── */
.qe-toast{position:fixed;top:72px;left:50%;transform:translateX(-50%);background:var(--grafito);color:#fff;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,.25);z-index:9999;animation:qeToastIn .2s ease;white-space:nowrap;}
@keyframes qeToastIn{from{opacity:0;transform:translateX(-50%) translateY(-6px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
```

- [ ] **Verificar sintaxis — `npm run build`**

```bash
npm run build 2>&1 | tail -20
```
Esperado: `✓ built in` sin errores. Si hay error de CSS (improbable en template string) revisar que los backticks internos estén escapados.

- [ ] **Commit**

```bash
git add src/App.jsx
git commit -m "feat(explorer): add new card + compare bar + modal CSS to publicCss"
```

---

### Task 2: Componente `ProgramCardNew`

**Files:**
- Modify: `src/App.jsx` — insertar nuevo componente después del cierre de `ProgramCardCompact` (línea 2767, la línea que dice `}`)

- [ ] **Leer líneas 2764–2770 para confirmar el punto de inserción**

```bash
sed -n '2764,2770p' src/App.jsx
```
Esperado: se ve el cierre `}` de `ProgramCardCompact` y el comentario `// ── Drawer / sheet program detail`.

- [ ] **Insertar `ProgramCardNew` entre `ProgramCardCompact` y el comentario del drawer**

Localizar la línea exacta:
```
// ── Drawer / sheet program detail ────────────────────────────────────────
```

Insertar antes de esa línea:

```jsx
function ProgramCardNew({ program: p, isFav, isCmp, cmpDisabled, onFavToggle, onCmpToggle, onCardClick, imageOffset }) {
  const [qvOpen, setQvOpen] = React.useState(false);
  const [logoErr, setLogoErr] = React.useState(false);

  const fmtPrice = (v) => v === 0 ? 'Gratuito' : `${Number(v).toLocaleString('es-ES')} €/año`;
  const starsHtml = (v) => v != null ? '★'.repeat(Math.floor(v)) + '☆'.repeat(5 - Math.floor(v)) : '';
  const MODALIDAD_ICONS = { Presencial: '🏛', Online: '💻', Semipresencial: '🔀' };
  const domain = p.url_detalle
    ? (() => { try { return new URL(p.url_detalle).hostname.replace(/^www\./, ''); } catch { return null; } })()
    : null;
  const abbr = (p.nombre || '').split(' ').filter(w => w.length > 3).slice(0, 3).map(w => w[0]).join('').toUpperCase().slice(0, 4) || '??';

  const cardClass = ['qe-card', isFav ? 'is-favorited' : '', isCmp ? 'is-compared' : ''].filter(Boolean).join(' ');

  return (
    <div className={cardClass} onClick={onCardClick}>
      {/* HEADER */}
      <div className="qe-card-header">
        <div className="qe-card-header-img"
          style={{ backgroundImage: `url('${getAreaImage(p.familia_area, imageOffset)}')` }} />
        <div className="qe-card-header-overlay" />
        <div className="qe-card-header-content">
          <div className="qe-card-header-top">
            <span className={`qe-badge-tipo ${p.tipo || ''}`}>{TIPO_LABELS[p.tipo] || p.tipo}</span>
            {p.sello && <span className="qe-badge-seal">{p.sello}</span>}
          </div>
          <div>
            <div className="qe-card-title">{p.nombre}</div>
            <div className="qe-card-univ">
              {domain && !logoErr
                ? <img src={`https://logo.clearbit.com/${domain}`} alt="" className="qe-logo-img" onError={() => setLogoErr(true)} />
                : <span className="qe-logo-badge">{abbr}</span>
              }
              {p.ciudad && <span>{p.ciudad}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* MÉTRICAS */}
      <div className="qe-metrics">
        <div className="qe-metric">
          <span className={`qe-metric-val${p.empleabilidad != null ? ' empleo' : ' na'}`}>
            {p.empleabilidad != null ? `${p.empleabilidad}%` : 'Próx.'}
          </span>
          <span className="qe-metric-lbl">Empleo</span>
        </div>
        <div className="qe-metric">
          <span className="qe-metric-val">
            {p.modalidad ? `${MODALIDAD_ICONS[p.modalidad] || ''} ${p.modalidad}` : '—'}
          </span>
          <span className="qe-metric-lbl">Modalidad</span>
        </div>
        <div className="qe-metric">
          <span className="qe-metric-val">
            {p.idioma || (p.tipo === 'master' || p.tipo === 'doctorado' ? '—' : '—')}
          </span>
          <span className="qe-metric-lbl">Idioma</span>
        </div>
      </div>

      {/* BODY */}
      <div className="qe-card-body">
        {p.keywords?.length > 0 && (
          <div className="qe-keywords">
            {p.keywords.map((k, i) => <span key={i} className="qe-kw">{k}</span>)}
          </div>
        )}
        {p.valoracion != null && (
          <div className="qe-rating">
            <span className="qe-stars">{starsHtml(p.valoracion)}</span>
            <span className="qe-rating-text">{p.valoracion} · {p.num_resenas} reseñas</span>
          </div>
        )}
        {p.asignaturas?.length > 0 && (
          <>
            <button
              className={`qe-quickview-btn${qvOpen ? ' open' : ''}`}
              onClick={e => { e.stopPropagation(); setQvOpen(v => !v); }}>
              <i className="qe-quickview-arrow">›</i>&nbsp;Vista rápida — 1.er año
            </button>
            <div className={`qe-quickview-content${qvOpen ? ' open' : ''}`}>
              {p.asignaturas.map((a, i) => <span key={i}>{a}</span>)}
            </div>
          </>
        )}
      </div>

      {/* FOOTER */}
      <div className="qe-card-footer">
        <div>
          <div className="qe-price">{fmtPrice(p.precio_anual_eur)}</div>
          {p.saved_count != null && (
            <div className="qe-saved-count">♥ {isFav ? p.saved_count + 1 : p.saved_count} lo guardaron</div>
          )}
        </div>
        <div className="qe-actions">
          <button
            className={`qe-btn-icon btn-fav${isFav ? ' fav-active' : ''}`}
            title={isFav ? 'Quitar de favoritos' : 'Guardar'}
            aria-pressed={isFav}
            onClick={e => { e.stopPropagation(); onFavToggle(p.id); }}>
            {isFav ? '★' : '☆'}
          </button>
          <button
            className={`qe-btn-icon btn-cmp${isCmp ? ' cmp-active' : ''}${cmpDisabled ? ' cmp-disabled' : ''}`}
            title={cmpDisabled ? 'Solo se pueden comparar programas del mismo tipo' : isCmp ? 'Quitar del comparador' : 'Añadir al comparador'}
            aria-pressed={isCmp}
            disabled={cmpDisabled}
            onClick={e => { e.stopPropagation(); onCmpToggle(p.id, p.tipo); }}>
            ⊕
          </button>
          {p.url_detalle && (
            <a href={p.url_detalle} target="_blank" rel="noopener noreferrer"
              className="qe-btn-ver"
              onClick={e => e.stopPropagation()}>
              Ver →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

```

- [ ] **Verificar — `npm run build`**

```bash
npm run build 2>&1 | tail -20
```
Esperado: `✓ built in` sin errores. El componente no se usa aún, pero debe pasar el análisis de JSX.

- [ ] **Commit**

```bash
git add src/App.jsx
git commit -m "feat(explorer): add ProgramCardNew component — favoritos + comparador ready"
```

---

### Task 3: Estado de favoritos, comparador y toast en `ProgramBrowser`

**Files:**
- Modify: `src/App.jsx:2820` — `ProgramBrowser` function body, añadir estado después de los `useState` existentes

- [ ] **Leer líneas 2820–2835 para ver el bloque de useState actual**

```bash
sed -n '2820,2835p' src/App.jsx
```
Esperado: se ven los `useState` de `programs`, `loading`, `search`, `filterCity`, `filterTipo`, `filterArea`, `page`, `selected`, `drawerProgram`, `sheetOpen`, `sheetProgram`.

- [ ] **Insertar el nuevo estado después de `const PER_PAGE = 24;` (línea 2832)**

Localizar la línea exacta:
```
  const PER_PAGE = 24;
```

Después de esa línea, insertar:

```js
  // ── Favoritos (localStorage) ──
  const [favs, setFavs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('queestudiar_favoritos')) || []; }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem('queestudiar_favoritos', JSON.stringify(favs));
  }, [favs]);

  const toggleFav = (id) => setFavs(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  // ── Comparador (localStorage) ──
  const [comparar, setComparar] = useState(() => {
    try { return JSON.parse(localStorage.getItem('queestudiar_comparar')) || { ids: [], tipo: null }; }
    catch { return { ids: [], tipo: null }; }
  });
  useEffect(() => {
    localStorage.setItem('queestudiar_comparar', JSON.stringify(comparar));
  }, [comparar]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);

  const addToComparar = (id, tipo) => {
    setComparar(prev => {
      if (prev.ids.includes(id)) return prev;
      if (prev.tipo && prev.tipo !== tipo) {
        showToast('Solo puedes comparar programas del mismo tipo. Limpia el comparador para empezar de nuevo.');
        return prev;
      }
      if (prev.ids.length >= 4) {
        showToast('Máximo 4 programas para comparar');
        return prev;
      }
      return { ids: [...prev.ids, id], tipo: prev.tipo || tipo };
    });
  };

  const removeFromComparar = (id) => setComparar(prev => {
    const ids = prev.ids.filter(x => x !== id);
    return { ids, tipo: ids.length === 0 ? null : prev.tipo };
  });

  const clearComparar = () => setComparar({ ids: [], tipo: null });

  // ── Toast ──
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = (msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  };

  // ── Nav favoritos: mostrar solo guardados ──
  const [showOnlyFavs, setShowOnlyFavs] = useState(false);
```

- [ ] **Verificar — `npm run build`**

```bash
npm run build 2>&1 | tail -20
```
Esperado: `✓ built in`. Si hay error "showToast is not defined before use", reubicar `showToast` antes de `addToComparar` en el bloque insertado (ya está en el orden correcto en el código de arriba).

- [ ] **Commit**

```bash
git add src/App.jsx
git commit -m "feat(explorer): add favs + comparar + toast state to ProgramBrowser"
```

---

### Task 4: Compare bar + modal + toast JSX en `ProgramBrowser`

**Files:**
- Modify: `src/App.jsx` — añadir compare bar, modal y toast en el JSX de `ProgramBrowser`

- [ ] **Leer líneas 3008–3015 para ver el final del return de ProgramBrowser**

```bash
sed -n '3008,3015p' src/App.jsx
```
Esperado: se ve el cierre del bottom sheet (`</div>`) y el `</>` que cierra el fragment de `ProgramBrowser`, seguido de `}` que cierra la función.

- [ ] **Insertar compare bar, modal y toast antes del `</>` de cierre**

Localizar la línea exacta del cierre del bottom sheet:
```
    </>
  );
}

function SolicitudForm() {
```

Reemplazarla (solo el `</>` y el `);`) con:

```jsx
      {/* COMPARE BAR */}
      {comparar.ids.length > 0 && (
        <div className="qe-compare-bar">
          <span className="qe-cmp-label">Comparando:</span>
          <span className="qe-cmp-tipo">
            {TIPO_LABELS[comparar.tipo] ? TIPO_LABELS[comparar.tipo] + 'es' : 'Programas'} ({comparar.ids.length}/4)
          </span>
          <div className="qe-cmp-chips">
            {comparar.ids.map(id => {
              const p = programs.find(x => x.id === id);
              const name = p ? p.nombre.slice(0, 28) + (p.nombre.length > 28 ? '…' : '') : id;
              return (
                <span key={id} className="qe-cmp-chip">
                  {name}
                  <button className="qe-cmp-chip-x" onClick={() => removeFromComparar(id)} aria-label={`Quitar ${name}`}>×</button>
                </span>
              );
            })}
          </div>
          <button
            className="qe-cmp-btn-now"
            disabled={comparar.ids.length < 2}
            title={comparar.ids.length < 2 ? 'Añade al menos 2 programas' : undefined}
            onClick={() => setCompareModalOpen(true)}>
            Comparar ahora →
          </button>
          <button className="qe-cmp-btn-clear" onClick={clearComparar}>Limpiar todo</button>
        </div>
      )}

      {/* COMPARE MODAL */}
      {compareModalOpen && (() => {
        const progs = comparar.ids.map(id => programs.find(p => p.id === id)).filter(Boolean);
        const fmtP = (v) => v === 0 ? 'Gratuito' : `${Number(v).toLocaleString('es-ES')} €`;
        const stars = (v) => v != null ? '★'.repeat(Math.floor(v)) + '☆'.repeat(5 - Math.floor(v)) : '—';
        const MODALIDAD_ICONS = { Presencial: '🏛', Online: '💻', Semipresencial: '🔀' };
        const close = () => setCompareModalOpen(false);
        const rowDefs = [
          ['Ciudad',        p => p.ciudad || '—'],
          ['Modalidad',     p => p.modalidad ? `${MODALIDAD_ICONS[p.modalidad] || ''} ${p.modalidad}` : '—'],
          ['Idioma',        p => p.idioma || '—'],
          ['Precio/año',    p => `<strong>${fmtP(p.precio_anual_eur)}</strong>`],
          ['Empleabilidad', p => p.empleabilidad != null ? `<span class="qe-cmp-empleo-val">${p.empleabilidad}%</span>` : '<span style="color:#9ca3af">—</span>'],
          ['Valoración',    p => p.valoracion != null ? `<span class="qe-cmp-stars">${stars(p.valoracion)}</span> ${p.valoracion} (${p.num_resenas})` : '—'],
          ['Sello',         p => p.sello || '—'],
        ];
        return (
          <div className="qe-modal-overlay" onClick={e => { if (e.target === e.currentTarget) close(); }}>
            <div className="qe-modal-box" role="dialog" aria-modal="true" aria-label="Comparativa de programas">
              <div className="qe-modal-header">
                <span className="qe-modal-title">
                  Comparativa de {TIPO_LABELS[comparar.tipo] ? TIPO_LABELS[comparar.tipo] + 's' : 'Programas'}
                </span>
                <button className="qe-modal-close" aria-label="Cerrar" onClick={close}>×</button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="qe-cmp-table">
                  <thead>
                    <tr>
                      <th></th>
                      {progs.map(p => (
                        <th key={p.id} className="prog-col">
                          {p.nombre.slice(0, 40)}{p.nombre.length > 40 ? '…' : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowDefs.map(([label, fn]) => (
                      <tr key={label}>
                        <td className="attr">{label}</td>
                        {progs.map(p => (
                          <td key={p.id} dangerouslySetInnerHTML={{ __html: fn(p) }} />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="qe-modal-footer">
                <button className="qe-modal-btn-close" onClick={close}>Cerrar comparativa</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TOAST */}
      {toast && <div className="qe-toast">{toast}</div>}
    </>
  );
}

function SolicitudForm() {
```

- [ ] **Añadir listener de Escape para cerrar el modal**

Dentro del `useEffect` que ya maneja Escape en `ProgramBrowser` (líneas 2847–2855), localizar:
```js
      if (e.key !== "Escape") return;
      if (sheetOpen) { closeSheet(); return; }
      closeDrawer();
```
Reemplazar por:
```js
      if (e.key !== "Escape") return;
      if (compareModalOpen) { setCompareModalOpen(false); return; }
      if (sheetOpen) { closeSheet(); return; }
      closeDrawer();
```

- [ ] **Verificar — `npm run build`**

```bash
npm run build 2>&1 | tail -20
```
Esperado: `✓ built in`.

- [ ] **Commit**

```bash
git add src/App.jsx
git commit -m "feat(explorer): add compare bar + modal + toast JSX to ProgramBrowser"
```

---

### Task 5: Reemplazar `ProgramCardCompact` con `ProgramCardNew` + actualizar query

**Files:**
- Modify: `src/App.jsx:2837` — Supabase query, añadir `idioma`
- Modify: `src/App.jsx:2948` — reemplazar `<ProgramCardCompact>` con `<ProgramCardNew>`

- [ ] **Actualizar la query de Supabase para incluir `idioma`**

Localizar la línea exacta:
```js
        const data = await publicQueryAll("programas", "id,nombre,ciudad,tipo,familia_area,modalidad,precio_anual_eur,precio_extracomunitario_eur,horas_semanales,url_detalle", "activo=eq.true&order=nombre.asc");
```
Reemplazar por:
```js
        const data = await publicQueryAll("programas", "id,nombre,ciudad,tipo,familia_area,modalidad,precio_anual_eur,precio_extracomunitario_eur,horas_semanales,url_detalle,idioma", "activo=eq.true&order=nombre.asc");
```

- [ ] **Reemplazar `<ProgramCardCompact>` con `<ProgramCardNew>`**

Localizar el bloque exacto:
```jsx
            <div className="pub-compact-grid" style={{ padding:"8px var(--padding-x) 32px" }}>
              {paged.map((p, i) => (
                <ProgramCardCompact key={p.id} program={p}
                  imageOffset={page * PER_PAGE + i}
                  selected={selected.has(p.id)}
                  isDrawerOpen={drawerProgram?.id === p.id || sheetProgram?.id === p.id}
                  onClick={() => openCard(p)} />
              ))}
            </div>
```
Reemplazar por:
```jsx
            <div className="pub-compact-grid" style={{ padding:"8px var(--padding-x) 32px" }}>
              {paged.map((p, i) => (
                <ProgramCardNew key={p.id} program={p}
                  imageOffset={page * PER_PAGE + i}
                  isFav={favs.includes(p.id)}
                  isCmp={comparar.ids.includes(p.id)}
                  cmpDisabled={!!(comparar.tipo && comparar.tipo !== p.tipo && !comparar.ids.includes(p.id))}
                  onFavToggle={id => {
                    const adding = !favs.includes(id);
                    toggleFav(id);
                    if (adding) showToast('★ Guardado — ver todos en "Mis guardados"');
                  }}
                  onCmpToggle={(id, tipo) => {
                    if (comparar.ids.includes(id)) removeFromComparar(id);
                    else addToComparar(id, tipo);
                  }}
                  onCardClick={() => openCard(p)} />
              ))}
            </div>
```

- [ ] **Verificar — `npm run build`**

```bash
npm run build 2>&1 | tail -20
```
Esperado: `✓ built in` sin warnings relevantes (puede haber warnings de `dangerouslySetInnerHTML` en la tabla comparativa — son esperados para el contenido HTML de las celdas de valoración/empleabilidad).

- [ ] **Test visual — iniciar dev server**

```bash
npm run dev
```
Abrir `http://localhost:5173/#/programas` y verificar:
```
[ ] Las cards usan el nuevo diseño (imagen 100px, métricas, footer con botones)
[ ] ☆ → ★ al hacer clic en una card, borde dorado
[ ] ⊕ → barra aparece en el fondo
[ ] Dos cards en comparador → "Comparar ahora →" se habilita
[ ] "Comparar ahora →" → modal con tabla
[ ] Modal se cierra con ×, overlay click, Escape
[ ] "Ver →" abre url_detalle en nueva pestaña sin subrayado
[ ] Clic en el cuerpo de la card → abre drawer lateral (desktop) o bottom sheet (mobile)
[ ] Recarga → favoritos y comparador persisten
[ ] "Limpiar todo" → barra desaparece, comparador limpio
```

- [ ] **Commit final**

```bash
git add src/App.jsx
git commit -m "feat(explorer): replace ProgramCardCompact with ProgramCardNew — favs + comparador live"
```

---

## Notas importantes

**Campos que aún no están en la BD** — el componente los maneja silenciosamente:
- `empleabilidad`, `valoracion`, `num_resenas`, `sello`, `keywords`, `asignaturas`, `saved_count` → serán `undefined` en todos los objetos de programa reales. La card renderiza esas secciones solo si el campo tiene valor.
- Las métricas Modalidad e Idioma serán `—` para la mayoría de másteres y grados.

**`dangerouslySetInnerHTML` en la tabla comparativa** — se usa exclusivamente para insertar HTML de valoración (estrellas) y empleabilidad (span de color). El contenido viene de datos de la BD, no de input de usuario. Riesgo XSS nulo en este contexto.

**`showToast` debe definirse antes de `addToComparar`** en el orden del código de Task 3 — el bloque insertado ya respeta este orden.
