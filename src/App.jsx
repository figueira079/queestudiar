import { useState, useEffect, useCallback } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

const TEAM_CREDENTIALS = [
  { user: "maria", password: "edunova2024", name: "María" },
  { user: "admin", password: "edunova2024", name: "Administrador" },
];

const STATUS_CONFIG = {
  nuevo:       { label: "Nuevo",        color: "#4FC3F7", bg: "#0d2a38" },
  contactado:  { label: "Contactado",   color: "#FFB74D", bg: "#2d1f0a" },
  en_proceso:  { label: "En proceso",   color: "#CE93D8", bg: "#1e0d2a" },
  cerrado:     { label: "Cerrado ✓",    color: "#81C784", bg: "#0d2213" },
  descartado:  { label: "Descartado",   color: "#EF9A9A", bg: "#2a0d0d" },
};

// ─── SUPABASE CLIENT ────────────────────────────────────────────────────────
async function query(table, select = "*", filters = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  Object.entries(filters).forEach(([k, v]) => {
    url += `&${k}=eq.${encodeURIComponent(v)}`;
  });
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  return res.json();
}

async function patch(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return res.ok;
}

// ─── STYLES ─────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #070b12; --surface: #0e1520; --border: #1c2840;
    --accent: #3B82F6; --accent2: #06b6d4; --text: #e2e8f0;
    --muted: #64748b; --font: 'Syne', sans-serif; --mono: 'DM Mono', monospace;
  }
  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font); }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
  .app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
  .login-wrap { display: flex; align-items: center; justify-content: center; height: 100vh; background: radial-gradient(ellipse at 30% 20%, #0f2040 0%, var(--bg) 60%); }
  .login-card { width: 380px; padding: 48px 40px; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; box-shadow: 0 0 80px #3B82F618; }
  .login-logo { font-size: 11px; letter-spacing: 0.25em; color: var(--accent2); font-family: var(--mono); margin-bottom: 32px; text-transform: uppercase; }
  .login-title { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
  .login-sub { font-size: 13px; color: var(--muted); margin-bottom: 36px; }
  .field { margin-bottom: 18px; }
  .field label { display: block; font-size: 11px; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; font-family: var(--mono); }
  .field input { width: 100%; padding: 12px 16px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: var(--font); font-size: 14px; outline: none; transition: border-color 0.2s; }
  .field input:focus { border-color: var(--accent); }
  .btn-primary { width: 100%; padding: 13px; background: var(--accent); border: none; border-radius: 8px; color: #fff; font-family: var(--font); font-weight: 700; font-size: 14px; cursor: pointer; transition: opacity 0.2s, transform 0.1s; letter-spacing: 0.05em; }
  .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
  .login-err { color: #EF9A9A; font-size: 12px; margin-top: 12px; text-align: center; font-family: var(--mono); }
  .header { display: flex; align-items: center; justify-content: space-between; padding: 0 28px; height: 56px; border-bottom: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
  .header-left { display: flex; align-items: center; gap: 20px; }
  .logo-mark { font-family: var(--mono); font-size: 11px; color: var(--accent2); letter-spacing: 0.2em; text-transform: uppercase; }
  .header-title { font-size: 14px; font-weight: 700; }
  .header-right { display: flex; align-items: center; gap: 16px; }
  .user-badge { font-family: var(--mono); font-size: 11px; color: var(--muted); background: var(--bg); border: 1px solid var(--border); padding: 4px 12px; border-radius: 20px; }
  .btn-ghost { background: none; border: 1px solid var(--border); color: var(--muted); padding: 6px 14px; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: var(--mono); transition: all 0.2s; }
  .btn-ghost:hover { border-color: var(--accent); color: var(--text); }
  .main { display: flex; flex: 1; overflow: hidden; }
  .sidebar { width: 320px; flex-shrink: 0; border-right: 1px solid var(--border); display: flex; flex-direction: column; background: var(--surface); overflow: hidden; }
  .detail { flex: 1; overflow-y: auto; padding: 28px; }
  .sidebar-header { padding: 20px 20px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .sidebar-title { font-size: 11px; font-family: var(--mono); color: var(--muted); letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 12px; }
  .search-input { width: 100%; padding: 9px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: var(--mono); font-size: 12px; outline: none; transition: border-color 0.2s; }
  .search-input:focus { border-color: var(--accent); }
  .filter-row { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
  .filter-chip { font-size: 10px; padding: 3px 10px; border-radius: 20px; border: 1px solid var(--border); background: var(--bg); color: var(--muted); cursor: pointer; font-family: var(--mono); transition: all 0.15s; }
  .filter-chip.active { border-color: var(--accent); color: var(--accent); background: #3B82F612; }
  .student-list { flex: 1; overflow-y: auto; }
  .student-item { padding: 14px 20px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s; position: relative; }
  .student-item:hover { background: #ffffff05; }
  .student-item.active { background: #3B82F610; border-left: 2px solid var(--accent); }
  .student-name { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
  .student-meta { font-size: 11px; color: var(--muted); font-family: var(--mono); }
  .student-status { position: absolute; top: 14px; right: 14px; font-size: 10px; padding: 2px 8px; border-radius: 20px; font-family: var(--mono); }
  .match-count { display: inline-block; margin-top: 6px; font-size: 10px; color: var(--accent2); font-family: var(--mono); }
  .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--muted); text-align: center; gap: 12px; }
  .empty-icon { font-size: 40px; opacity: 0.3; }
  .empty-text { font-size: 13px; }
  .detail-header { margin-bottom: 28px; }
  .detail-name { font-size: 26px; font-weight: 800; margin-bottom: 6px; }
  .detail-meta-row { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; margin-bottom: 16px; }
  .detail-meta-item { font-size: 12px; color: var(--muted); font-family: var(--mono); }
  .detail-meta-item span { color: var(--text); }
  .status-select { padding: 6px 14px; border-radius: 20px; font-family: var(--mono); font-size: 12px; border: 1px solid var(--border); background: var(--bg); color: var(--text); cursor: pointer; outline: none; }
  .section { margin-bottom: 32px; }
  .section-title { font-size: 10px; font-family: var(--mono); letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
  .notes-area { width: 100%; min-height: 90px; padding: 12px 16px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: var(--mono); font-size: 12px; resize: vertical; outline: none; line-height: 1.6; transition: border-color 0.2s; }
  .notes-area:focus { border-color: var(--accent); }
  .save-btn { margin-top: 8px; padding: 7px 18px; background: var(--accent); border: none; border-radius: 6px; color: #fff; font-family: var(--font); font-size: 12px; font-weight: 700; cursor: pointer; transition: opacity 0.2s; }
  .save-btn:hover { opacity: 0.85; }
  .save-btn:disabled { opacity: 0.4; cursor: default; }
  .program-grid { display: flex; flex-direction: column; gap: 14px; }
  .program-card { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; transition: border-color 0.2s; }
  .program-card:hover { border-color: #2c3e5a; }
  .program-name { font-size: 14px; font-weight: 700; margin-bottom: 6px; line-height: 1.4; }
  .program-inst { font-size: 12px; color: var(--accent2); margin-bottom: 10px; font-family: var(--mono); }
  .program-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
  .tag { font-size: 10px; padding: 3px 9px; border-radius: 4px; border: 1px solid var(--border); color: var(--muted); font-family: var(--mono); }
  .tag.highlight { border-color: #2c3e5a; color: var(--accent2); }
  .program-footer { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .url-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; padding: 5px 12px; border-radius: 6px; border: 1px solid var(--accent); color: var(--accent); text-decoration: none; font-family: var(--mono); transition: all 0.15s; }
  .url-btn:hover { background: var(--accent); color: #fff; }
  .req-panel { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
  .req-block { margin-bottom: 18px; }
  .req-block:last-child { margin-bottom: 0; }
  .req-label { font-size: 10px; font-family: var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px; }
  .req-value { font-size: 13px; line-height: 1.6; color: var(--text); }
  .req-pill { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 4px; margin: 2px 3px 2px 0; background: #1c2840; color: var(--accent2); font-family: var(--mono); }
  .dates-list { display: flex; flex-direction: column; gap: 8px; }
  .date-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #0a1020; border-radius: 6px; border: 1px solid var(--border); }
  .date-hito { font-size: 12px; color: var(--text); }
  .date-mes { font-size: 11px; color: var(--accent); font-family: var(--mono); }
  .tabs { display: flex; gap: 0; margin-bottom: 24px; border-bottom: 1px solid var(--border); }
  .tab { padding: 10px 20px; font-size: 12px; font-family: var(--mono); color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; margin-bottom: -1px; }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab:hover:not(.active) { color: var(--text); }
  .loading { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--muted); font-family: var(--mono); font-size: 12px; gap: 10px; }
  .spinner { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function getOriginLabel(origin) {
  const map = { eu: "UE / EEE", latam_convenio: "LATAM Convenio", extracomunitario: "Extracomunitario" };
  return map[origin] || origin;
}

function Login({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  function handle(e) {
    e.preventDefault();
    const found = TEAM_CREDENTIALS.find(c => c.user === user && c.password === pass);
    if (found) onLogin(found);
    else setErr("Credenciales incorrectas");
  }
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">▸ QueEstudiar · Admisiones</div>
        <div className="login-title">Panel de gestión</div>
        <div className="login-sub">Acceso restringido al equipo de admisiones</div>
        <form onSubmit={handle}>
          <div className="field"><label>Usuario</label><input value={user} onChange={e => { setUser(e.target.value); setErr(""); }} autoComplete="username" /></div>
          <div className="field"><label>Contraseña</label><input type="password" value={pass} onChange={e => { setPass(e.target.value); setErr(""); }} autoComplete="current-password" /></div>
          <button className="btn-primary" type="submit">Entrar →</button>
          {err && <div className="login-err">{err}</div>}
        </form>
      </div>
    </div>
  );
}

function RequirementsPanel({ req }) {
  if (!req) return <div style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--mono)" }}>Sin requisitos cargados para este perfil.</div>;
  const hom = req.homologacion || {};
  const lang = req.language_req || {};
  const tests = req.access_tests || {};
  const dates = req.key_dates || [];
  const scholarships = req.scholarships || [];
  return (
    <div className="req-panel">
      <div className="req-block">
        <div className="req-label">📋 Homologación del título</div>
        <div className="req-value">{hom.proceso || "—"}</div>
        {hom.tasa_eur && <div style={{ marginTop: 8 }}><span className="req-pill">Tasa: {hom.tasa_eur}€</span>{hom.modelo_tasa && <span className="req-pill">Modelo {hom.modelo_tasa}</span>}{hom.plazo_resolucion_meses && <span className="req-pill">Plazo: {hom.plazo_resolucion_meses} meses</span>}</div>}
        {hom.volante_condicional && <div style={{ marginTop: 8, fontSize: 12, color: "#FFB74D", fontFamily: "var(--mono)" }}>⚠ Volante Condicional disponible</div>}
      </div>
      <div className="req-block">
        <div className="req-label">🗣 Requisito lingüístico</div>
        <div className="req-value">Nivel mínimo: <strong>{lang.nivel_minimo || "—"}</strong> ({lang.marco || ""})</div>
        {lang.certificados_aceptados?.length > 0 && <div style={{ marginTop: 6 }}>{lang.certificados_aceptados.map(c => <span key={c} className="req-pill">{c}</span>)}</div>}
      </div>
      {tests.nombre && (
        <div className="req-block">
          <div className="req-label">📝 {tests.nombre}</div>
          {tests.organismo && <div style={{ fontSize: 11, color: "var(--accent2)", fontFamily: "var(--mono)", marginBottom: 6 }}>{tests.organismo}</div>}
          <div className="req-value">{tests.descripcion || ""}</div>
          {tests.formula_nota_base && <div style={{ marginTop: 10, padding: "8px 12px", background: "#0a1020", borderRadius: 6, fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent2)" }}>{tests.formula_nota_base}</div>}
          {tests.convocatorias?.map((c, i) => <div key={i} style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>📅 <strong style={{ color: "var(--text)" }}>{c.tipo}:</strong> {c.fechas_espana}{c.fechas_sedes_internacionales && ` · Internacional: ${c.fechas_sedes_internacionales}`}</div>)}
        </div>
      )}
      {scholarships.length > 0 && (
        <div className="req-block">
          <div className="req-label">🎓 Becas disponibles</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {scholarships.map((b, i) => (
              <div key={i} style={{ padding: "8px 12px", background: "#0a1020", borderRadius: 6, borderLeft: "2px solid var(--accent)" }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{b.nombre}</div>
                {b.organismo && <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{b.organismo}</div>}
                {(b.cuantia || b.cuantia_eur) && <div style={{ fontSize: 11, color: "var(--accent2)", marginTop: 2 }}>{b.cuantia || `${b.cuantia_eur}€`}</div>}
                {b.url && <a href={b.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--mono)" }}>→ {b.url}</a>}
              </div>
            ))}
          </div>
        </div>
      )}
      {dates.length > 0 && (
        <div className="req-block">
          <div className="req-label">📆 Calendario clave</div>
          <div className="dates-list">{dates.map((d, i) => <div key={i} className="date-item"><span className="date-hito">{d.hito}</span><span className="date-mes">{d.mes || d.fecha}</span></div>)}</div>
        </div>
      )}
      {req.notes && <div className="req-block"><div className="req-label">📌 Notas</div><div className="req-value" style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>{req.notes}</div></div>}
    </div>
  );
}

function RegionPanel({ regionData }) {
  if (!regionData || regionData.length === 0) return <div style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--mono)" }}>Sin datos de costes para las regiones seleccionadas.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {regionData.map((r, i) => (
        <div key={i} className="req-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div><div style={{ fontWeight: 700, fontSize: 14 }}>{r.region}</div><div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{r.program_type === "fp_superior" ? "FP Grado Superior" : "Grado Universitario"}</div></div>
            <div style={{ textAlign: "right" }}><div style={{ fontSize: 20, fontWeight: 800, color: r.public_cost_eur === 0 ? "#81C784" : "var(--accent)" }}>{r.public_cost_eur === 0 ? "Gratuito" : `${r.public_cost_eur}€`}</div><div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)" }}>público / año</div></div>
          </div>
          {r.private_cost_range && <div style={{ marginBottom: 8 }}><span className="req-pill">Privado: {r.private_cost_range}€/año</span>{r.non_eu_surcharge && <span className="req-pill" style={{ color: "#FFB74D" }}>⚠ Recargo no-UE</span>}</div>}
          {r.key_dates?.length > 0 && <div className="dates-list" style={{ marginBottom: 8 }}>{r.key_dates.map((d, j) => <div key={j} className="date-item"><span className="date-hito">{d.hito}</span><span className="date-mes">{d.fecha || d.mes}</span></div>)}</div>}
          {r.platform_url && <a href={r.platform_url} target="_blank" rel="noreferrer" className="url-btn" style={{ marginTop: 4 }}>↗ Portal de admisión</a>}
          {r.notes && <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted)", lineHeight: 1.6, fontFamily: "var(--mono)" }}>{r.notes}</div>}
        </div>
      ))}
    </div>
  );
}

function StudentDetail({ student, onStatusChange, onNotesSave }) {
  const [tab, setTab] = useState("matches");
  const [notes, setNotes] = useState(student.notes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [matches, setMatches] = useState([]);
  const [requirements, setRequirements] = useState(null);
  const [regionData, setRegionData] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(true);

  useEffect(() => { setNotes(student.notes || ""); setTab("matches"); }, [student.id]);
  useEffect(() => { loadMatches(); loadRequirements(); }, [student.id]);

  async function loadMatches() {
    setLoadingMatches(true);
    try {
      const data = await query("matches", "*, programs(nombre, institution_name, city, tipo_programa, nivel, area_conocimiento, url_solicitud, web_url)", { student_id: student.id });
      setMatches(Array.isArray(data) ? data : []);
    } catch { setMatches([]); }
    setLoadingMatches(false);
  }

  async function loadRequirements() {
    try {
      const ptype = student.education_level === "bachillerato" ? "university_bachelor" : "fp_superior";
      const origin = student.student_origin || "extracomunitario";
      const reqs = await query("admission_requirements", "*", { program_type: ptype, student_origin: origin });
      if (Array.isArray(reqs) && reqs.length > 0) setRequirements(reqs[0]);
      const allRegions = await query("admission_by_region", "*", { program_type: ptype });
      if (Array.isArray(allRegions)) setRegionData(allRegions.slice(0, 4));
    } catch {}
  }

  async function saveNotes() {
    setSaving(true);
    await patch("student_leads", student.id, { notes });
    setSaving(false); setSaved(true);
    onNotesSave(student.id, notes);
    setTimeout(() => setSaved(false), 2000);
  }

  const sc = STATUS_CONFIG[student.status] || STATUS_CONFIG.nuevo;
  return (
    <div className="detail">
      <div className="detail-header">
        <div className="detail-name">{student.full_name || "Estudiante sin nombre"}</div>
        <div className="detail-meta-row">
          <div className="detail-meta-item">Email: <span>{student.email || "—"}</span></div>
          <div className="detail-meta-item">País: <span>{student.country_of_origin || "—"}</span></div>
          <div className="detail-meta-item">Origen: <span>{getOriginLabel(student.student_origin)}</span></div>
          <div className="detail-meta-item">Recibido: <span>{formatDate(student.created_at)}</span></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <select className="status-select" value={student.status || "nuevo"} onChange={e => onStatusChange(student.id, e.target.value)} style={{ color: sc.color, borderColor: sc.color, background: sc.bg }}>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {student.preferred_cities && <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>Ciudades: <span style={{ color: "var(--text)" }}>{Array.isArray(student.preferred_cities) ? student.preferred_cities.join(", ") : student.preferred_cities}</span></div>}
          {student.study_area && <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>Área: <span style={{ color: "var(--text)" }}>{student.study_area}</span></div>}
        </div>
      </div>
      <div className="tabs">
        {[["matches", `Matches (${matches.length})`], ["requisitos", "Requisitos admisión"], ["region", "Costes y plazos"], ["notas", "Notas expediente"]].map(([k, l]) => (
          <div key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{l}</div>
        ))}
      </div>
      {tab === "matches" && (
        <div className="section">
          {loadingMatches ? <div className="loading"><div className="spinner" /> Cargando programas...</div>
          : matches.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13, fontFamily: "var(--mono)", padding: "20px 0" }}>Sin matches aún. N8N los guardará cuando el estudiante complete el formulario.</div>
          : <div className="program-grid">{matches.map((m, i) => { const p = m.programs || {}; return (
            <div key={i} className="program-card">
              <div className="program-name">{p.nombre || "Programa sin nombre"}</div>
              <div className="program-inst">{p.institution_name || "—"} · {p.city || "—"}</div>
              <div className="program-tags">{p.nivel && <span className="tag highlight">{p.nivel}</span>}{p.tipo_programa && <span className="tag">{p.tipo_programa}</span>}{p.area_conocimiento && <span className="tag">{p.area_conocimiento}</span>}</div>
              <div className="program-footer">
                {p.url_solicitud && <a href={p.url_solicitud} target="_blank" rel="noreferrer" className="url-btn">↗ URL Solicitud</a>}
                {p.web_url && <a href={p.web_url} target="_blank" rel="noreferrer" className="url-btn" style={{ borderColor: "var(--accent2)", color: "var(--accent2)" }}>↗ Web universidad</a>}
              </div>
            </div>
          );})}</div>}
        </div>
      )}
      {tab === "requisitos" && <div className="section"><div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)", marginBottom: 16 }}>Perfil: <span style={{ color: "var(--accent2)" }}>{getOriginLabel(student.student_origin || "extracomunitario")}</span>{" · "}<span style={{ color: "var(--accent2)" }}>{student.education_level === "bachillerato" ? "Grado universitario" : "FP Grado Superior"}</span></div><RequirementsPanel req={requirements} /></div>}
      {tab === "region" && <div className="section"><RegionPanel regionData={regionData} /></div>}
      {tab === "notas" && <div className="section"><div className="section-title">Notas del expediente</div><textarea className="notes-area" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Documentos recibidos, comunicaciones, estado de homologación..." /><button className="save-btn" onClick={saveNotes} disabled={saving}>{saving ? "Guardando..." : saved ? "✓ Guardado" : "Guardar notas"}</button></div>}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => { const saved = sessionStorage.getItem("queestudiar_user"); if (saved) setUser(JSON.parse(saved)); }, []);
  useEffect(() => { if (user) loadStudents(); }, [user]);

  async function loadStudents() {
    setLoading(true);
    try {
      const data = await query("student_leads", "*");
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setStudents(list);
      if (list.length > 0 && !selected) setSelected(list[0]);
    } catch { setStudents([]); }
    setLoading(false);
  }

  function handleLogin(u) { sessionStorage.setItem("queestudiar_user", JSON.stringify(u)); setUser(u); }
  function handleLogout() { sessionStorage.removeItem("queestudiar_user"); setUser(null); setStudents([]); setSelected(null); }
  async function handleStatusChange(id, status) {
    await patch("student_leads", id, { status });
    setStudents(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    if (selected?.id === id) setSelected(prev => ({ ...prev, status }));
  }
  function handleNotesSave(id, notes) { setStudents(prev => prev.map(s => s.id === id ? { ...s, notes } : s)); }

  if (!user) return <><style>{css}</style><Login onLogin={handleLogin} /></>;

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.country_of_origin?.toLowerCase().includes(q);
    const matchStatus = filterStatus === "all" || s.status === filterStatus || (!s.status && filterStatus === "nuevo");
    return matchSearch && matchStatus;
  });

  const counts = Object.fromEntries(Object.keys(STATUS_CONFIG).map(k => [k, students.filter(s => (s.status || "nuevo") === k).length]));

  return (
    <><style>{css}</style>
    <div className="app">
      <div className="header">
        <div className="header-left"><div className="logo-mark">▸ QueEstudiar</div><div className="header-title">Panel de Admisiones</div></div>
        <div className="header-right"><div className="user-badge">{user.name}</div><button className="btn-ghost" onClick={loadStudents}>↻ Actualizar</button><button className="btn-ghost" onClick={handleLogout}>Salir</button></div>
      </div>
      <div className="main">
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title">Estudiantes · {filtered.length}</div>
            <input className="search-input" placeholder="Buscar por nombre, email, país..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="filter-row">
              <div className={`filter-chip ${filterStatus === "all" ? "active" : ""}`} onClick={() => setFilterStatus("all")}>Todos ({students.length})</div>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => counts[k] > 0 && <div key={k} className={`filter-chip ${filterStatus === k ? "active" : ""}`} onClick={() => setFilterStatus(k)}>{v.label} ({counts[k]})</div>)}
            </div>
          </div>
          <div className="student-list">
            {loading ? <div className="loading" style={{ height: 200 }}><div className="spinner" /> Cargando...</div>
            : filtered.length === 0 ? <div className="empty" style={{ height: 200 }}><div className="empty-icon">◌</div><div className="empty-text">Sin estudiantes{search ? " con ese filtro" : " aún"}</div></div>
            : filtered.map(s => { const sc = STATUS_CONFIG[s.status || "nuevo"]; return (
              <div key={s.id} className={`student-item ${selected?.id === s.id ? "active" : ""}`} onClick={() => setSelected(s)}>
                <div className="student-name">{s.full_name || "Sin nombre"}</div>
                <div className="student-meta">{s.email || "—"} · {s.country_of_origin || "—"}</div>
                <div className="match-count">{s.education_level ? `${s.education_level} · ` : ""}{formatDate(s.created_at)}</div>
                <div className="student-status" style={{ color: sc.color, background: sc.bg }}>{sc.label}</div>
              </div>
            );})}
          </div>
        </div>
        {selected ? <StudentDetail key={selected.id} student={selected} onStatusChange={handleStatusChange} onNotesSave={handleNotesSave} />
        : <div className="detail"><div className="empty"><div className="empty-icon">◎</div><div className="empty-text">Selecciona un estudiante para ver su expediente</div></div></div>}
      </div>
    </div></>
  );
}
