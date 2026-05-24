import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_KEY;

// ─── AUTH HELPERS ───────────────────────────────────────────────────────────
async function authSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || data.message || data.msg || data.error || "Email o contraseña incorrectos");
  return data;
}

async function authRefreshToken(refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(data.error_description || data.message || data.error);
  return data;
}

async function authSignOut(accessToken) {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
}

// Gestión de sesión
function saveSession(session) {
  localStorage.setItem("queestudiar_session", JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at || (Date.now() / 1000 + session.expires_in),
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.name || session.user.email.split("@")[0],
      role: session.user.user_metadata?.role || "team",
    },
  }));
}

function loadSession() {
  try {
    const raw = localStorage.getItem("queestudiar_session");
    if (!raw) return null;
    const session = JSON.parse(raw);
    // Si expira en menos de 5 min, intentar refresh
    if (session.expires_at < Date.now() / 1000 + 300) {
      return { ...session, needsRefresh: true };
    }
    return session;
  } catch { return null; }
}

function clearSession() {
  localStorage.removeItem("queestudiar_session");
}

// Token activo para las llamadas API (se actualiza al hacer login/refresh)
let _accessToken = null;
function setAccessToken(token) { _accessToken = token; }
function getAuthHeaders() {
  const token = _accessToken || SUPABASE_ANON_KEY;
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
}

async function openPdf(fileUrl) {
  if (!fileUrl) return;
  try {
    const storagePath = fileUrl.split("/storage/v1/object/authenticated/")[1];
    if (!storagePath) throw new Error("Ruta no válida");
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${storagePath}`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    if (!res.ok) throw new Error(`sign failed: ${res.status}`);
    const { signedURL } = await res.json();
    if (!signedURL) throw new Error("respuesta sin signedURL");
    window.open(`${SUPABASE_URL}${signedURL}`, "_blank");
  } catch (e) {
    alert("No se pudo abrir el PDF. Intenta de nuevo o contacta con tu asesor.");
    window.open(fileUrl, "_blank");
  }
}

const STATUS_CONFIG = {
  nuevo:       { label: "Nuevo",        color: "#2563eb", bg: "#dbeafe" },
  contactado:  { label: "Contactado",   color: "#ca8a04", bg: "#fef9c3" },
  en_proceso:  { label: "En proceso",   color: "#7c3aed", bg: "#ede9fe" },
  cerrado:     { label: "Cerrado ✓",    color: "#16a34a", bg: "#dcfce7" },
  descartado:  { label: "Descartado",   color: "#dc2626", bg: "#fee2e2" },
};

const DOCUMENT_TYPES = [
  "Pasaporte",
  "Título académico",
  "Expediente académico / notas",
  "Carta de motivación",
  "Carta de recomendación",
  "CV / Currículum",
  "Certificado de idioma",
  "Solvencia económica",
  "Formulario de solicitud universidad",
  "Otros",
];

const DOC_STATUS_CONFIG = {
  pendiente:           { label: "Pendiente",          color: "#64748b", emoji: "⏳" },
  recibido:            { label: "Recibido",            color: "#ca8a04", emoji: "📥" },
  en_revision:         { label: "En revisión",         color: "#7c3aed", emoji: "🔍" },
  aprobado:            { label: "Aprobado ✓",          color: "#16a34a", emoji: "✅" },
  necesita_correccion: { label: "Necesita corrección", color: "#dc2626", emoji: "✏️" },
};

// ─── SUPABASE CLIENT ────────────────────────────────────────────────────────
async function query(table, select = "*", filters = {}) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  Object.entries(filters).forEach(([k, v]) => {
    url += `&${k}=eq.${encodeURIComponent(v)}`;
  });
  const res = await fetch(url, { headers: getAuthHeaders() });
  return res.json();
}

async function patch(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.ok;
}

// ——— URL MANAGEMENT & LEARNING ———————————————————————————————
async function updateProgramUrl(programId, field, newUrl) {
  const statusField = field + "_status";
  const updates = { [field]: newUrl, [statusField]: "manual_ok" };
  await patch("programas", programId, updates);
  return updates;
}

async function findProgramsWithSameUrl(field, url, excludeId) {
  if (!url) return [];
  const encoded = encodeURIComponent(url);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/programas?select=id,nombre,ciudad&${field}=eq.${encoded}&id=neq.${excludeId}&limit=500`,
    { headers: getAuthHeaders() }
  );
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function bulkUpdateProgramUrls(ids, field, newUrl) {
  const statusField = field + "_status";
  const batchSize = 50;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const idFilter = batch.join(",");
    await fetch(`${SUPABASE_URL}/rest/v1/programas?id=in.(${idFilter})`, {
      method: "PATCH",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ [field]: newUrl, [statusField]: "manual_ok" }),
    });
  }
}

// ——— FEEDBACK HELPER ——————————————————————————————————————
async function insertFeedback(data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(data),
  });
  return res.ok;
}

// ——— ADMIN: USER MANAGEMENT ———————————————————————————————
function getAdminHeaders() {
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
}

async function adminListUsers() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=50`, {
    headers: getAdminHeaders()
  });
  const data = await res.json();
  return data.users || [];
}

async function adminCreateUser(email, password, name, role) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { name, role } })
  });
  const data = await res.json();
  if (data.error || data.msg || !data.id) throw new Error(data.msg || data.error_description || data.error || "Error al crear usuario");
  return data;
}

async function adminInviteStudent(email, studentId) {
  // Calls Edge Function server-side so service_role key never touches the browser
  const res = await fetch(`${SUPABASE_URL}/functions/v1/invite-student`, {
    method: "POST",
    headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ email, student_id: studentId }),
  });
  const data = await res.json();
  if (data.error || !data.id) throw new Error(data.error || "Error al invitar");
  return data;
}

async function adminDeleteUser(userId) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: getAdminHeaders()
  });
  if (!res.ok) throw new Error("Error al eliminar usuario");
  return true;
}


async function notifyStudent(payload) {
  // Fire-and-forget — los errores no bloquean la operación principal
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/notify-student`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch { /* silencioso */ }
}

// ─── STYLES ─────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700&family=Work+Sans:wght@400;600;700&family=DM+Mono:wght@300;400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #faf6f0; --surface: #ffffff; --border: #e2e8f0;
    --accent: #2563eb; --accent2: #2563eb; --text: #0f172a;
    --muted: #64748b; --font: 'Bricolage Grotesque', 'Work Sans', sans-serif; --mono: 'DM Mono', monospace;
    --terra: #e8531a; --sage: #16a34a;
    --terra-light: #fde8df; --azure-light: #dbeafe; --sage-light: #dcfce7;
  }
  html, body, #root { height: 100%; background: var(--bg); color: var(--text); font-family: var(--font); }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
  .app { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
  .login-wrap { display: flex; align-items: center; justify-content: center; height: 100vh; background: radial-gradient(ellipse at 30% 20%, #dbeafe 0%, #faf6f0 70%); }
  .login-card { width: 380px; padding: 48px 40px; background: var(--surface); border: 1px solid var(--border); border-radius: 16px; box-shadow: 0 4px 32px #2563eb14; }
  .login-logo { font-size: 11px; letter-spacing: 0.25em; color: var(--accent2); font-family: var(--mono); margin-bottom: 32px; text-transform: uppercase; }
  .login-title { font-size: 28px; font-weight: 800; margin-bottom: 8px; }
  .login-sub { font-size: 13px; color: var(--muted); margin-bottom: 36px; }
  .field { margin-bottom: 18px; }
  .field label { display: block; font-size: 11px; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; font-family: var(--mono); }
  .field input { width: 100%; padding: 12px 16px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: var(--font); font-size: 14px; outline: none; transition: border-color 0.2s; }
  .field input:focus { border-color: var(--accent); }
  .btn-primary { width: 100%; padding: 13px; background: var(--accent); border: none; border-radius: 8px; color: #fff; font-family: var(--font); font-weight: 700; font-size: 14px; cursor: pointer; transition: opacity 0.2s, transform 0.1s; letter-spacing: 0.05em; }
  .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
  .login-err { color: #dc2626; font-size: 12px; margin-top: 12px; text-align: center; font-family: var(--mono); }
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
  .filter-chip.active { border-color: var(--accent); color: var(--accent); background: var(--azure-light); }
  .student-list { flex: 1; overflow-y: auto; }
  .student-item { padding: 14px 20px; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s; position: relative; }
  .student-item:hover { background: #f8fafc; }
  .student-item.active { background: var(--azure-light); border-left: 2px solid var(--accent); }
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
  .program-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; transition: border-color 0.2s; }
  .program-card:hover { border-color: var(--accent); }
  .program-name { font-size: 14px; font-weight: 700; margin-bottom: 6px; line-height: 1.4; }
  .program-inst { font-size: 12px; color: var(--accent2); margin-bottom: 10px; font-family: var(--mono); }
  .program-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
  .tag { font-size: 10px; padding: 3px 9px; border-radius: 4px; border: 1px solid var(--border); color: var(--muted); font-family: var(--mono); }
  .tag.highlight { border-color: var(--azure-light); color: var(--accent); }
  .program-footer { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .url-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; padding: 5px 12px; border-radius: 6px; border: 1px solid var(--accent); color: var(--accent); text-decoration: none; font-family: var(--mono); transition: all 0.15s; }
  .url-btn:hover { background: var(--accent); color: #fff; }
  .url-ok { border-color: #22c55e !important; color: #22c55e !important; }
  .url-ok:hover { background: #22c55e !important; color: #fff !important; }
  .url-generica { border-color: #f97316 !important; color: #f97316 !important; }
  .url-generica:hover { background: #f97316 !important; color: #fff !important; }
  .url-rota { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; padding: 5px 12px; border-radius: 6px; border: 1px solid #ef444488; color: #ef9a9a; font-family: var(--mono); cursor: default; opacity: 0.8; }
  .url-manual-ok { border-color: #22c55e !important; color: #22c55e !important; position: relative; }
  .url-manual-ok:hover { background: #22c55e !important; color: #fff !important; }
  .url-edit-row { display: flex; gap: 4px; align-items: center; flex: 1; min-width: 0; }
  .url-edit-input { flex: 1; padding: 5px 8px; font-size: 11px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-family: var(--mono); outline: none; min-width: 120px; }
  .url-edit-input:focus { border-color: var(--accent); }
  .url-edit-btn { padding: 4px 8px; font-size: 11px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg); color: var(--muted); cursor: pointer; font-family: var(--mono); transition: all 0.15s; }
  .url-edit-btn:hover { border-color: var(--accent); color: var(--text); }
  .url-edit-btn.save { border-color: #22c55e; color: #22c55e; }
  .url-edit-btn.save:hover { background: #22c55e; color: #fff; }
  .url-pencil { padding: 2px 5px; font-size: 10px; background: none; border: 1px solid transparent; color: var(--muted); cursor: pointer; border-radius: 4px; opacity: 0.4; transition: all 0.15s; line-height: 1; }
  .url-pencil:hover { opacity: 1; border-color: var(--border); color: var(--accent); }
  .learning-banner { margin-bottom: 16px; padding: 12px 16px; background: var(--terra-light); border: 1px solid #e8531a44; border-radius: 10px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; font-family: var(--mono); color: var(--text); }
  .learning-count { color: #f97316; font-weight: 700; }
  .learning-btn { padding: 5px 12px; font-size: 11px; border-radius: 6px; border: none; cursor: pointer; font-family: var(--mono); font-weight: 600; transition: all 0.15s; }
  .learning-btn.apply { background: #f97316; color: #fff; }
  .learning-btn.apply:hover { background: #ea580c; }
  .learning-btn.apply:disabled { opacity: 0.5; cursor: default; }
  .learning-btn.dismiss { background: var(--bg); border: 1px solid var(--border); color: var(--muted); }
  .learning-btn.dismiss:hover { color: var(--text); border-color: var(--accent); }
  .req-panel { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
  .req-block { margin-bottom: 18px; }
  .req-block:last-child { margin-bottom: 0; }
  .req-label { font-size: 10px; font-family: var(--mono); color: var(--muted); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px; }
  .req-value { font-size: 13px; line-height: 1.6; color: var(--text); }
  .req-pill { display: inline-block; font-size: 10px; padding: 2px 8px; border-radius: 4px; margin: 2px 3px 2px 0; background: var(--azure-light); color: var(--accent); font-family: var(--mono); }
  .dates-list { display: flex; flex-direction: column; gap: 8px; }
  .date-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f0f4ff; border-radius: 6px; border: 1px solid var(--border); }
  .date-hito { font-size: 12px; color: var(--text); }
  .date-mes { font-size: 11px; color: var(--accent); font-family: var(--mono); }
  .tabs { display: flex; gap: 0; margin-bottom: 24px; border-bottom: 1px solid var(--border); }
  .tab { padding: 10px 20px; font-size: 12px; font-family: var(--mono); color: var(--muted); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; margin-bottom: -1px; }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab:hover:not(.active) { color: var(--text); }
  .loading { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--muted); font-family: var(--mono); font-size: 12px; gap: 10px; }
  .spinner { width: 16px; height: 16px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .user-mgmt-grid { display: flex; flex-direction: column; gap: 8px; }
  .user-card { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; transition: border-color 0.2s; }
  .user-card:hover { border-color: var(--accent); }
  .user-name { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
  .user-email { font-size: 11px; color: var(--muted); font-family: var(--mono); }
  .user-role { font-size: 10px; padding: 3px 10px; border-radius: 20px; border: 1px solid var(--border); font-family: var(--mono); }
  .user-role.admin { color: #7c3aed; border-color: #7c3aed44; }
  .user-role.team { color: var(--accent); border-color: var(--accent)44; }
  .user-form { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 24px; }
  .user-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .user-form select { width: 100%; padding: 12px 16px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: var(--font); font-size: 14px; outline: none; }
  .user-form select:focus { border-color: var(--accent); }
  .success-msg { padding: 10px 16px; background: var(--sage-light); border: 1px solid #16a34a44; border-radius: 8px; color: #16a34a; font-size: 12px; font-family: var(--mono); margin-bottom: 16px; }
  .user-delete-btn { padding: 4px 8px; background: none; border: 1px solid transparent; color: var(--muted); cursor: pointer; border-radius: 4px; opacity: 0.4; transition: all 0.15s; font-size: 12px; }
  .user-delete-btn:hover { opacity: 1; border-color: #ef444488; color: #ef9a9a; }
  .visa-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; padding: 3px 9px; border-radius: 4px; font-family: var(--mono); }
  .visa-ok { color: #22c55e; border: 1px solid #22c55e44; }
  .visa-no { color: #ef4444; border: 1px solid #ef444444; }
  .visa-warn { color: #f97316; border: 1px solid #f9731644; }
  .assign-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
  .assign-select { padding: 4px 10px; border-radius: 6px; font-family: var(--mono); font-size: 11px; border: 1px solid var(--border); background: var(--bg); color: var(--text); cursor: pointer; outline: none; }
  .feedback-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .feedback-popup { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 28px 32px; max-width: 380px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,.4); }
  .feedback-title { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
  .feedback-desc { font-size: 12px; color: var(--muted); font-family: var(--mono); margin-bottom: 20px; }
  .feedback-stars { display: flex; gap: 8px; margin-bottom: 16px; }
  .feedback-star { font-size: 28px; cursor: pointer; color: var(--border); transition: color 0.15s, transform 0.1s; }
  .feedback-star:hover { transform: scale(1.15); }
  .feedback-star.active { color: #FBBF24; }
  .feedback-comment { width: 100%; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: var(--mono); font-size: 12px; resize: vertical; outline: none; min-height: 60px; }
  .feedback-comment:focus { border-color: var(--accent); }
  .feedback-btns { display: flex; gap: 8px; margin-top: 16px; }
  .feedback-skip { flex: 1; padding: 9px; border-radius: 8px; border: 1px solid var(--border); background: none; color: var(--muted); font-family: var(--font); font-size: 13px; cursor: pointer; transition: all 0.15s; }
  .feedback-skip:hover { border-color: var(--text); color: var(--text); }
  .feedback-send { flex: 1; padding: 9px; border-radius: 8px; border: none; background: var(--accent); color: #fff; font-family: var(--font); font-weight: 700; font-size: 13px; cursor: pointer; transition: opacity 0.15s; }
  .feedback-send:hover { opacity: 0.9; }
  .feedback-send:disabled { opacity: 0.4; cursor: default; }
  .doc-list { display: flex; flex-direction: column; gap: 6px; }
  .doc-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; }
  .doc-type { flex: 0 0 220px; font-size: 12px; font-family: var(--mono); color: var(--text); }
  .doc-status-select { flex: 0 0 auto; font-size: 11px; font-family: var(--mono); background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; padding: 3px 6px; cursor: pointer; }
  .doc-notes-input { flex: 1; font-size: 11px; font-family: var(--mono); background: var(--bg); color: var(--muted); border: 1px solid var(--border); border-radius: 4px; padding: 3px 8px; outline: none; }
  .doc-notes-input:focus { border-color: var(--accent); color: var(--text); }

/* ── Portal cliente — responsive móvil ── */
@media (max-width: 600px) {
  .portal-header { padding: 0 16px !important; }
  .portal-header .user-badge { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .portal-stats { gap: 8px !important; }
  .portal-stat-card { flex: 1 1 calc(50% - 8px) !important; min-width: 0 !important; padding: 10px 12px !important; }
  .portal-stat-card .stat-value { font-size: 18px !important; }
  .portal-conv-row { flex-direction: column !important; gap: 4px !important; align-items: flex-start !important; }
  .portal-conv-fecha { white-space: normal !important; }
  .portal-solicitud-row { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
  .portal-solicitud-btn { width: 100% !important; text-align: center !important; }
  .portal-perfil-row { flex-direction: column !important; gap: 4px !important; }
  .portal-perfil-label { min-width: unset !important; }
}
`;

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}
function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function getOriginLabel(origin) {
  const map = { eu: "UE / EEE", latam_convenio: "LATAM Convenio", convenio: "LATAM · Convenio", extracomunitario: "Extracomunitario" };
  return map[origin] || origin;
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function handle(e) {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      const session = await authSignIn(email, pass);
      saveSession(session);
      setAccessToken(session.access_token);
      onLogin({
        name: session.user.user_metadata?.name || email.split("@")[0],
        email: session.user.email,
        id: session.user.id,
        role: session.user.user_metadata?.role || "team",
      });
    } catch (error) {
      setErr(error.message === "Invalid login credentials"
        ? "Email o contraseña incorrectos"
        : error.message || "Error al iniciar sesión");
    }
    setLoading(false);
  }
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">▸ QueEstudiar · Admisiones</div>
        <div className="login-title">Panel de gestión</div>
        <div className="login-sub">Acceso restringido al equipo de admisiones</div>
        <form onSubmit={handle}>
          <div className="field"><label>Email</label><input type="email" value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} autoComplete="email" placeholder="tu@queestudiar.es" /></div>
          <div className="field"><label>Contraseña</label><input type="password" value={pass} onChange={e => { setPass(e.target.value); setErr(""); }} autoComplete="current-password" /></div>
          <button className="btn-primary" type="submit" disabled={loading}>{loading ? "Verificando..." : "Entrar →"}</button>
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
        {hom.volante_condicional && <div style={{ marginTop: 8, fontSize: 12, color: "#ca8a04", fontFamily: "var(--mono)" }}>⚠ Volante Condicional disponible</div>}
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
          {tests.formula_nota_base && <div style={{ marginTop: 10, padding: "8px 12px", background: "#f0f4ff", borderRadius: 6, fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent)" }}>{tests.formula_nota_base}</div>}
          {tests.convocatorias?.map((c, i) => <div key={i} style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>📖 <strong style={{ color: "var(--text)" }}>{c.tipo}:</strong> {c.fechas_espana}{c.fechas_sedes_internacionales && ` · Internacional: ${c.fechas_sedes_internacionales}`}</div>)}
        </div>
      )}
      {scholarships.length > 0 && (
        <div className="req-block">
          <div className="req-label">🎒 Becas disponibles</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {scholarships.map((b, i) => (
              <div key={i} style={{ padding: "8px 12px", background: "#f0f4ff", borderRadius: 6, borderLeft: "2px solid var(--accent)" }}>
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
          <div className="req-label">📜 Calendario clave</div>
          <div className="dates-list">{dates.map((d, i) => <div key={i} className="date-item"><span className="date-hito">{d.hito}</span><span className="date-mes">{d.mes || d.fecha}</span></div>)}</div>
        </div>
      )}
      {req.notes && <div className="req-block"><div className="req-label">📎 Notas</div><div className="req-value" style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>{req.notes}</div></div>}
    </div>
  );
}

function RegionPanel({ regionData, studentOrigin }) {
  if (!regionData || regionData.length === 0) return <div style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--mono)" }}>Sin datos de costes para las regiones seleccionadas.</div>;
  const isNonEU = studentOrigin === "extracomunitario";
  const ptypeLabel = { "fp_superior": "FP Grado Superior", "university_bachelor": "Grado Universitario", "university_master": "Máster" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {regionData.map((r, i) => (
        <div key={i} className="req-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{r.region}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{ptypeLabel[r.program_type] || r.program_type}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: r.public_cost_eur === 0 ? "#16a34a" : "var(--accent)" }}>
                {r.public_cost_eur === 0 ? "Gratuito" : `${r.public_cost_eur?.toLocaleString("es-ES")}€`}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)" }}>público UE / año</div>
              {isNonEU && r.non_eu_surcharge && (
                <div style={{ fontSize: 11, color: "#ca8a04", fontFamily: "var(--mono)", marginTop: 2 }}>⚠ +recargo no-UE</div>
              )}
            </div>
          </div>
          {r.private_cost_range && <div style={{ marginBottom: 8 }}><span className="req-pill">Privado: {r.private_cost_range}€/año</span>{r.non_eu_surcharge && <span className="req-pill" style={{ color: "#ca8a04" }}>⚠ Recargo no-UE</span>}</div>}
          {r.key_dates?.length > 0 && <div className="dates-list" style={{ marginBottom: 8 }}>{r.key_dates.map((d, j) => <div key={j} className="date-item"><span className="date-hito">{d.hito}</span><span className="date-mes">{d.fecha || d.mes}</span></div>)}</div>}
          {r.platform_url && <a href={r.platform_url} target="_blank" rel="noreferrer" className="url-btn" style={{ marginTop: 4 }}>↗ Portal de admisión</a>}
          {r.notes && <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted)", lineHeight: 1.6, fontFamily: "var(--mono)" }}>{r.notes}</div>}
        </div>
      ))}
    </div>
  );
}

function UrlBtn({ url, status, label, style: extraStyle }) {
  if (!url) return null;
  if (status === "rota") {
    return <span className="url-rota" title="URL rota o no disponible">⚠ {label}: no disponible</span>;
  }
  if (status === "generica") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="url-btn url-generica" title="URL genérica — redirige a la web principal de la institución" style={extraStyle}>
        🌐 {label}
      </a>
    );
  }
  if (status === "manual_ok") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="url-btn url-manual-ok" title="URL verificada manualmente por el equipo" style={extraStyle}>
        ✅ {label}
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="url-btn url-ok" style={extraStyle}>
      ↗ {label}
    </a>
  );
}

function EditableUrlBtn({ url, status, label, style: extraStyle, programId, field, onUrlUpdated, extranjeroUrl, extranjeroNotas }) {
  const [editing, setEditing] = useState(false);
  const [newUrl, setNewUrl] = useState(url || "");
  const [saving, setSaving] = useState(false);
  const [showExtranjero, setShowExtranjero] = useState(false);
  const [editingExtranjero, setEditingExtranjero] = useState(false);
  const [extranjeroUrlVal, setExtranjeroUrlVal] = useState(extranjeroUrl || "");
  const [extranjeroNotasVal, setExtranjeroNotasVal] = useState(extranjeroNotas || "");
  const [savingExtranjero, setSavingExtranjero] = useState(false);

  const supportsExtranjero = extranjeroUrl !== undefined;

  useEffect(() => { setNewUrl(url || ""); setEditing(false); }, [url]);
  useEffect(() => { setExtranjeroUrlVal(extranjeroUrl || ""); setExtranjeroNotasVal(extranjeroNotas || ""); }, [extranjeroUrl, extranjeroNotas]);

  async function handleSave() {
    const trimmed = newUrl.trim();
    if (!trimmed || trimmed === url) { setEditing(false); return; }
    setSaving(true);
    await updateProgramUrl(programId, field, trimmed);
    setSaving(false);
    setEditing(false);
    if (onUrlUpdated) onUrlUpdated(programId, field, trimmed, url);
  }

  async function handleSaveExtranjero() {
    const trimmedUrl = extranjeroUrlVal.trim();
    const trimmedNotas = extranjeroNotasVal.trim();
    setSavingExtranjero(true);
    await patch("programas", programId, { url_solicitud_extranjero: trimmedUrl || null, url_solicitud_extranjero_notas: trimmedNotas || null });
    setSavingExtranjero(false);
    setEditingExtranjero(false);
  }

  if (editing) {
    return (
      <div className="url-edit-row">
        <input className="url-edit-input" value={newUrl} onChange={e => setNewUrl(e.target.value)}
          placeholder={"URL de " + label.toLowerCase()}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setEditing(false); setNewUrl(url || ""); } }}
          autoFocus />
        <button className="url-edit-btn save" onClick={handleSave} disabled={saving}>{saving ? "…" : "✓"}</button>
        <button className="url-edit-btn" onClick={() => { setEditing(false); setNewUrl(url || ""); }}>✕</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <UrlBtn url={url} status={status} label={label} style={extraStyle} />
        <button className="url-pencil" onClick={() => setEditing(true)} title="Editar URL">✏️</button>
        {supportsExtranjero && (
          <button className="url-pencil" onClick={() => setShowExtranjero(v => !v)} title="URL extranjero" style={{ opacity: extranjeroUrl ? 1 : 0.5 }}>🌍</button>
        )}
      </div>
      {supportsExtranjero && showExtranjero && (
        <div style={{ marginLeft: 4, padding: "8px 10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6 }}>
          {editingExtranjero ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <input className="url-edit-input" value={extranjeroUrlVal} onChange={e => setExtranjeroUrlVal(e.target.value)} placeholder="URL solicitud extranjero (https://...)" />
              <input className="url-edit-input" value={extranjeroNotasVal} onChange={e => setExtranjeroNotasVal(e.target.value)} placeholder="Notas (requiere NIE, formulario en español...)" />
              <div style={{ display: "flex", gap: 4 }}>
                <button className="url-edit-btn save" onClick={handleSaveExtranjero} disabled={savingExtranjero}>{savingExtranjero ? "…" : "✓ Guardar"}</button>
                <button className="url-edit-btn" onClick={() => { setEditingExtranjero(false); setExtranjeroUrlVal(extranjeroUrl || ""); setExtranjeroNotasVal(extranjeroNotas || ""); }}>✕</button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {extranjeroUrl
                  ? <a href={extranjeroUrl} target="_blank" rel="noreferrer" className="url-btn url-ok" style={{ fontSize: 11 }}>↗ Extranjero 🌍</a>
                  : <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>Sin URL extranjero aún</span>}
                <button className="url-pencil" onClick={() => setEditingExtranjero(true)} title="Editar URL extranjero">✏️</button>
              </div>
              {extranjeroNotas && <div style={{ fontSize: 10, color: "#ca8a04", fontFamily: "var(--mono)" }}>ℹ {extranjeroNotas}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EditableHours({ horas, programId, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(horas ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValue(horas ?? ""); setEditing(false); }, [horas]);

  async function handleSave() {
    const num = value === "" ? null : parseInt(value, 10);
    if (num === horas) { setEditing(false); return; }
    setSaving(true);
    await patch("programas", programId, { horas_semanales: num });
    setSaving(false);
    setEditing(false);
    if (onUpdated) onUpdated(programId, num);
  }

  const badge = horas != null && horas >= 20
    ? { icon: "✅", text: `Apto visado (${horas}h/sem)`, cls: "visa-ok" }
    : horas != null && horas < 20
    ? { icon: "❌", text: `No apto visado (${horas}h/sem)`, cls: "visa-no" }
    : { icon: "⚠", text: "Verificar horas", cls: "visa-warn" };

  if (editing) {
    return (
      <div className="url-edit-row">
        <input className="url-edit-input" type="number" min="0" max="60" value={value} onChange={e => setValue(e.target.value)}
          placeholder="h/sem" style={{ maxWidth: 70 }}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setEditing(false); setValue(horas ?? ""); } }}
          autoFocus />
        <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)" }}>h/sem</span>
        <button className="url-edit-btn save" onClick={handleSave} disabled={saving}>{saving ? "…" : "✓"}</button>
        <button className="url-edit-btn" onClick={() => { setEditing(false); setValue(horas ?? ""); }}>✕</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <span className={`visa-badge ${badge.cls}`}>{badge.icon} {badge.text}</span>
      <button className="url-pencil" onClick={() => setEditing(true)} title="Editar horas semanales">✏️</button>
    </div>
  );
}

function VisaBadge({ visaEligible, horas }) {
  if (visaEligible === 'elegible') return <span className="pub-badge" style={{ background: "var(--success-bg,#f0fdf4)", color: "var(--success,#16a34a)" }}>✅ Apto visado</span>;
  if (visaEligible === 'no_elegible') return <span className="pub-badge" style={{ background: "var(--danger-bg,#fef2f2)", color: "var(--danger,#dc2626)" }}>❌ No apto visado</span>;
  if (visaEligible === 'no_aplica') return <span className="pub-badge" style={{ background: "var(--bg,#1a1a2e)", color: "var(--muted,#888)", border: "1px solid var(--border,#333)" }}>⚫ Vía investigador</span>;
  if (horas != null && horas >= 20) return <span className="pub-badge" style={{ background: "#fffbeb", color: "#d97706" }}>⏳ Por verificar ({horas}h/sem)</span>;
  return <span className="pub-badge" style={{ background: "#fffbeb", color: "#d97706" }}>⏳ Por verificar</span>;
}

function FeedbackPopup({ actionType, userName, userEmail, onClose }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit() {
    if (rating === 0) { onClose(); return; }
    setSending(true);
    await insertFeedback({
      user_email: userEmail,
      user_name: userName,
      action_type: actionType,
      rating,
      comment: comment.trim() || null,
    });
    setSending(false);
    onClose();
  }

  return (
    <div className="feedback-overlay" onClick={onClose}>
      <div className="feedback-popup" onClick={e => e.stopPropagation()}>
        <div className="feedback-title">¿Cómo fue esta acción?</div>
        <div className="feedback-desc">Tu feedback nos ayuda a mejorar la herramienta</div>
        <div className="feedback-stars">
          {[1,2,3,4,5].map(s => (
            <span key={s} className={`feedback-star ${s <= rating ? "active" : ""}`} onClick={() => setRating(s)}>★</span>
          ))}
        </div>
        <textarea className="feedback-comment" value={comment} onChange={e => setComment(e.target.value)} placeholder="Comentario opcional..." rows={3} />
        <div className="feedback-btns">
          <button className="feedback-skip" onClick={onClose}>Omitir</button>
          <button className="feedback-send" onClick={handleSubmit} disabled={sending}>{sending ? "Enviando..." : "Enviar"}</button>
        </div>
      </div>
    </div>
  );
}

function FeedbackReview({ onClose }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadFeedback(); }, []);

  async function loadFeedback() {
    setLoading(true);
    const url = `${SUPABASE_URL}/rest/v1/feedback?select=*&order=created_at.desc&limit=200`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    const data = await res.json();
    setFeedbacks(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function markReviewed(id) {
    await patch("feedback", id, { reviewed: true });
    setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, reviewed: true } : f));
  }

  const withRating = feedbacks.filter(f => f.rating);
  const avgRating = withRating.length > 0 ? (withRating.reduce((s, f) => s + f.rating, 0) / withRating.length).toFixed(1) : "—";
  const unreviewed = feedbacks.filter(f => !f.reviewed).length;

  const byDay = {};
  feedbacks.forEach(f => {
    const day = new Date(f.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(f);
  });

  return (
    <div className="detail">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div className="detail-name">Feedback del equipo</div>
          <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 4 }}>
            Rating promedio: <span style={{ color: "var(--accent)" }}>{avgRating}</span> · Sin revisar: <span style={{ color: "#ca8a04" }}>{unreviewed}</span>
          </div>
        </div>
        <button className="btn-ghost" onClick={onClose}>← Volver</button>
      </div>
      {loading ? <div className="loading" style={{ height: 200 }}><div className="spinner" /> Cargando feedback...</div>
      : feedbacks.length === 0 ? <div className="empty" style={{ height: 200 }}><div className="empty-icon">◎</div><div className="empty-text">Sin feedback aún</div></div>
      : Object.entries(byDay).map(([day, items]) => (
        <div key={day} style={{ marginBottom: 24 }}>
          <div className="section-title">{day}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map(f => (
              <div key={f.id} className="program-card" style={{ opacity: f.reviewed ? 0.5 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{f.user_name} <span style={{ fontWeight: 400, color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 11 }}>· {f.action_type}</span></div>
                    <div style={{ fontSize: 16, marginTop: 4, color: "#FBBF24" }}>{"★".repeat(f.rating || 0)}<span style={{ color: "var(--border)" }}>{"★".repeat(5 - (f.rating || 0))}</span></div>
                    {f.comment && <div style={{ fontSize: 12, color: "var(--text)", marginTop: 6, lineHeight: 1.5 }}>{f.comment}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)" }}>{new Date(f.created_at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
                    {!f.reviewed && <button className="url-edit-btn save" onClick={() => markReviewed(f.id)} style={{ fontSize: 10 }}>✓ Revisado</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function generateExpedienteReport(student, matches, requirements, regionData) {
  const now = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const originMap = { eu: "UE / EEE", latam_convenio: "LATAM Convenio", convenio: "LATAM · Convenio", extracomunitario: "Extracomunitario" };
  const typeMap = { grado: "Grado", master: "Máster", fp_superior: "FP Superior", doctorado: "Doctorado", bachillerato: "Bachillerato" };
  const cities = Array.isArray(student.preferred_cities) ? student.preferred_cities.join(", ") : (student.preferred_cities || "—");
  const programType = typeMap[student.desired_program_type] || typeMap[student.education_level] || "—";

  let r = `═══ INFORME DE EXPEDIENTE ═══\nGenerado: ${now}\n\n`;
  r += `▸ DATOS DEL ESTUDIANTE\n`;
  r += `  Nombre: ${student.full_name || "—"}\n`;
  r += `  Email: ${student.email || "—"}\n`;
  r += `  País: ${student.country_of_origin || "—"}\n`;
  r += `  Origen: ${originMap[student.student_origin] || student.student_origin || "—"}\n`;
  r += `  Nivel educativo: ${typeMap[student.education_level] || student.education_level || "—"}\n`;
  r += `  Programa deseado: ${programType}\n`;
  r += `  Área de estudio: ${student.study_area || "—"}\n`;
  r += `  Ciudades preferidas: ${cities}\n`;
  if (student.base_degree) r += `  Titulación base: ${student.base_degree}\n`;

  r += `\n▸ PROGRAMAS ASIGNADOS (${matches.length})\n`;
  if (matches.length > 0) {
    const byArea = {};
    matches.forEach(m => {
      const area = m.programas?.familia_area || "Sin área";
      if (!byArea[area]) byArea[area] = [];
      byArea[area].push(m);
    });
    Object.entries(byArea).sort().forEach(([area, ms]) => {
      r += `  [${area}] — ${ms.length} programa${ms.length > 1 ? "s" : ""}\n`;
      ms.slice(0, 5).forEach(m => {
        const p = m.programas || {};
        const price = student.student_origin === "extracomunitario" && p.precio_extracomunitario_eur != null ? p.precio_extracomunitario_eur : p.precio_anual_eur;
        r += `    • ${p.nombre || "?"} (${p.ciudad || "?"})`;
        if (price != null) r += ` — ${price === 0 ? "Gratuito" : price.toLocaleString("es-ES") + "€/año"}`;
        r += `\n`;
      });
      if (ms.length > 5) r += `    ... y ${ms.length - 5} más\n`;
    });
  } else {
    r += `  Sin programas asignados\n`;
  }

  if (requirements) {
    r += `\n▸ REQUISITOS DE ADMISIÓN\n`;
    const hom = requirements.homologacion || {};
    if (hom.proceso) r += `  Homologación: ${hom.proceso}\n`;
    if (hom.tasa_eur) r += `  Tasa homologación: ${hom.tasa_eur}€\n`;
    if (hom.plazo_resolucion_meses) r += `  Plazo resolución: ${hom.plazo_resolucion_meses} meses\n`;
    const lang = requirements.language_req || {};
    if (lang.nivel_minimo) r += `  Idioma mínimo: ${lang.nivel_minimo} (${lang.marco || ""})\n`;
    if (lang.certificados_aceptados?.length) r += `  Certificados: ${lang.certificados_aceptados.join(", ")}\n`;
    const tests = requirements.access_tests || {};
    if (tests.nombre) r += `  Prueba acceso: ${tests.nombre}\n`;
    const dates = requirements.key_dates || [];
    if (dates.length > 0) {
      r += `  Fechas clave:\n`;
      dates.forEach(d => { r += `    - ${d.hito}: ${d.mes || d.fecha}\n`; });
    }
  }

  if (regionData?.length > 0) {
    r += `\n▸ COSTES POR REGIÓN\n`;
    regionData.forEach(reg => {
      r += `  ${reg.region} (${reg.program_type}): `;
      r += reg.public_cost_eur === 0 ? "Gratuito" : `${reg.public_cost_eur?.toLocaleString("es-ES")}€/año público`;
      if (reg.private_cost_range) r += ` | Privado: ${reg.private_cost_range}€/año`;
      r += `\n`;
    });
  }

  r += `\n▸ CHECKLIST DE SEGUIMIENTO\n`;
  r += `  [ ] Documentación académica recibida\n`;
  r += `  [ ] Homologación del título iniciada\n`;
  if (requirements?.language_req?.nivel_minimo) r += `  [ ] Certificado de idioma presentado\n`;
  if (requirements?.access_tests?.nombre) r += `  [ ] Inscripción en ${requirements.access_tests.nombre}\n`;
  r += `  [ ] Solicitud de admisión enviada\n`;
  r += `  [ ] Confirmación de plaza recibida\n`;
  r += `  [ ] Matrícula formalizada\n`;
  if (student.student_origin === "extracomunitario") {
    r += `  [ ] Visado de estudiante solicitado\n`;
    r += `  [ ] Seguro médico contratado\n`;
  }

  r += `\n▸ OBSERVACIONES\n`;
  r += `  (Añadir notas manuales aquí)\n`;
  return r;
}

function UserManagement({ onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", role: "team" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    const fallbackUsers = TEAM_FALLBACK.map(m => ({
      id: m.email,
      email: m.email,
      created_at: null,
      user_metadata: { name: m.name, role: 'team' },
      _isFallback: true,
    }));
    try {
      const list = await adminListUsers();
      if (list && list.length > 0) {
        setUsers(list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      } else {
        setUsers(fallbackUsers);
      }
    } catch {
      setUsers(fallbackUsers);
    }
    setLoading(false);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await adminCreateUser(formData.email, formData.password, formData.name, formData.role);
      setSuccess(`Usuario "${formData.name}" creado correctamente`);
      setFormData({ name: "", email: "", password: "", role: "team" });
      setShowForm(false);
      loadUsers();
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message);
    }
    setCreating(false);
  }

  async function handleDelete(user) {
    if (!window.confirm(`\u00bfEliminar al usuario ${user.email}? Esta acci\u00f3n no se puede deshacer.`)) return;
    try {
      await adminDeleteUser(user.id);
      setSuccess(`Usuario "${user.email}" eliminado`);
      loadUsers();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="detail">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div className="detail-name">Gestión de usuarios</div>
          <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 4 }}>Crear y gestionar cuentas del equipo de admisiones</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="save-btn" style={{ marginTop: 0 }} onClick={() => { setShowForm(!showForm); setError(""); }}>{showForm ? "\u2715 Cancelar" : "+ Nuevo usuario"}</button>
          <button className="btn-ghost" onClick={onClose}>← Volver</button>
        </div>
      </div>

      {success && <div className="success-msg">✅ {success}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="user-form">
          <div style={{ fontSize: 10, fontFamily: "var(--mono)", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16 }}>Nuevo usuario</div>
          <div className="user-form-grid">
            <div className="field"><label>Nombre completo</label><input value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required placeholder="María García" /></div>
            <div className="field"><label>Email</label><input type="email" value={formData.email} onChange={e => setFormData(p => ({...p, email: e.target.value}))} required placeholder="maria@queestudiar.es" /></div>
            <div className="field"><label>Contraseña</label><input type="password" value={formData.password} onChange={e => setFormData(p => ({...p, password: e.target.value}))} required minLength={6} placeholder="Mín. 6 caracteres" /></div>
            <div className="field"><label>Rol</label><select className="user-form" value={formData.role} onChange={e => setFormData(p => ({...p, role: e.target.value}))}><option value="team">Equipo</option><option value="admin">Administrador</option></select></div>
          </div>
          {error && <div className="login-err" style={{ textAlign: "left", marginTop: 8 }}>{error}</div>}
          <button className="btn-primary" type="submit" disabled={creating} style={{ width: "auto", marginTop: 16, padding: "10px 28px" }}>{creating ? "Creando..." : "Crear usuario \u2192"}</button>
        </form>
      )}

      {users.some(u => u._isFallback) && (
        <div style={{ padding: "8px 14px", background: "#dbeafe", borderRadius: 6, marginBottom: 16, fontSize: 11, color: "var(--accent)", fontFamily: "var(--mono)" }}>
          Lista predefinida — configura VITE_SUPABASE_KEY con service_role en Vercel para gestión completa de usuarios.
        </div>
      )}
      {loading ? <div className="loading" style={{ height: 200 }}><div className="spinner" /> Cargando usuarios...</div>
      : users.length === 0 ? <div className="empty" style={{ height: 200 }}><div className="empty-icon">○</div><div className="empty-text">No hay usuarios registrados</div></div>
      : (
        <div className="user-mgmt-grid">
          {users.map(u => (
            <div key={u.id} className="user-card">
              <div>
                <div className="user-name">{u.user_metadata?.name || u.email.split("@")[0]}</div>
                <div className="user-email">{u.email}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className={`user-role ${u.user_metadata?.role === "admin" ? "admin" : "team"}`}>{u.user_metadata?.role === "admin" ? "Admin" : "Equipo"}</span>
                {u.created_at && <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)" }}>{new Date(u.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                {!u._isFallback && (
                  <button className="user-delete-btn" onClick={() => handleDelete(u)} title="Eliminar usuario">🗑</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function StudentDetail({ student, onStatusChange, onNotesSave, currentUser, onAssign, teamMembers = [] }) {
  const [tab, setTab] = useState("matches");
  const [notes, setNotes] = useState(student.notes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [matches, setMatches] = useState([]);
  const [requirements, setRequirements] = useState(null);
  const [regionData, setRegionData] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [filterArea, setFilterArea] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const [urlLearning, setUrlLearning] = useState(null);
  const [applyingLearning, setApplyingLearning] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedPtype, setSelectedPtype] = useState(null);
  useEffect(() => { setNotes(student.notes || ""); setTab("matches"); setFilterArea("all"); setFilterStage("all"); setUrlLearning(null); loadDocuments(); }, [student.id]);
  useEffect(() => { setSelectedPtype(null); loadMatches(); loadRequirements(); }, [student.id]);

  async function loadMatches() {
    setLoadingMatches(true);
    try {
      const data = await query("matches", "*, programas(nombre, ciudad, tipo, familia_area, url_solicitud, url_solicitud_status, url_solicitud_extranjero, url_solicitud_extranjero_notas, url_detalle, url_detalle_status, modalidad, idioma, precio_anual_eur, precio_extracomunitario_eur, horas_semanales, visa_eligible)", { student_id: student.id });
      setMatches(Array.isArray(data) ? data : []);
    } catch { setMatches([]); }
    setLoadingMatches(false);
  }

  const ptypeMap = {
    "grado": "university_bachelor",
    "fp_superior": "fp_superior",
    "master": "university_master",
    "doctorado": "university_master",
  };
  const ptypeMapLegacy = {
    "bachillerato": "university_bachelor",
    "fp_superior": "fp_superior",
    "grado": "university_master",
    "master": "university_master",
  };
  const ptypeAuto = ptypeMap[student.desired_program_type] || ptypeMapLegacy[student.education_level] || "university_bachelor";
  const ptype = selectedPtype || ptypeAuto;

  async function loadRequirements(ptypeOverride) {
    try {
      const ptypeToUse = ptypeOverride || selectedPtype || ptypeAuto;
      const origin = student.student_origin || "extracomunitario";
      const reqs = await query("admission_requirements", "*", { program_type: ptypeToUse, student_origin: origin });
      if (Array.isArray(reqs) && reqs.length > 0) setRequirements(reqs[0]);
      else setRequirements(null);
      const cityToRegion = {
        "Madrid": "Madrid", "Barcelona": "Cataluña", "Valencia": "Comunidad Valenciana",
        "Sevilla": "Andalucía", "Málaga": "Andalucía", "Granada": "Andalucía",
        "Bilbao": "País Vasco", "San Sebastián": "País Vasco", "Vitoria": "País Vasco",
        "Zaragoza": "Aragón", "Pamplona": "Navarra", "Santander": "Cantabria",
        "A Coruña": "Galicia", "Santiago de Compostela": "Galicia", "Vigo": "Galicia",
        "Murcia": "Murcia", "Alicante": "Comunidad Valenciana", "Castellón": "Comunidad Valenciana",
        "Valladolid": "Castilla y León", "Salamanca": "Castilla y León",
        "Toledo": "Castilla-La Mancha", "Albacete": "Castilla-La Mancha",
        "Palma de Mallorca": "Islas Baleares", "Las Palmas": "Canarias", "Santa Cruz de Tenerife": "Canarias",
        "Oviedo": "Asturias", "Logroño": "La Rioja", "Mérida": "Extremadura",
      };
      const studentCities = Array.isArray(student.preferred_cities) ? student.preferred_cities : [];
      const regions = [...new Set(studentCities.map(c => cityToRegion[c]).filter(Boolean))];
      let regionResults = [];
      if (regions.length > 0) {
        const regionParam = regions.map(r => encodeURIComponent(r)).join(",");
        const url = `${SUPABASE_URL}/rest/v1/admission_by_region?select=*&program_type=eq.${ptypeToUse}&region=in.(${regionParam})`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        regionResults = await res.json();
      }
      if (!Array.isArray(regionResults) || regionResults.length === 0) {
        const fallback = await query("admission_by_region", "*", { program_type: ptypeToUse });
        regionResults = Array.isArray(fallback) ? fallback.slice(0, 4) : [];
      }
      setRegionData(regionResults);
    } catch {}
  }

  async function saveNotes() {
    setSaving(true);
    await patch("student_leads", student.id, { notes });
    setSaving(false); setSaved(true);
    onNotesSave(student.id, notes);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleHoursUpdated(programId, newHours) {
    setMatches(prev => prev.map(m => {
      if (m.programa_id === programId) {
        return { ...m, programas: { ...m.programas, horas_semanales: newHours } };
      }
      return m;
    }));
  }

  async function patchMatchStage(matchId, stage) {
    if (stage === 'solicitud') {
      const solicitudCount = matches.filter(m => m.match_stage === 'solicitud' && m.id !== matchId).length;
      if (solicitudCount >= 2) {
        alert('⚠ Máximo 2 programas pueden estar en fase "Solicitud activa"');
        return;
      }
    }
    await patch("matches", matchId, { match_stage: stage });
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, match_stage: stage } : m));
  }

  async function loadDocuments() {
    setLoadingDocs(true);
    try {
      const data = await query("student_documents", "*", { student_id: student.id });
      setDocuments(Array.isArray(data) ? data : []);
    } catch { setDocuments([]); }
    setLoadingDocs(false);
  }

  async function initializeDocuments() {
    const existing = new Set(documents.map(d => d.document_type));
    const toCreate = DOCUMENT_TYPES.filter(dt => !existing.has(dt)).map(dt => ({ student_id: student.id, document_type: dt, status: 'pendiente' }));
    if (toCreate.length === 0) return;
    await fetch(`${SUPABASE_URL}/rest/v1/student_documents`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json", "Prefer": "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify(toCreate),
    });
    await loadDocuments();
  }

  async function patchDocument(docId, data) {
    await patch("student_documents", docId, { ...data, updated_at: new Date().toISOString() });
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, ...data } : d));

    if (data.status && student.email && student.client_user_id) {
      const doc = documents.find(d => d.id === docId);
      notifyStudent({
        type: "doc_status_changed",
        student_email: student.email,
        student_name: student.full_name,
        document_type: doc?.document_type ?? "Documento",
        new_status: data.status,
        doc_notes: data.notes ?? doc?.notes ?? "",
      });
    }
  }

  const [inviting, setInviting] = useState(false);
  const [clientUserId, setClientUserId] = useState(student.client_user_id || null);
  const [teamComment, setTeamComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);

  async function sendTeamComment() {
    const msg = teamComment.trim();
    if (!msg || !student.client_user_id) return;
    setSendingComment(true);
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/document_comments`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({
          student_document_id: null,
          author_id: currentUser.id,
          author_type: "team",
          message: msg,
          student_id: student.id,
        }),
      });
      setTeamComment("");
      notifyStudent({
        type: "team_comment",
        student_email: student.email,
        student_name: student.full_name,
        comment_message: msg,
      });
      alert("✅ Mensaje enviado al estudiante");
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
    setSendingComment(false);
  }

  async function sendPasswordRecovery(email) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error("Error al enviar email de acceso");
  }

  async function handleInvite() {
    if (!student.email) { alert("El estudiante no tiene email registrado."); return; }
    setInviting(true);
    try {
      if (clientUserId) {
        await sendPasswordRecovery(student.email);
        alert(`✅ Email de acceso enviado a ${student.email}`);
      } else {
        const newUser = await adminInviteStudent(student.email, student.id);
        await patch("student_leads", student.id, { client_user_id: newUser.id });
        setClientUserId(newUser.id);
        alert(`✅ Invitación enviada a ${student.email}`);
      }
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
    setInviting(false);
  }

  async function handleUrlUpdated(programId, field, newUrl, oldUrl) {
    // Update local matches state
    setMatches(prev => prev.map(m => {
      if (m.programa_id === programId) {
        return { ...m, programas: { ...m.programas, [field]: newUrl, [field + "_status"]: "manual_ok" } };
      }
      return m;
    }));
    // Learning: find other programs with same old URL
    if (oldUrl && oldUrl !== newUrl) {
      try {
        const others = await findProgramsWithSameUrl(field, oldUrl, programId);
        if (others.length > 0) {
          setUrlLearning({ field, oldUrl, newUrl, programs: others, appliedCount: 0 });
        }
      } catch {}
    }
  }

  async function applyLearning() {
    if (!urlLearning) return;
    setApplyingLearning(true);
    const ids = urlLearning.programs.map(p => p.id);
    await bulkUpdateProgramUrls(ids, urlLearning.field, urlLearning.newUrl);
    // Update local matches if any of these programs are in current matches
    const idSet = new Set(ids);
    setMatches(prev => prev.map(m => {
      if (idSet.has(m.programa_id)) {
        return { ...m, programas: { ...m.programas, [urlLearning.field]: urlLearning.newUrl, [urlLearning.field + "_status"]: "manual_ok" } };
      }
      return m;
    }));
    setUrlLearning(prev => ({ ...prev, appliedCount: ids.length }));
    setApplyingLearning(false);
    setTimeout(() => setUrlLearning(null), 3000);
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
          {student.education_level && <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>Nivel educativo: <span style={{ color: "var(--text)" }}>{student.education_level}</span></div>}
          {(student.desired_program_type || student.education_level) && <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>Programa deseado: <span style={{ color: "var(--text)" }}>{student.desired_program_type || (EDUCATION_TO_TIPO[student.education_level] || [])[0] || "—"}</span></div>}
          {student.base_degree && <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>Titulación base: <span style={{ color: "var(--text)" }}>{student.base_degree}</span></div>}
          {student.preferred_cities && <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>Ciudades: <span style={{ color: "var(--text)" }}>{Array.isArray(student.preferred_cities) ? student.preferred_cities.join(", ") : student.preferred_cities}</span></div>}
          {student.study_area && <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>Área: <span style={{ color: "var(--text)" }}>{student.study_area}</span></div>}
        </div>
        {currentUser?.role === "admin" && (
          <div className="assign-row">
            <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>Asignado a:</span>
            <select className="assign-select" value={student.assigned_to || ""} onChange={e => onAssign && onAssign(student.id, e.target.value)}>
              <option value="">Sin asignar</option>
              {teamMembers.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}
            </select>
          </div>
        )}
        {currentUser?.role === "admin" && (
          <div style={{ marginTop: 8 }}>
            <button className="btn-ghost" onClick={handleInvite} disabled={inviting} style={{ fontSize: 11 }}>
              {inviting ? "Enviando..." : clientUserId ? "↺ Reenviar acceso" : "✉ Invitar a portal"}
            </button>
            {clientUserId && <span style={{ fontSize: 10, color: "#16a34a", fontFamily: "var(--mono)", marginLeft: 8 }}>✓ Portal activado</span>}
          </div>
        )}
        {currentUser?.role !== "admin" && student.assigned_to && (
          <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)", marginTop: 8 }}>Asignado a ti</div>
        )}
      </div>
      <div className="tabs">
        {[["matches", `Matches (${matches.length})`], ["requisitos", "Requisitos admisión"], ["region", "Costes y plazos"], ["notas", "Notas expediente"], ["documentacion", "Documentación"]].map(([k, l]) => (
          <div key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{l}</div>
        ))}
      </div>
      {tab === "matches" && (
        <div className="section">
          {loadingMatches ? <div className="loading"><div className="spinner" /> Cargando programas...</div>
          : matches.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--muted)" }}>
              <div style={{ fontSize: 13, marginBottom: 8 }}>Sin programas asignados aún.</div>
              <div style={{ fontSize: 11, fontFamily: "var(--mono)", marginBottom: 16, color: "var(--muted)" }}>
                Puedes buscar programas manualmente y añadirlos, o esperar a que la automatización los genere.
              </div>
              <a
                href="https://queestudiar.es/programas"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11, padding: "6px 14px", borderRadius: 6, border: "1px solid var(--accent)", color: "var(--accent)", textDecoration: "none", fontFamily: "var(--mono)" }}
              >
                🔍 Buscar programas
              </a>
            </div>
          )
          : (() => {
              const areas = ["all", ...Array.from(new Set(matches.map(m => m.programas?.familia_area).filter(Boolean))).sort()];
              const isNonEUStudent = student.student_origin === "extracomunitario" || student.student_origin === "latam_convenio" || student.student_origin === "convenio";
              const areaFiltered = filterArea === "all" ? matches : matches.filter(m => m.programas?.familia_area === filterArea);
              const stageFiltered = filterStage === "all" ? areaFiltered : areaFiltered.filter(m => (m.match_stage || 'informe') === filterStage);
              const filtered = isNonEUStudent
                ? [...stageFiltered].sort((a, b) => {
                    const aNoEleg = a.programas?.visa_eligible === 'no_elegible' ? 1 : 0;
                    const bNoEleg = b.programas?.visa_eligible === 'no_elegible' ? 1 : 0;
                    return aNoEleg - bNoEleg;
                  })
                : stageFiltered;
              const STAGE_OPTS = [
                { k: "all", icon: "📋", label: `Todos (${matches.length})` },
                { k: "informe", icon: "📋", label: `Informe (${matches.filter(m => (m.match_stage || 'informe') === 'informe').length})` },
                { k: "seleccionado", icon: "⭐", label: `Seleccionado (${matches.filter(m => m.match_stage === 'seleccionado').length})` },
                { k: "solicitud", icon: "📨", label: `Solicitud (${matches.filter(m => m.match_stage === 'solicitud').length})` },
              ];
              return (
                <>
                  {areas.length > 2 && (
                    <div style={{ marginBottom: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {areas.map(a => (
                        <div key={a} className={`filter-chip ${filterArea === a ? "active" : ""}`} onClick={() => setFilterArea(a)}>
                          {a === "all" ? `Todas las áreas (${matches.length})` : `${a} (${matches.filter(m => m.programas?.familia_area === a).length})`}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginBottom: 16, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {STAGE_OPTS.map(({ k, icon, label }) => (
                      <div key={k} className={`filter-chip ${filterStage === k ? "active" : ""}`} onClick={() => setFilterStage(k)} style={{ borderColor: k === "solicitud" ? "var(--accent)" : undefined }}>
                        {k !== "all" && `${icon} `}{label}
                      </div>
                    ))}
                  </div>
                  {urlLearning && (
                    <div className="learning-banner">
                      <span>🧠</span>
                      <span><span className="learning-count">{urlLearning.appliedCount > 0 ? `✅ ${urlLearning.appliedCount}` : urlLearning.programs.length}</span>{urlLearning.appliedCount > 0 ? " programas corregidos" : ` programa${urlLearning.programs.length > 1 ? "s" : ""} más tenían esta misma URL genérica`}</span>
                      {!urlLearning.appliedCount && <button className="learning-btn apply" onClick={applyLearning} disabled={applyingLearning}>{applyingLearning ? "Aplicando..." : "✓ Corregir todos"}</button>}
                      <button className="learning-btn dismiss" onClick={() => setUrlLearning(null)}>{urlLearning.appliedCount > 0 ? "Cerrar" : "Ignorar"}</button>
                    </div>
                  )}
                  <div className="program-grid">{filtered.map((m, i) => { const p = m.programas || {};
                    const isNonEU = student.student_origin === "extracomunitario";
                    const isConvenio = student.student_origin === "latam_convenio" || student.student_origin === "convenio";
                    const price = isNonEU && p.precio_extracomunitario_eur != null ? p.precio_extracomunitario_eur : p.precio_anual_eur;
                    const priceLabel = isNonEU && p.precio_extracomunitario_eur !== p.precio_anual_eur ? "no-UE" : isConvenio ? "convenio" : "UE/residente";
                    return (
                    <div key={i} className="program-card" style={isNonEUStudent && p.visa_eligible === 'no_elegible' ? { opacity: 0.5 } : undefined}>
                      <div className="program-name">{p.nombre || "Programa sin nombre"}</div>
                      <div className="program-inst">{p.ciudad || "—"}</div>
                      <div className="program-tags">
                        {p.tipo && <span className="tag highlight">{p.tipo}</span>}
                        {p.modalidad && <span className="tag">{p.modalidad}</span>}
                        {p.familia_area && <span className="tag">{p.familia_area}</span>}
                        {p.idioma && <span className="tag">{p.idioma}</span>}
                        {price != null && <span className="tag" style={{ color: "#16a34a", borderColor: "#16a34a44" }}>{price === 0 ? "Gratuito" : `${price.toLocaleString("es-ES")}€/año`} · {priceLabel}</span>}
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <EditableHours horas={p.horas_semanales} programId={m.programa_id} onUpdated={handleHoursUpdated} />
                      </div>
                      <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                        <VisaBadge visaEligible={p.visa_eligible} horas={p.horas_semanales} />
                        <select
                          value={p.visa_eligible || 'pendiente'}
                          onChange={e => patch('programas', m.programa_id, { visa_eligible: e.target.value }).then(loadMatches)}
                          style={{ fontSize: 11, fontFamily: "var(--mono)", background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 6px", cursor: "pointer" }}
                        >
                          <option value="elegible">✅ Elegible</option>
                          <option value="no_elegible">❌ No elegible</option>
                          <option value="no_aplica">⚫ No aplica</option>
                          <option value="pendiente">⏳ Pendiente</option>
                        </select>
                      </div>
                      <div style={{ marginBottom: 10, display: "flex", gap: 6, alignItems: "center" }}>
                        {[["informe","📋"],["seleccionado","⭐"],["solicitud","📨"]].map(([stage, icon]) => (
                          <button key={stage} onClick={() => patchMatchStage(m.id, stage)} style={{
                            fontSize: 11, fontFamily: "var(--mono)", padding: "3px 8px", borderRadius: 4, cursor: "pointer",
                            border: `1px solid ${(m.match_stage || 'informe') === stage ? "var(--accent)" : "var(--border)"}`,
                            background: (m.match_stage || 'informe') === stage ? "var(--accent)" : "var(--bg)",
                            color: (m.match_stage || 'informe') === stage ? "#fff" : "var(--muted)",
                          }}>{icon} {stage}</button>
                        ))}
                      </div>
                      <div className="program-footer">
                        <EditableUrlBtn url={p.url_solicitud} status={p.url_solicitud_status} label="Solicitud" programId={m.programa_id} field="url_solicitud" onUrlUpdated={handleUrlUpdated} extranjeroUrl={p.url_solicitud_extranjero} extranjeroNotas={p.url_solicitud_extranjero_notas} />
                        <EditableUrlBtn url={p.url_detalle} status={p.url_detalle_status} label="Ver programa" programId={m.programa_id} field="url_detalle" onUrlUpdated={handleUrlUpdated} style={{ borderColor: "var(--accent2)", color: "var(--accent2)" }} />
                      </div>
                    </div>
                  );})}</div>
                </>
              );
            })()}
        </div>
      )}
      {tab === "requisitos" && (
        <div className="section">
          <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)", marginBottom: 16 }}>
            Perfil: <span style={{ color: "var(--accent2)" }}>{getOriginLabel(student.student_origin || "extracomunitario")}</span>
            {" · "}
            <span style={{ color: "var(--accent2)" }}>
              {{ "grado": "Grado Universitario", "fp_superior": "FP Grado Superior", "master": "Máster", "doctorado": "Doctorado" }[student.desired_program_type]
              || { "bachillerato": "Grado Universitario", "fp_superior": "FP Grado Superior", "grado": "Máster", "master": "Máster" }[student.education_level]
              || "Programa"}
            </span>
          </div>
          {(student.desired_program_type === "grado" || (!student.desired_program_type && student.education_level === "bachillerato")) && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "#fef9c3", border: "1px solid #ca8a0444", borderRadius: 8, fontSize: 11, fontFamily: "var(--mono)", color: "#ca8a04", lineHeight: 1.7 }}>
              ⚠ <strong>PCE (UNED):</strong> Requerida para carreras con nota de corte: Medicina, Enfermería, Psicología, Ingenierías. Excepción: estudiantes colombianos con Saber 11.
            </div>
          )}
          {/* Selector de tipo de programa */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "10px 14px", background: "var(--azure-light)", border: "1px solid #2563eb33", borderRadius: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--mono)", fontWeight: 600, whiteSpace: "nowrap" }}>
              Tipo de programa:
            </span>
            {[
              { value: "university_bachelor", label: "Grado" },
              { value: "fp_superior",         label: "FP Superior" },
              { value: "university_master",   label: "Máster / Doctorado" },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => { setSelectedPtype(opt.value); loadRequirements(opt.value); }}
                style={{
                  fontSize: 11, padding: "4px 12px", borderRadius: 20, cursor: "pointer", fontFamily: "var(--mono)",
                  border: `1px solid ${ptype === opt.value ? "var(--accent)" : "var(--border)"}`,
                  background: ptype === opt.value ? "var(--accent)" : "var(--surface)",
                  color: ptype === opt.value ? "#fff" : "var(--muted)",
                  transition: "all 0.15s",
                }}
              >
                {opt.label}
              </button>
            ))}
            {selectedPtype && (
              <button
                onClick={() => { setSelectedPtype(null); loadRequirements(ptypeAuto); }}
                style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
              >
                Restablecer auto
              </button>
            )}
          </div>
          <RequirementsPanel req={requirements} />
        </div>
      )}
      {tab === "region" && <div className="section"><RegionPanel regionData={regionData} studentOrigin={student.student_origin} /></div>}
      {tab === "notas" && <div className="section">
        <div className="section-title">Notas del expediente</div>
        <button className="save-btn" style={{ marginBottom: 12, background: "var(--accent2)" }} onClick={() => {
          const report = generateExpedienteReport(student, matches, requirements, regionData);
          setNotes(prev => prev ? prev + "\n\n" + report : report);
        }}>⚡ Generar informe automático</button>
        <textarea className="notes-area" style={{ minHeight: 200 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Documentos recibidos, comunicaciones, estado de homologación..." />
        <button className="save-btn" onClick={saveNotes} disabled={saving}>{saving ? "Guardando..." : saved ? "✓ Guardado" : "Guardar notas"}</button>
      </div>}
      {tab === "documentacion" && (
        <div className="section">
          <div className="section-title">Documentación del expediente</div>
          {loadingDocs ? (
            <div className="loading"><div className="spinner" /> Cargando...</div>
          ) : documents.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ color: "var(--muted)", fontSize: 13, fontFamily: "var(--mono)", marginBottom: 16 }}>Sin documentos registrados aún.</div>
              <button className="save-btn" onClick={initializeDocuments}>📋 Inicializar checklist</button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 12, fontFamily: "var(--mono)" }}>
                <span style={{ color: DOC_STATUS_CONFIG.aprobado.color }}>✅ {documents.filter(d => d.status === 'aprobado').length} / {documents.length} aprobados</span>
                <span style={{ color: DOC_STATUS_CONFIG.necesita_correccion.color }}>✏️ {documents.filter(d => d.status === 'necesita_correccion').length} necesitan corrección</span>
              </div>
              <div className="doc-list">
                {DOCUMENT_TYPES.map(dt => {
                  const doc = documents.find(d => d.document_type === dt);
                  if (!doc) return null;
                  const dsc = DOC_STATUS_CONFIG[doc.status] || DOC_STATUS_CONFIG.pendiente;
                  return (
                    <div key={dt} style={{ display: "flex", flexDirection: "column" }}>
                      <div className="doc-row">
                        <div className="doc-type">{dt}</div>
                        <select
                          className="doc-status-select"
                          value={doc.status}
                          onChange={e => patchDocument(doc.id, { status: e.target.value })}
                          style={{ color: dsc.color, borderColor: dsc.color + "66" }}
                        >
                          {Object.entries(DOC_STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.emoji} {v.label}</option>
                          ))}
                        </select>
                        {doc.file_url && (
                          <button
                            onClick={() => openPdf(doc.file_url)}
                            style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--mono)", marginLeft: 8, whiteSpace: "nowrap", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                          >
                            ↗ Ver PDF
                          </button>
                        )}
                        <input
                          className="doc-notes-input"
                          value={doc.notes || ""}
                          onChange={e => patchDocument(doc.id, { notes: e.target.value })}
                          placeholder="Notas..."
                        />
                      </div>
                      {doc.ai_score && (
                        <div style={{ marginTop: 6, marginBottom: 6, padding: "6px 10px", background: "#f8fafc", borderRadius: 5, border: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>IA:</span>
                            <span style={{ fontSize: 12 }}>{"⭐".repeat(doc.ai_score)}{"☆".repeat(5 - doc.ai_score)}</span>
                            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{doc.ai_score}/5</span>
                          </div>
                          {doc.ai_feedback && (
                            <div style={{ fontSize: 11, color: "var(--text)", marginTop: 4, lineHeight: 1.5 }}>{doc.ai_feedback}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {documents.filter(d => !DOCUMENT_TYPES.includes(d.document_type)).map(doc => {
                  const dsc = DOC_STATUS_CONFIG[doc.status] || DOC_STATUS_CONFIG.pendiente;
                  return (
                    <div key={doc.id} style={{ display: "flex", flexDirection: "column" }}>
                      <div className="doc-row">
                        <div className="doc-type">{doc.document_type}</div>
                        <select className="doc-status-select" value={doc.status} onChange={e => patchDocument(doc.id, { status: e.target.value })} style={{ color: dsc.color, borderColor: dsc.color + "66" }}>
                          {Object.entries(DOC_STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                        </select>
                        {doc.file_url && (
                          <button
                            onClick={() => openPdf(doc.file_url)}
                            style={{ fontSize: 11, color: "var(--accent)", fontFamily: "var(--mono)", marginLeft: 8, whiteSpace: "nowrap", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                          >
                            ↗ Ver PDF
                          </button>
                        )}
                        <input className="doc-notes-input" value={doc.notes || ""} onChange={e => patchDocument(doc.id, { notes: e.target.value })} placeholder="Notas..." />
                      </div>
                      {doc.ai_score && (
                        <div style={{ marginTop: 6, marginBottom: 6, padding: "6px 10px", background: "#f8fafc", borderRadius: 5, border: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>IA:</span>
                            <span style={{ fontSize: 12 }}>{"⭐".repeat(doc.ai_score)}{"☆".repeat(5 - doc.ai_score)}</span>
                            <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{doc.ai_score}/5</span>
                          </div>
                          {doc.ai_feedback && (
                            <div style={{ fontSize: 11, color: "var(--text)", marginTop: 4, lineHeight: 1.5 }}>{doc.ai_feedback}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Caja de mensaje al estudiante */}
          {student.client_user_id && (
            <div style={{ marginTop: 20, padding: "14px 16px", background: "var(--azure-light)", border: "1px solid #2563eb33", borderRadius: 8 }}>
              <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--accent)", marginBottom: 8, fontWeight: 600 }}>
                ✉️ Enviar mensaje al estudiante
              </div>
              <textarea
                value={teamComment}
                onChange={e => setTeamComment(e.target.value)}
                placeholder="Escribe un mensaje para el estudiante..."
                rows={3}
                style={{ width: "100%", padding: "8px 10px", background: "#fff", border: "1px solid var(--border)", borderRadius: 6, fontFamily: "var(--font)", fontSize: 13, color: "var(--text)", resize: "vertical", outline: "none" }}
              />
              <button
                onClick={sendTeamComment}
                disabled={sendingComment || !teamComment.trim()}
                className="save-btn"
                style={{ marginTop: 8, fontSize: 12 }}
              >
                {sendingComment ? "Enviando..." : "Enviar mensaje →"}
              </button>
              <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 6 }}>
                El estudiante recibirá este mensaje por email y podrá verlo en su portal.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC WEBSITE - Lead Capture & Program Browser
// ═══════════════════════════════════════════════════════════════════════════

// ─── PUBLIC API HELPERS ──────────────────────────────────────────────────
function getPublicHeaders() {
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
}
async function publicQuery(table, select = "*", filters = "") {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  if (filters) url += `&${filters}`;
  const res = await fetch(url, { headers: getPublicHeaders() });
  return res.json();
}

async function publicQueryAll(table, select, filters = "") {
  // Dos peticiones paralelas de 6000 (< max_rows) con offset para cubrir los 10135 programas
  const hasOrder = /(?:^|&)order=/.test(filters || "");
  const base = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${filters ? "&" + filters : ""}${hasOrder ? "" : "&order=id.asc"}`;
  const hdrs = getPublicHeaders();
  const half = (offset) =>
    fetch(`${base}&limit=6000&offset=${offset}`, { headers: hdrs })
      .then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => []);
  const [p1, p2] = await Promise.all([half(0), half(6000)]);
  return [...p1, ...p2];
}
async function publicInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...getPublicHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ─── MATCH ALGORITHM ─────────────────────────────────────────────────────
const AREAS_FORMULARIO = [
  { id: "negocios", label: "Negocios y Empresa", emoji: "💼", descripcion: "Administración, finanzas, marketing, comercio",
    familia_areas: ["Administración y Dirección de Empresas","Finanzas y Contabilidad","Marketing y Comunicación Empresarial","Recursos Humanos","Comercio Internacional y Logística","Fiscalidad y Tributación"] },
  { id: "tecnologia", label: "Tecnología e Informática", emoji: "💻", descripcion: "Programación, IA, datos, ciberseguridad, redes",
    familia_areas: ["Informática y Desarrollo de Software","Inteligencia Artificial y Datos","Ciberseguridad e Inteligencia Digital","Telecomunicaciones y Redes","Fotografía y Medios Digitales"] },
  { id: "ingenieria", label: "Ingeniería", emoji: "⚙️", descripcion: "Industrial, civil, química, eléctrica, mecánica",
    familia_areas: ["Ingeniería Industrial y Manufactura","Ingeniería Civil y Construcción","Ingeniería Química y de Materiales","Ingeniería Eléctrica y Electrónica","Energía y Medioambiente","Arquitectura y Diseño de Interiores"] },
  { id: "salud", label: "Salud y Ciencias de la Vida", emoji: "🩺", descripcion: "Medicina, enfermería, farmacia, fisioterapia",
    familia_areas: ["Medicina y Ciencias Clínicas","Enfermería y Cuidados","Farmacia y Nutrición","Fisioterapia y Rehabilitación","Odontología","Psicología y Salud Mental","Salud Pública y Epidemiología","Biotecnología y Biomedicina"] },
  { id: "ciencias", label: "Ciencias", emoji: "🔬", descripcion: "Biología, química, física, matemáticas, geología",
    familia_areas: ["Química y Física","Biología y Ciencias Naturales","Matemáticas y Estadística","Geología y Ciencias de la Tierra","Astronomía y Astrofísica","Ciencias del Mar y Acuicultura","Veterinaria y Ciencias Animales","Agricultura y Ciencias Agrarias"] },
  { id: "derecho", label: "Derecho y Ciencias Políticas", emoji: "⚖️", descripcion: "Derecho, política, relaciones internacionales",
    familia_areas: ["Derecho Civil y Privado","Derecho Público y Administrativo","Derecho Internacional"] },
  { id: "educacion", label: "Educación y Ciencias Sociales", emoji: "📚", descripcion: "Pedagogía, trabajo social, sociología, psicología",
    familia_areas: ["Educación y Pedagogía","Trabajo Social y Servicios Sociales","Sociología y Antropología","Filosofía y Ética","Geografía y Urbanismo"] },
  { id: "humanidades", label: "Humanidades e Idiomas", emoji: "🌍", descripcion: "Historia, lingüística, traducción, literatura",
    familia_areas: ["Historia y Patrimonio","Lingüística y Traducción"] },
  { id: "comunicacion", label: "Comunicación y Medios", emoji: "📡", descripcion: "Periodismo, publicidad, relaciones públicas",
    familia_areas: ["Periodismo y Comunicación","Publicidad y Relaciones Públicas","Cine y Producción Audiovisual","Gestión Cultural y Eventos"] },
  { id: "arte", label: "Arte y Diseño", emoji: "🎨", descripcion: "Diseño gráfico, bellas artes, moda, música",
    familia_areas: ["Artes Visuales y Diseño","Música y Artes Escénicas","Moda y Diseño Textil"] },
  { id: "turismo", label: "Turismo, Deporte y Gastronomía", emoji: "✈️", descripcion: "Hostelería, turismo, deporte, nutrición deportiva",
    familia_areas: ["Turismo y Hostelería","Deporte y Ciencias del Ejercicio","Gastronomía y Artes Culinarias"] },
];
const EDUCATION_TO_TIPO = {
  bachillerato: ["grado", "fp_superior"],
  fp_superior: ["grado"],
  grado: ["master"],
  master: ["doctorado"],
};
const CITIES_LIST = [
  "Madrid","Barcelona","Valencia","Sevilla","Málaga","Granada",
  "Bilbao","San Sebastián","Zaragoza","Salamanca","A Coruña",
  "Murcia","Alicante","Valladolid","Pamplona","Santander",
  "Oviedo","Palma de Mallorca","Vigo","Santiago de Compostela",
];
const TIPO_LABELS = { grado: "Grado", fp_superior: "FP Superior", master: "Máster", doctorado: "Doctorado" };

function computeMatches(programs, profile) {
  const familias = AREAS_FORMULARIO.find(a => a.id === profile.study_area)?.familia_areas || [];
  const tipos = EDUCATION_TO_TIPO[profile.education_level] || ["grado","master","doctorado","fp_superior"];
  const cities = profile.preferred_cities || [];
  const isNonEU = ['extracomunitario', 'convenio', 'latam_convenio'].includes(profile.student_origin);
  let candidates = programs.filter(p => {
    const areaMatch = familias.includes(p.familia_area);
    const tipoMatch = tipos.includes(p.tipo);
    const visaOk = !isNonEU || p.visa_eligible !== 'no_elegible';
    if (!areaMatch || !tipoMatch || !visaOk) return false;
    if (profile.budget === "bajo" && p.precio_anual_eur != null && p.precio_anual_eur > 5000) return false;
    if (profile.budget === "medio" && p.precio_anual_eur != null && p.precio_anual_eur > 12000) return false;
    return true;
  });
  const scored = candidates.map(p => ({ ...p, score: 10 + (cities.includes(p.ciudad) ? 30 : 5) + (p.activo ? 2 : 0) + (p.visa_eligible === 'elegible' ? 10 : 0) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 50);
}

// ─── PUBLIC CSS ──────────────────────────────────────────────────────────
const publicCss = `
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&family=Lora:ital,wght@0,400;0,500;1,400&family=Work+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
:root {
  /* Legacy aliases — keep for existing admin/form CSS */
  --pub-bg:#faf6f0; --pub-surface:#f0f4ff; --pub-border:#e2e8f0;
  --pub-primary:#2563eb; --pub-primary-hover:#1d4ed8; --pub-secondary:#e8531a;
  --pub-text:#0f172a; --pub-muted:#334155; --pub-light:#94a3b8;
  --pub-success:#16a34a; --pub-radius:12px;
  /* Brand tokens */
  --azure:#2563eb; --terracota:#e8531a; --salvia:#16a34a;
  --grafito:#0f172a; --grafito-s:#334155; --pizarra:#94a3b8;
  --linea:#e2e8f0; --pergamino:#faf6f0; --hielo:#f0f4ff; --blanco:#ffffff;
  /* Semantic */
  --ok:#16a34a; --rota:#dc2626; --generica:#f59e0b; --pendiente:#94a3b8;
  /* Spacing & layout */
  --max-width:1100px; --padding-x:clamp(20px,5vw,80px); --section-py:clamp(64px,10vw,120px);
  --card-radius:12px; --btn-radius:8px; --tag-radius:4px;
  /* Motion */
  --ease-out:cubic-bezier(0.0,0.0,0.2,1);
  --ease-in:cubic-bezier(0.4,0.0,1,1);
  --ease-inout:cubic-bezier(0.4,0.0,0.2,1);
  --spring:cubic-bezier(0.34,1.56,0.64,1);
  --dur-micro:80ms; --dur-short:180ms; --dur-medium:280ms; --dur-long:380ms; --dur-xl:500ms;
}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;}}
:focus-visible{outline:2px solid var(--azure);outline-offset:3px;border-radius:4px;}
.skip-link{position:absolute;top:-40px;left:0;background:var(--azure);color:#fff;padding:8px 16px;font-family:'Bricolage Grotesque',sans-serif;font-size:14px;z-index:999;border-radius:0 0 8px 0;transition:top .1s;}
.skip-link:focus{top:0;}
*{box-sizing:border-box;margin:0;padding:0;}
.pub-app{font-family:'Work Sans',system-ui,sans-serif;color:var(--pub-text);background:var(--pub-bg);min-height:100vh;display:flex;flex-direction:column;}

/* Nav */
.pub-nav{display:flex;align-items:center;justify-content:space-between;padding:0 var(--padding-x);height:64px;background:var(--blanco);border-bottom:1px solid var(--linea);position:sticky;top:0;z-index:100;transition:box-shadow var(--dur-short) var(--ease-out);}
.pub-nav-logo{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:20px;font-weight:700;color:var(--pub-primary);cursor:pointer;letter-spacing:-0.5px;}
.pub-nav-links{display:flex;gap:24px;align-items:center;}
.pub-nav-link{font-size:14px;font-weight:500;color:var(--pub-muted);text-decoration:none;cursor:pointer;padding:8px 0;border-bottom:2px solid transparent;transition:all .2s;}
.pub-nav-link:hover,.pub-nav-link.active{color:var(--pub-primary);border-bottom-color:var(--pub-primary);}
.pub-nav-link.admin{font-size:13px;color:var(--pub-light);background:var(--pub-surface);padding:6px 14px;border-radius:20px;border:1px solid var(--pub-border);}
.pub-nav-link.admin:hover{color:var(--pub-text);border-color:var(--pub-text);}

/* Hero */
.pub-hero{max-width:800px;margin:0 auto;padding:80px 24px 60px;text-align:center;}
.pub-hero h1{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:clamp(36px,5vw,56px);font-weight:700;line-height:1.05;margin-bottom:20px;color:var(--pub-text);letter-spacing:-0.02em;}
.pub-hero p{font-family:'Lora',Georgia,serif;font-size:18px;color:var(--pub-muted);max-width:560px;margin:0 auto 36px;line-height:1.7;}
.pub-hero-btns{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;}
.pub-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:13px 26px;border-radius:var(--btn-radius);font-size:15px;font-weight:600;cursor:pointer;transition:background var(--dur-micro) var(--ease-out),border-color var(--dur-micro) var(--ease-out),transform var(--dur-micro) var(--ease-out),box-shadow var(--dur-short) var(--ease-out);border:2px solid transparent;text-decoration:none;font-family:'Bricolage Grotesque',system-ui,sans-serif;white-space:nowrap;line-height:1;-webkit-font-smoothing:antialiased;}
.pub-btn:active{transform:translateY(1px)!important;}
.pub-btn-primary{background:var(--pub-primary);color:#fff;border-color:var(--pub-primary);}
.pub-btn-primary:hover{background:#1d4ed8;border-color:#1d4ed8;transform:translateY(-1px);box-shadow:0 4px 14px rgba(37,99,235,.30);}
.pub-btn-outline{background:transparent;color:var(--pub-primary);border-color:var(--pub-primary);}
.pub-btn-outline:hover{background:var(--pub-surface);}
.pub-btn-sm{padding:10px 20px;font-size:14px;}
.pub-btn:disabled{opacity:.5;cursor:not-allowed;transform:none !important;}

/* Features */
.pub-features{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px;max-width:960px;margin:0 auto;padding:0;}
.pub-feature{background:var(--pub-surface);border:1px solid var(--pub-border);border-radius:var(--pub-radius);padding:32px 24px;text-align:center;}
.pub-feature-icon{font-size:36px;margin-bottom:16px;}
.pub-feature h3{font-size:16px;font-weight:700;margin-bottom:8px;}
.pub-feature p{font-size:14px;color:var(--pub-muted);line-height:1.5;}

/* Stats */
.pub-stats{display:flex;justify-content:center;gap:60px;padding:40px 24px;background:var(--pub-surface);border-top:1px solid var(--pub-border);border-bottom:1px solid var(--pub-border);margin-bottom:60px;}
.pub-stat{text-align:center;}
.pub-stat-num{font-family:'IBM Plex Mono',monospace;font-size:clamp(32px,3.5vw,44px);font-weight:500;color:var(--pub-primary);}
.pub-stat-label{font-size:13px;color:var(--pub-muted);margin-top:4px;}

/* Footer */
.pub-footer{padding:40px 24px;text-align:center;color:var(--pub-light);font-size:13px;border-top:1px solid var(--pub-border);margin-top:auto;}

/* Form container */
.pub-container{max-width:700px;margin:0 auto;padding:40px 24px 80px;}
.pub-container-wide{max-width:1200px;margin:0 auto;padding:40px 24px 80px;}
.pub-card{background:#fff;border:1px solid var(--pub-border);border-radius:var(--pub-radius);padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.06);}
.pub-card h2{font-size:24px;font-weight:700;margin-bottom:8px;}
.pub-card h3{font-size:18px;font-weight:600;margin-bottom:12px;}
.pub-card-sub{color:var(--pub-muted);font-size:14px;margin-bottom:24px;}

/* Progress bar */
.pub-progress{display:flex;gap:8px;margin-bottom:32px;}
.pub-progress-step{flex:1;height:4px;border-radius:2px;background:var(--pub-border);transition:background .3s;}
.pub-progress-step.done{background:var(--pub-primary);}
.pub-progress-step.current{background:var(--pub-secondary);}

/* Radio / option cards */
.pub-options{display:grid;gap:12px;}
.pub-option{display:flex;align-items:center;gap:12px;padding:16px 20px;border:2px solid var(--pub-border);border-radius:var(--pub-radius);cursor:pointer;transition:all .2s;background:#fff;}
.pub-option:hover{border-color:var(--pub-primary);background:#eff6ff;}
.pub-option.selected{border-color:var(--pub-primary);background:#dbeafe;}
.pub-option-dot{width:20px;height:20px;border-radius:50%;border:2px solid var(--pub-border);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s;}
.pub-option.selected .pub-option-dot{border-color:var(--pub-primary);background:var(--pub-primary);}
.pub-option.selected .pub-option-dot::after{content:'';width:8px;height:8px;border-radius:50%;background:#fff;}
.pub-option-label{font-size:15px;font-weight:500;}
.pub-option-desc{font-size:13px;color:var(--pub-muted);}

/* Area cards (study area selection) */
.pub-area-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.pub-area-card{display:flex;flex-direction:column;align-items:center;gap:8px;padding:24px 16px;border:2px solid var(--pub-border);border-radius:var(--pub-radius);cursor:pointer;transition:all .2s;text-align:center;}
.pub-area-card:hover{border-color:var(--pub-primary);background:#eff6ff;}
.pub-area-card.selected{border-color:var(--pub-primary);background:#dbeafe;box-shadow:0 0 0 2px rgba(37,99,235,.15);}
.pub-area-card-icon{font-size:32px;}
.pub-area-card-name{font-size:14px;font-weight:600;line-height:1.3;}
.pub-area-card-desc{font-size:11px;color:var(--pub-muted);line-height:1.4;}

/* City checkboxes */
.pub-city-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.pub-city{display:flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid var(--pub-border);border-radius:8px;cursor:pointer;font-size:14px;transition:all .2s;}
.pub-city:hover{border-color:var(--pub-primary);}
.pub-city.selected{border-color:var(--pub-primary);background:#dbeafe;font-weight:600;}
.pub-city-check{width:18px;height:18px;border-radius:4px;border:2px solid var(--pub-border);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;transition:all .2s;}
.pub-city.selected .pub-city-check{background:var(--pub-primary);border-color:var(--pub-primary);color:#fff;}

/* Inputs */
.pub-input,.pub-select{width:100%;padding:12px 16px;border:1px solid var(--pub-border);border-radius:8px;font-size:15px;font-family:inherit;transition:border .2s;background:#fff;}
.pub-input:focus,.pub-select:focus{outline:none;border-color:var(--pub-primary);box-shadow:0 0 0 3px rgba(37,99,235,.1);}
.pub-label{display:block;font-size:13px;font-weight:600;color:var(--pub-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px;}
.pub-field{margin-bottom:20px;}

/* Form nav */
.pub-form-nav{display:flex;justify-content:space-between;margin-top:32px;padding-top:24px;border-top:1px solid var(--pub-border);}

/* Program cards grid */
.pub-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;align-items:start;}
.pub-program{background:var(--blanco);border:1.5px solid var(--linea);border-top:4px solid var(--azure);border-radius:var(--card-radius);padding:0;transition:border-color var(--dur-micro) var(--ease-out),box-shadow var(--dur-short) var(--ease-out);cursor:pointer;overflow:hidden;}
.pub-program.pub-tipo-master{border-top-color:var(--pub-secondary);}
.pub-program.pub-tipo-doctorado{border-top-color:#0f172a;}
.pub-program.pub-tipo-fp{border-top-color:var(--pub-success);}
.pub-program:hover{box-shadow:0 4px 12px rgba(0,0,0,.08);}
.pub-program.selected{border-color:var(--pub-primary);box-shadow:0 0 0 2px rgba(37,99,235,.15);}
.pub-program.open{box-shadow:0 4px 20px rgba(37,99,235,.14);}
/* Image header */
.pub-program-img{height:100px;display:flex;align-items:center;justify-content:center;position:relative;border-bottom:1px solid var(--pub-border);overflow:hidden;}
.pub-program-img-abbr{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:34px;font-weight:700;letter-spacing:-1.5px;opacity:.18;position:absolute;pointer-events:none;user-select:none;}
.pub-program-img-logo{max-height:60px;max-width:128px;object-fit:contain;position:relative;z-index:1;}
/* Card body */
.pub-program-body{padding:16px 18px 18px;}
.pub-program-meta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;}
.pub-badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;}
.pub-badge-tipo{background:#dbeafe;color:#1d4ed8;}
.pub-badge-tipo.master{background:#ede9fe;color:#6d28d9;}
.pub-badge-tipo.fp_superior{background:#d1fae5;color:#065f46;}
.pub-badge-tipo.doctorado{background:#fee2e2;color:#991b1b;}
.pub-badge-city{background:var(--hielo);color:var(--azure);}
.pub-badge-visa{background:#fef3c7;color:#92400e;}
.pub-badge-mod{background:#fef3c7;color:#92400e;}
.pub-program-name{font-family:'Work Sans',sans-serif;font-size:14px;font-weight:600;line-height:1.4;color:var(--pub-text);margin-bottom:12px;}
.pub-program-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.pub-program-price{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:500;color:var(--pub-primary);}
.pub-program-toggle{font-size:11px;color:var(--pub-light);font-weight:500;white-space:nowrap;flex-shrink:0;}
.pub-program-expanded{border-top:1px solid var(--pub-border);margin-top:14px;padding-top:14px;}
.pub-program-desc{font-size:13px;color:var(--pub-muted);line-height:1.6;margin-bottom:12px;}
.pub-program-area{display:inline-block;font-size:11px;font-weight:600;color:var(--pub-primary);background:#dbeafe;padding:2px 10px;border-radius:20px;margin-bottom:10px;}
.pub-program-details{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--pub-muted);margin-bottom:14px;}
.pub-program-institution{font-size:11px;color:var(--pub-light);margin-bottom:10px;}
.pub-program-actions{display:flex;gap:8px;flex-wrap:wrap;}
.pub-program-actions .pub-btn{flex:1;min-width:120px;justify-content:center;}
.pub-program-btn{flex:1;min-width:100px;padding:9px 12px;border:1px solid var(--pub-border);border-radius:8px;background:transparent;cursor:pointer;font-size:13px;font-weight:500;transition:all .2s;font-family:inherit;}
.pub-program-btn:hover{border-color:var(--pub-primary);color:var(--pub-primary);}
.pub-program-btn.selected{background:var(--pub-primary);color:#fff;border-color:var(--pub-primary);}

/* Filter bar */
.pub-filters{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;align-items:center;}
.pub-filters .pub-select{width:auto;min-width:160px;padding:10px 14px;font-size:14px;}
.pub-filters .pub-input{max-width:280px;padding:10px 14px;font-size:14px;}
.pub-selected-bar{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:#dbeafe;border-radius:var(--pub-radius);margin-bottom:24px;border:1px solid rgba(37,99,235,.2);}
.pub-selected-bar span{font-size:14px;font-weight:600;color:var(--pub-primary);}

/* Pagination */
.pub-pagination{display:flex;justify-content:center;gap:8px;margin-top:32px;}
.pub-page-btn{padding:8px 14px;border:1px solid var(--pub-border);border-radius:8px;background:#fff;cursor:pointer;font-size:14px;transition:all .2s;font-family:inherit;}
.pub-page-btn:hover{border-color:var(--pub-primary);}
.pub-page-btn.active{background:var(--pub-primary);color:#fff;border-color:var(--pub-primary);}

/* Modal */
.pub-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:24px;}
.pub-modal{background:#fff;border-radius:var(--pub-radius);padding:32px;max-width:500px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);}
.pub-modal h2{font-size:22px;font-weight:700;margin-bottom:8px;}
.pub-modal-close{position:absolute;top:16px;right:16px;background:none;border:none;font-size:20px;cursor:pointer;color:var(--pub-muted);}

/* Success */
.pub-success{text-align:center;padding:60px 24px;}
.pub-success-icon{font-size:64px;margin-bottom:16px;}
.pub-success h2{font-size:28px;font-weight:700;margin-bottom:12px;color:var(--pub-success);}
.pub-success p{font-size:16px;color:var(--pub-muted);max-width:400px;margin:0 auto 32px;line-height:1.6;}

/* Landing — Hero trust bar */
.pub-hero-eyebrow{margin-bottom:20px;}
.pub-hero-trust{display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:24px;font-size:13px;color:var(--pub-muted);font-family:'IBM Plex Mono',monospace;}
.pub-trust-dot{color:var(--pub-border);}

/* Landing — Sections */
.pub-section{max-width:var(--max-width);margin:0 auto 72px;padding:0 var(--padding-x);}
.pub-section-label{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:12px;font-weight:600;color:var(--pub-primary);letter-spacing:0.04em;margin-bottom:10px;}
.pub-section h2{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:clamp(24px,3.5vw,36px);font-weight:600;color:var(--pub-text);margin-bottom:10px;line-height:1.2;}
.pub-section-sub{font-family:'Lora',Georgia,serif;font-size:16px;color:var(--pub-muted);margin-bottom:40px;line-height:1.7;max-width:560px;}

/* Landing — How it works */
.pub-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:40px;}
.pub-step-num{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:72px;font-weight:700;color:var(--pizarra);line-height:1;margin-bottom:8px;display:block;}
.pub-step h3{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:18px;font-weight:600;margin-bottom:8px;}
.pub-step p{font-family:'Lora',Georgia,serif;font-size:15px;color:var(--pub-muted);line-height:1.7;}

/* Landing — For whom */
.pub-audience{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
.pub-audience-card{background:#fff;border:1px solid var(--pub-border);border-radius:var(--pub-radius);padding:28px 24px;}
.pub-audience-card-icon{font-size:28px;margin-bottom:14px;}
.pub-audience-card h3{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:16px;font-weight:700;margin-bottom:8px;}
.pub-audience-card p{font-family:'Lora',Georgia,serif;font-size:14px;color:var(--pub-muted);line-height:1.7;}
.pub-audience-icon{width:32px;height:32px;color:var(--pub-primary);margin-bottom:14px;}

/* Landing — Section wrappers for full-width background stripes */
.pub-section-white{background:#ffffff;padding:72px 0;margin-bottom:0;}
.pub-section-ice{background:var(--pub-surface);padding:72px 0;margin-bottom:0;}
.pub-section-white .pub-section,.pub-section-ice .pub-section{margin-bottom:0;}

/* Landing — Study type cards */
.pub-tipos-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;}
.pub-tipo-card{background:#fff;border:1px solid var(--pub-border);border-radius:12px;padding:24px 20px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;min-height:260px;}
.pub-tipo-card-body{flex:1;display:flex;flex-direction:column;gap:8px;}
.pub-tipo-card h3{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:15px;font-weight:600;color:var(--pub-text);margin:0;}
.pub-tipo-card p{font-family:'Lora',Georgia,serif;font-size:13px;color:var(--pub-muted);line-height:1.65;margin:0;}
.pub-tipo-btn{margin-top:auto;font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:13px;font-weight:600;color:var(--pub-primary);border:1.5px solid var(--pub-primary);background:transparent;padding:8px 16px;border-radius:6px;cursor:pointer;transition:background .15s ease;}
.pub-tipo-btn:hover{background:var(--pub-surface);}

/* Landing — FAQ accordion */
.pub-faq{border-top:1px solid var(--pub-border);}
.pub-faq-item{border-bottom:1px solid var(--pub-border);}
.pub-faq-question{width:100%;text-align:left;padding:20px 0;display:flex;justify-content:space-between;align-items:center;cursor:pointer;font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:16px;font-weight:600;color:var(--pub-text);background:none;border:none;}
.pub-faq-icon{font-size:22px;color:var(--pub-primary);transition:transform .2s ease;flex-shrink:0;margin-left:16px;line-height:1;}
.pub-faq-item.open .pub-faq-icon{transform:rotate(45deg);}
.pub-faq-answer{max-height:0;overflow:hidden;transition:max-height var(--dur-medium) var(--ease-inout);}
.pub-faq-item.open .pub-faq-answer{max-height:600px;}
.pub-faq-answer-inner{padding:0 0 20px;font-family:'Lora',Georgia,serif;font-size:15px;line-height:1.75;color:var(--pub-muted);}

/* Landing — CTA banner */
.pub-cta-banner{background:var(--pub-primary);padding:clamp(64px,10vw,96px) 24px;text-align:center;}
.pub-cta-banner h2{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:clamp(28px,4vw,36px);font-weight:600;color:#fff;margin-bottom:14px;}
.pub-cta-banner p{font-family:'Lora',Georgia,serif;font-size:17px;color:rgba(255,255,255,.8);margin-bottom:36px;max-width:460px;margin-left:auto;margin-right:auto;line-height:1.6;}
.pub-cta-banner .pub-btn-primary{background:#fff;color:var(--pub-primary);border-color:#fff;}
.pub-cta-banner .pub-btn-primary:hover{background:#eff6ff;box-shadow:none;transform:none;}
.pub-cta-banner .pub-btn-outline{border-color:rgba(255,255,255,.5);color:#fff;}
.pub-cta-banner .pub-btn-outline:hover{background:rgba(255,255,255,.15);}

/* Nav scroll shadow */
.pub-nav.scrolled{box-shadow:0 1px 16px rgba(15,23,42,.06);border-bottom-color:transparent;}

/* CTA banner button variants */
.pub-cta-banner .pub-btn-primary{background:#fff;color:var(--pub-primary);border-color:#fff;font-family:'Bricolage Grotesque',system-ui,sans-serif;font-weight:600;}
.pub-cta-banner .pub-btn-primary:hover{opacity:.92;background:#fff;box-shadow:none;transform:none;}
.pub-cta-banner .pub-btn-outline{background:transparent;color:#fff;border-color:rgba(255,255,255,.6);font-family:'Bricolage Grotesque',system-ui,sans-serif;font-weight:600;}
.pub-cta-banner .pub-btn-outline:hover{border-color:#fff;background:rgba(255,255,255,.08);}

/* Card heading */
.pub-card h2{font-family:'Bricolage Grotesque',system-ui,sans-serif;}

/* Footer */
.pub-footer{padding:40px 24px;text-align:center;border-top:1px solid var(--pub-border);margin-top:auto;}
.pub-footer-main{font-family:'Lora',Georgia,serif;font-size:14px;color:var(--pub-light);margin-bottom:8px;}
.pub-footer-links{display:flex;justify-content:center;gap:20px;flex-wrap:wrap;margin-bottom:16px;}
.pub-footer-link{font-family:'Work Sans',sans-serif;font-size:13px;color:var(--pub-light);text-decoration:none;cursor:pointer;}
.pub-footer-link:hover{color:var(--pub-primary);}
.pub-footer-geo{font-family:'Lora',Georgia,serif;font-size:12px;color:var(--pub-light);max-width:640px;margin:8px auto 0;line-height:1.6;border-top:1px solid var(--pub-border);padding-top:16px;}

/* Form step indicator */
.pub-step-indicator{display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:32px;}
.pub-step-dot{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;transition:all .3s;flex-shrink:0;border:2px solid var(--pub-border);color:var(--pub-light);background:#fff;}
.pub-step-dot.done{background:var(--pub-primary);border-color:var(--pub-primary);color:#fff;}
.pub-step-dot.current{background:var(--pub-primary);border-color:var(--pub-primary);color:#fff;box-shadow:0 0 0 4px rgba(37,99,235,.15);}
.pub-step-line{flex:1;height:2px;background:var(--pub-border);transition:background .3s;max-width:28px;}
.pub-step-line.done{background:var(--pub-primary);}

/* ── Explorer layout ── */
.pub-explorer-layout{display:grid;grid-template-columns:1fr;min-height:calc(100vh - 64px);background:var(--blanco);}
.pub-explorer-layout.drawer-open{grid-template-columns:55% 45%;}
.pub-cards-panel{display:flex;flex-direction:column;height:calc(100vh - 64px);position:sticky;top:64px;overflow:hidden;background:var(--blanco);}
.pub-explorer-layout.drawer-open .pub-cards-panel{border-right:1px solid var(--linea);}
.pub-cards-scroll{flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--linea) transparent;}
.pub-filters-bar{display:flex;gap:8px;flex-wrap:wrap;padding:16px var(--padding-x);border-bottom:1px solid var(--linea);background:var(--blanco);flex-shrink:0;}
.pub-filter-search,.pub-filter-select{font-size:13px;padding:9px 14px;border:1.5px solid var(--linea);border-radius:8px;background:var(--blanco);color:var(--grafito-s);transition:border-color var(--dur-micro) var(--ease-out);}
.pub-filter-search{font-family:'Lora',serif;min-width:180px;}
.pub-filter-search:focus,.pub-filter-select:focus{outline:none;border-color:var(--azure);}
.pub-filter-select{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-weight:500;cursor:pointer;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' stroke='%2394A3B8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:30px;}
.pub-compact-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:20px 0;}
/* Compact program card */
.pub-card-compact{background:var(--blanco);border:1.5px solid var(--linea);border-radius:var(--card-radius);overflow:hidden;cursor:pointer;transition:border-color var(--dur-micro) var(--ease-out),box-shadow var(--dur-short) var(--ease-out);}
.pub-card-compact:hover{border-color:var(--azure);box-shadow:0 2px 12px rgba(37,99,235,.08);}
.pub-card-compact.selected{border-color:var(--azure);border-width:2px;background:var(--hielo);box-shadow:0 2px 12px rgba(37,99,235,.12);}
.pub-card-compact-img{height:140px;position:relative;overflow:hidden;flex-shrink:0;}
.pub-card-compact-img .area-img{width:100%;height:100%;object-fit:cover;display:block;transition:transform var(--dur-medium) var(--ease-out);}
.pub-card-compact:hover .area-img{transform:scale(1.04);}
.pub-card-compact-img .logo-badge{position:absolute;bottom:8px;right:8px;height:22px;max-width:64px;object-fit:contain;background:rgba(255,255,255,.92);border-radius:4px;padding:2px 6px;box-shadow:0 1px 4px rgba(0,0,0,.12);}
.pub-card-compact-body{padding:12px 14px 14px;}
.pub-card-compact-tags{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;}
.pub-card-compact-title{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:13px;font-weight:600;color:var(--grafito);line-height:1.35;margin-bottom:6px;}
.pub-card-compact-price{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:500;color:var(--azure);}
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
.qe-btn-ver:hover{background:#1d4ed8;}
/* Drawer desktop */
.pub-drawer-desktop{display:flex;flex-direction:column;height:calc(100vh - 64px);position:sticky;top:64px;overflow:hidden;background:var(--blanco);}
.pub-drawer-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:12px;color:var(--pizarra);padding:40px;text-align:center;}
.pub-drawer-empty-icon{font-family:'IBM Plex Mono',monospace;font-size:28px;opacity:.25;letter-spacing:.1em;}
.pub-drawer-empty-text{font-family:'Lora',serif;font-size:14px;color:var(--pizarra);max-width:200px;line-height:1.55;}
.pub-drawer-content{display:flex;flex-direction:column;height:100%;animation:drawerIn var(--dur-medium) var(--ease-out);}
@keyframes drawerIn{from{opacity:0;transform:translateX(12px);}to{opacity:1;transform:translateX(0);}}
.pub-drawer-header{display:flex;justify-content:flex-end;padding:10px 14px 0;flex-shrink:0;}
.pub-drawer-close{width:32px;height:32px;border-radius:6px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background var(--dur-micro) var(--ease-out);}
.pub-drawer-close:hover{background:#f1f5f9;}
.pub-drawer-close:hover path{stroke:var(--grafito-s);}
.pub-drawer-img{width:100%;height:180px;flex-shrink:0;position:relative;overflow:hidden;}
.pub-drawer-img .area-img{width:100%;height:100%;object-fit:cover;display:block;}
.pub-drawer-img .logo-badge{position:absolute;bottom:12px;right:12px;height:26px;max-width:80px;object-fit:contain;background:rgba(255,255,255,.92);border-radius:5px;padding:3px 8px;box-shadow:0 1px 6px rgba(0,0,0,.15);}
.pub-drawer-body{padding:20px 24px;flex:1;overflow-y:auto;scrollbar-width:thin;scrollbar-color:var(--linea) transparent;}
.pub-drawer-section-title{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:10px;font-weight:700;color:var(--azure);text-transform:uppercase;letter-spacing:.1em;margin:16px 0 8px;}
.pub-drawer-title{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:15px;font-weight:700;color:var(--grafito);line-height:1.35;margin-bottom:4px;}
.pub-drawer-univ{font-family:'Lora',serif;font-size:12px;color:var(--pizarra);margin-bottom:8px;}
.pub-drawer-desc{font-family:'Lora',serif;font-size:13px;line-height:1.65;color:var(--grafito-s);margin-bottom:14px;}
.pub-drawer-data-row{display:flex;justify-content:space-between;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--linea);gap:8px;}
.pub-drawer-data-row:last-child{border-bottom:none;}
.pub-drawer-data-label{font-family:'Lora',serif;font-size:12px;color:var(--grafito-s);}
.pub-drawer-data-value{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:500;color:var(--azure);white-space:nowrap;}
.pub-drawer-footer{padding:14px 20px;border-top:1px solid var(--linea);display:flex;gap:10px;flex-shrink:0;background:var(--blanco);}
.pub-btn-oficial{flex:1;background:var(--azure);color:#fff;font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:13px;font-weight:600;padding:11px 16px;border-radius:var(--btn-radius);border:none;cursor:pointer;text-align:center;text-decoration:none;display:flex;align-items:center;justify-content:center;transition:background var(--dur-micro) var(--ease-out),transform var(--dur-micro);}
.pub-btn-oficial:hover{background:#1d4ed8;transform:translateY(-1px);}
.pub-btn-guardar{background:transparent;color:var(--azure);font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:13px;font-weight:600;padding:11px 16px;border-radius:var(--btn-radius);border:1.5px solid var(--azure);cursor:pointer;white-space:nowrap;transition:background var(--dur-micro) var(--ease-out);}
.pub-btn-guardar:hover{background:var(--hielo);}
.pub-btn-guardar.saved{background:var(--salvia);color:#fff;border-color:var(--salvia);}
/* Bottom sheet (mobile) */
.pub-bs-overlay{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:199;opacity:0;pointer-events:none;transition:opacity var(--dur-medium) var(--ease-out);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);}
.pub-bs-overlay.visible{opacity:1;pointer-events:all;}
.pub-bottom-sheet{position:fixed;bottom:0;left:0;right:0;background:var(--blanco);border-radius:18px 18px 0 0;box-shadow:0 -8px 40px rgba(15,23,42,.14);transform:translateY(100%);transition:transform var(--dur-long) var(--spring);display:flex;flex-direction:column;max-height:87dvh;z-index:200;will-change:transform;}
.pub-bottom-sheet.open{transform:translateY(0);}
.pub-bs-handle{width:40px;height:4px;background:var(--linea);border-radius:2px;margin:12px auto 6px;flex-shrink:0;}
.pub-bs-body{padding:0 18px;overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch;scrollbar-width:none;}
.pub-bs-body::-webkit-scrollbar{display:none;}
.pub-bs-footer{padding:12px 18px max(18px,env(safe-area-inset-bottom));display:flex;gap:8px;border-top:1px solid var(--linea);flex-shrink:0;background:var(--blanco);}

/* Responsive */
@media(max-width:768px){
  .pub-features{grid-template-columns:1fr 1fr;}
  .pub-tipos-grid{grid-template-columns:repeat(2,1fr);}
  .pub-stats{flex-direction:column;gap:24px;}
  .pub-explorer-layout.drawer-open{grid-template-columns:1fr;}
  .pub-drawer-desktop{display:none;}
  .pub-compact-grid{grid-template-columns:repeat(2,1fr);}
  .pub-cards-panel{height:auto;position:static;}
  .pub-cards-scroll{overflow-y:visible;}
  .pub-steps{grid-template-columns:1fr;}
  .pub-audience{grid-template-columns:1fr;}
  .pub-grid{grid-template-columns:repeat(2,1fr);}
  .pub-area-grid{grid-template-columns:repeat(2,1fr);}
  .pub-city-grid{grid-template-columns:repeat(2,1fr);}
  .pub-filters{flex-direction:column;}
  .pub-filters .pub-select,.pub-filters .pub-input{width:100%;max-width:none;}
  .pub-nav{padding:0 16px;}
  .pub-nav-links{gap:12px;}
}
@media(max-width:480px){
  .pub-hero{padding:48px 16px 40px;}
  .pub-hero h1{font-size:26px;}
  .pub-hero-btns{flex-direction:column;}
  .pub-btn{width:100%;}
  .pub-grid{grid-template-columns:1fr;}
  .pub-tipos-grid{grid-template-columns:1fr;}
  .pub-area-grid{grid-template-columns:1fr;}
  .pub-city-grid{grid-template-columns:1fr 1fr;}
  .pub-container{padding:24px 16px 60px;}
}
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
`;

// ─── PUBLIC COMPONENTS ───────────────────────────────────────────────────

function PublicNav({ route }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);
  return (
    <nav className={`pub-nav${scrolled ? " scrolled" : ""}`}>
      <div className="pub-nav-logo" onClick={() => navigate("/")}>QueEstudiar</div>
      <div className="pub-nav-links">
        <span className={`pub-nav-link ${route?.startsWith("/match") || route?.startsWith("#/match") ? "active" : ""}`} onClick={() => navigate("/match")}>Test vocacional</span>
        <button className="pub-btn pub-btn-outline" style={{ padding: "8px 18px", fontSize: 14 }} onClick={() => navigate("/programas")}>Explorar programas →</button>
        {!IS_PUBLIC_DOMAIN && <span className="pub-nav-link admin" onClick={() => location.hash = "#/admin"}>Acceso equipo</span>}
      </div>
    </nav>
  );
}

function FaqItem({ q, a, open, onToggle, id }) {
  return (
    <div className={`pub-faq-item${open ? " open" : ""}`}>
      <button className="pub-faq-question" onClick={onToggle}
        aria-expanded={open} aria-controls={`faq-answer-${id}`}>
        <span>{q}</span>
        <span className="pub-faq-icon" aria-hidden="true">+</span>
      </button>
      <div id={`faq-answer-${id}`} className="pub-faq-answer" role="region">
        <div className="pub-faq-answer-inner">{a}</div>
      </div>
    </div>
  );
}

const IcoEU = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="40" height="40" rx="10" fill="#EFF6FF"/>
    <circle cx="20" cy="13" r="5" stroke="#2563EB" strokeWidth="1.8"/>
    <path d="M20 9l1 3h3l-2.5 1.8 1 3L20 15l-2.5 1.8 1-3L16 12h3l1-3z" fill="#2563EB"/>
    <path d="M11 28c0-5 4.03-9 9-9s9 4 9 9" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round"/>
  </svg>
);
const IcoLatam = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="40" height="40" rx="10" fill="#EFF6FF"/>
    <circle cx="20" cy="20" r="8" stroke="#2563EB" strokeWidth="1.8"/>
    <path d="M12 20h16M20 12c-3 2.5-5 5-5 8s2 5.5 5 8M20 12c3 2.5 5 5 5 8s-2 5.5-5 8" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IcoPassport = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="40" height="40" rx="10" fill="#EFF6FF"/>
    <rect x="12" y="10" width="16" height="20" rx="2.5" stroke="#2563EB" strokeWidth="1.8"/>
    <circle cx="20" cy="17" r="3" stroke="#2563EB" strokeWidth="1.5"/>
    <path d="M15 24h10M15 27h6" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const FAQS = [
  { q: "¿Puedo estudiar en España si soy extranjero?", a: "Sí. España recibe cada año más de 170.000 estudiantes internacionales. Si eres ciudadano de la UE no necesitas visado. Si vienes de fuera de la UE, necesitarás solicitar un visado de estudiante antes de matricularte." },
  { q: "¿Cuánto cuesta estudiar en España?", a: "Depende del tipo de programa y la universidad. Un grado en universidad pública para residentes UE ronda los 800–2.000 €/año. Los másteres y programas privados pueden ir de 3.000 € a más de 15.000 €/año. Los estudiantes extracomunitarios pagan tasas superiores en universidades públicas." },
  { q: "¿Qué diferencia hay entre grado, máster, FP y doctorado?", a: "El grado es la titulación universitaria básica (4 años). El máster es una especialización de posgrado (1–2 años). La FP Superior es formación profesional intensiva (2 años), muy práctica. El doctorado es el nivel máximo, orientado a la investigación." },
  { q: "¿Cómo funciona el test vocacional?", a: "Respondes 5 preguntas sobre tu perfil: país de origen, nivel educativo actual, áreas de interés, ciudad preferida y presupuesto. El sistema cruza tu perfil con los 10.135 programas disponibles y te muestra los que mejor encajan. Tarda menos de 5 minutos." },
  { q: "¿Necesito homologar mi título para estudiar en España?", a: "Depende del programa. Para grados universitarios, los ciudadanos no UE generalmente necesitan homologar su título de bachillerato o pasar una prueba equivalente (PCE/UNED). Para másteres, el proceso de admisión lo gestiona cada universidad. QueEstudiar incluye los requisitos específicos de admisión en cada programa." },
  { q: "¿En qué ciudades hay programas disponibles?", a: "Cubrimos 28 ciudades españolas. Las más demandadas son Madrid, Barcelona, Valencia, Sevilla, Bilbao, Málaga, Zaragoza y Granada. Puedes filtrar por ciudad en el explorador de programas." },
];

function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null);
  const toggleFaq = (i) => setOpenFaq(prev => prev === i ? null : i);
  return (
    <>
      {/* HERO */}
      <div className="pub-hero">
        <h1>Encuentra tu programa<br/>académico en España.</h1>
        <p>Más de 10.000 programas en universidades y centros de FP.<br/>Filtra por lo que ya tienes y lo que quieres estudiar.</p>
        <div className="pub-hero-btns">
          <button className="pub-btn pub-btn-primary" onClick={() => navigate("/match")}>Hacer el test →</button>
          <button className="pub-btn pub-btn-outline" onClick={() => navigate("/programas")}>Ver todos los programas</button>
        </div>
        <div className="pub-hero-trust">
          <span>10.135 programas</span>
          <span className="pub-trust-dot">·</span>
          <span>28 ciudades</span>
          <span className="pub-trust-dot">·</span>
          <span>Grados · Másteres · FP · Doctorado</span>
        </div>
      </div>

      {/* STATS */}
      <div className="pub-stats">
        <div className="pub-stat"><div className="pub-stat-num">10.135</div><div className="pub-stat-label">Programas disponibles</div></div>
        <div className="pub-stat"><div className="pub-stat-num">28</div><div className="pub-stat-label">Ciudades en España</div></div>
        <div className="pub-stat"><div className="pub-stat-num">4</div><div className="pub-stat-label">Tipos de titulación</div></div>
        <div className="pub-stat"><div className="pub-stat-num">97</div><div className="pub-stat-label">Universidades acreditadas</div></div>
      </div>

      {/* HOW IT WORKS */}
      <div className="pub-section" style={{ paddingTop: 16 }}>
        <div className="pub-section-label">Cómo funciona</div>
        <h2>De la duda al programa, en tres pasos.</h2>
        <p className="pub-section-sub">No necesitas saber qué quieres estudiar. QueEstudiar te ayuda a descubrirlo.</p>
        <div className="pub-steps">
          <div className="pub-step">
            <div className="pub-step-num">01</div>
            <h3>Cuéntanos tu perfil</h3>
            <p>Responde 5 preguntas: de dónde vienes, qué nivel de estudios tienes, qué áreas te interesan y qué ciudad prefieres. Son menos de 5 minutos.</p>
          </div>
          <div className="pub-step">
            <div className="pub-step-num">02</div>
            <h3>Descubre tus matches</h3>
            <p>El sistema analiza los 10.135 programas disponibles y te muestra los que mejor encajan con tu perfil, nivel educativo y objetivos.</p>
          </div>
          <div className="pub-step">
            <div className="pub-step-num">03</div>
            <h3>Aplica con la información correcta</h3>
            <p>Cada programa incluye los requisitos de admisión, plazos, costes y documentación necesaria según tu origen académico.</p>
          </div>
        </div>
      </div>

      {/* FOR WHOM */}
      <div className="pub-section-white">
        <div className="pub-section">
          <div className="pub-section-label">¿Para quién?</div>
          <h2>Diseñado para estudiantes de todo el mundo.</h2>
          <p className="pub-section-sub">España recibe más de 170.000 estudiantes internacionales cada año. Es el tercer destino universitario de Europa.</p>
          <div className="pub-audience">
            <div className="pub-audience-card">
              <IcoEU />
              <h3>Estudiantes europeos</h3>
              <p>Mismas condiciones que un estudiante español: mismos precios de matrícula, sin restricciones de visado. España ofrece calidad universitaria al mejor precio de Europa Occidental.</p>
            </div>
            <div className="pub-audience-card">
              <IcoLatam />
              <h3>Latinoamérica con convenio</h3>
              <p>Colombia, México, Argentina, Chile y otros países tienen convenios de reconocimiento de títulos con España, lo que facilita el acceso y simplifica los trámites de admisión.</p>
            </div>
            <div className="pub-audience-card">
              <IcoPassport />
              <h3>Resto del mundo</h3>
              <p>Con visado de estudiante puedes estudiar en España. Te orientamos sobre requisitos de admisión, homologación de notas y gestión del visado paso a paso.</p>
            </div>
          </div>
        </div>
      </div>

      {/* STUDY TYPES */}
      <div className="pub-section-ice">
        <div className="pub-section">
          <div className="pub-section-label">Tipos de estudio</div>
          <h2>Desde FP hasta Doctorado, todo en un lugar.</h2>
          <p className="pub-section-sub">QueEstudiar cubre todos los niveles del sistema educativo español.</p>
          <div className="pub-tipos-grid">
            <div className="pub-tipo-card">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect width="40" height="40" rx="10" fill="#EFF6FF"/>
                <path d="M20 11l13 6.5-13 6.5-13-6.5L20 11z" stroke="#2563EB" strokeWidth="1.8" strokeLinejoin="round" fill="none"/>
                <path d="M13 21v7s3.5 3 7 3 7-3 7-3v-7" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M33 17.5v6" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <div className="pub-tipo-card-body">
                <h3>Grado universitario</h3>
                <p>Titulación oficial de 4 años (240 ECTS). Acceso desde bachillerato o equivalente. Más de 3.400 programas disponibles.</p>
              </div>
              <button className="pub-tipo-btn" onClick={() => { sessionStorage.setItem("filterTipo","grado"); navigate("/programas"); }}>Ver grados →</button>
            </div>
            <div className="pub-tipo-card">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect width="40" height="40" rx="10" fill="#EFF6FF"/>
                <rect x="12" y="10" width="16" height="20" rx="2" stroke="#2563EB" strokeWidth="1.8"/>
                <path d="M16 17h8M16 21h8M16 25h5" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M25 8l2 2" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <div className="pub-tipo-card-body">
                <h3>Máster universitario</h3>
                <p>Especialización de posgrado (1–2 años). Para profundizar en un campo o cambiar de sector. Más de 5.000 másteres disponibles.</p>
              </div>
              <button className="pub-tipo-btn" onClick={() => { sessionStorage.setItem("filterTipo","master"); navigate("/programas"); }}>Ver másteres →</button>
            </div>
            <div className="pub-tipo-card">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect width="40" height="40" rx="10" fill="#EFF6FF"/>
                <circle cx="20" cy="20" r="7" stroke="#2563EB" strokeWidth="1.8"/>
                <path d="M20 16v4l2.5 2.5" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M20 11V9M27 13l1.5-1.5M29 20h2M27 27l1.5 1.5M20 29v2M13 27l-1.5 1.5M11 20H9M13 13l-1.5-1.5" stroke="#2563EB" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <div className="pub-tipo-card-body">
                <h3>Doctorado</h3>
                <p>El nivel académico más alto. Orientado a la investigación científica. Acceso con máster universitario o equivalente.</p>
              </div>
              <button className="pub-tipo-btn" onClick={() => { sessionStorage.setItem("filterTipo","doctorado"); navigate("/programas"); }}>Ver doctorados →</button>
            </div>
            <div className="pub-tipo-card">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect width="40" height="40" rx="10" fill="#EFF6FF"/>
                <rect x="10" y="15" width="20" height="14" rx="2" stroke="#2563EB" strokeWidth="1.8"/>
                <path d="M15 15v-3h10v3" stroke="#2563EB" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M14 22h5M14 25h8" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="24" cy="23" r="2.5" fill="#2563EB"/>
              </svg>
              <div className="pub-tipo-card-body">
                <h3>FP Superior</h3>
                <p>Formación Profesional de Grado Superior (2 años). Muy demandada por empresas, con alta tasa de inserción laboral.</p>
              </div>
              <button className="pub-tipo-btn" onClick={() => { sessionStorage.setItem("filterTipo","fp_superior"); navigate("/programas"); }}>Ver FP Superior →</button>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="pub-section">
        <div className="pub-section-label">Preguntas frecuentes</div>
        <h2>Lo que más nos preguntan.</h2>
        <div className="pub-faq">
          {FAQS.map((f, i) => <FaqItem key={i} id={i} q={f.q} a={f.a} open={openFaq === i} onToggle={() => toggleFaq(i)} />)}
        </div>
      </div>

      {/* CTA BANNER */}
      <div className="pub-cta-banner">
        <h2>El programa que buscas está aquí.</h2>
        <p>10.135 programas. Filtra por tu perfil y encuentra el que encaja en menos de 5 minutos.</p>
        <div className="pub-hero-btns">
          <button className="pub-btn pub-btn-primary" onClick={() => navigate("/match")}>Hacer el test →</button>
          <button className="pub-btn pub-btn-outline" onClick={() => navigate("/programas")}>Explorar programas</button>
        </div>
      </div>
    </>
  );
}

const TIPO_DESC = {
  grado: "Titulación universitaria oficial de 4 años. Formación integral que combina bases teóricas y aplicación práctica para el ejercicio profesional cualificado.",
  master: "Posgrado universitario oficial. Especialización avanzada orientada al desarrollo profesional o la investigación en el campo de conocimiento seleccionado.",
  doctorado: "Programa de doctorado. El máximo nivel académico universitario, orientado a la investigación científica y la producción de conocimiento original.",
  fp_superior: "Ciclo Formativo de Grado Superior. Formación profesional intensiva con fuerte componente práctico y módulo de formación en empresa (FCT) incluido.",
};

const TIPO_IMG_BG = {
  grado: "linear-gradient(135deg,#dbeafe,#eff6ff)",
  master: "linear-gradient(135deg,#fde8df,#fff7f5)",
  doctorado: "linear-gradient(135deg,#e2e8f0,#f8fafc)",
  fp_superior: "linear-gradient(135deg,#dcfce7,#f0fdf4)",
};

function ProgramCard({ program: p, onSelect, selected }) {
  const [open, setOpen] = useState(false);
  const [logoErr, setLogoErr] = useState(false);

  const fmtPrice = (v) => v === 0 ? "Gratuito" : `${Number(v).toLocaleString("es-ES")} €/año`;
  const precioEU = p.precio_anual_eur != null ? fmtPrice(p.precio_anual_eur) : "Consultar precio";
  const hasIntl = p.precio_extracomunitario_eur != null && p.precio_extracomunitario_eur !== p.precio_anual_eur;
  const precioIntl = hasIntl ? fmtPrice(p.precio_extracomunitario_eur) : null;

  const domain = p.url_detalle ? (() => { try { return new URL(p.url_detalle).hostname.replace(/^www\./, ""); } catch { return null; } })() : null;
  const domainAbbr = domain ? domain.split(".")[0].toUpperCase().slice(0, 5) : (p.nombre ? p.nombre.slice(0, 3).toUpperCase() : "?");
  const tipoClass = p.tipo === "master" ? "pub-tipo-master" : p.tipo === "doctorado" ? "pub-tipo-doctorado" : p.tipo === "fp_superior" ? "pub-tipo-fp" : "";
  const imgBg = TIPO_IMG_BG[p.tipo] || TIPO_IMG_BG.grado;
  const abbrColor = p.tipo === "master" ? "#e8531a" : p.tipo === "doctorado" ? "#0f172a" : p.tipo === "fp_superior" ? "#16a34a" : "#2563eb";
  const desc = TIPO_DESC[p.tipo] || "";
  const descArea = p.familia_area ? ` Área: ${p.familia_area}.` : "";

  return (
    <div className={`pub-program ${tipoClass} ${selected ? "selected" : ""} ${open ? "open" : ""}`}
      onClick={() => setOpen(o => !o)}>

      {/* Image header: gradient bg + domain abbr watermark + Clearbit logo */}
      <div className="pub-program-img" style={{ background: imgBg }}>
        <span className="pub-program-img-abbr" style={{ color: abbrColor }}>{domainAbbr}</span>
        {domain && !logoErr && (
          <img className="pub-program-img-logo" src={`https://logo.clearbit.com/${domain}`}
            alt="" onError={() => setLogoErr(true)} />
        )}
      </div>

      {/* Card body */}
      <div className="pub-program-body">
        <div className="pub-program-meta">
          <span className="pub-badge pub-badge-tipo">{TIPO_LABELS[p.tipo] || p.tipo}</span>
          {p.ciudad && <span className="pub-badge pub-badge-city">{p.ciudad}</span>}
          <VisaBadge horas={p.horas_semanales} />
        </div>
        <div className="pub-program-name">{p.nombre}</div>
        <div className="pub-program-footer">
          <span className="pub-program-price">{precioEU}{hasIntl ? <span style={{ fontSize: 10, fontFamily: "Work Sans", color: "var(--pub-light)", marginLeft: 4 }}>· v. intl.</span> : null}</span>
          <span className="pub-program-toggle">{open ? "Cerrar ↑" : "Ver más ↓"}</span>
        </div>

        {open && (
          <div className="pub-program-expanded" onClick={e => e.stopPropagation()}>
            <p className="pub-program-desc">{desc}{descArea}</p>
            {domain && <div className="pub-program-institution">{domain}</div>}
            {hasIntl && (
              <div className="pub-program-details" style={{ marginBottom: 10 }}>
                <span>Residentes UE: {precioEU}</span>
                <span>Internacionales: {precioIntl}</span>
              </div>
            )}
            <div className="pub-program-details">
              {p.horas_semanales && <span>⏱ {p.horas_semanales}h/sem</span>}
              {p.modalidad && <span>📍 {p.modalidad}</span>}
            </div>
            <div className="pub-program-actions">
              {p.url_detalle && (
                <a href={p.url_detalle} target="_blank" rel="noopener noreferrer"
                  className="pub-btn pub-btn-primary pub-btn-sm"
                  style={{ textDecoration: "none" }}>
                  Ver programa oficial →
                </a>
              )}
              {onSelect && (
                <button className={`pub-program-btn ${selected ? "selected" : ""}`}
                  onClick={() => onSelect(p.id)}>
                  {selected ? "✓ Seleccionado" : "Seleccionar"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const TOTAL_STEPS = 5;

function MatchForm() {
  const [step, setStep] = useState(1);
  const [origin, setOrigin] = useState("");
  const [country, setCountry] = useState("");
  const [eduLevel, setEduLevel] = useState("");
  const [studyArea, setStudyArea] = useState("");
  const [cities, setCities] = useState([]);
  const [budget, setBudget] = useState("");

  const toggleCity = (c) => setCities(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const canNext = () => {
    if (step === 1) return origin && country.trim();
    if (step === 2) return eduLevel;
    if (step === 3) return studyArea;
    if (step === 4) return cities.length > 0;
    if (step === 5) return budget;
    return false;
  };

  const handleFinish = () => {
    sessionStorage.setItem("matchProfile", JSON.stringify({ student_origin: origin, country_of_origin: country, education_level: eduLevel, study_area: studyArea, preferred_cities: cities, budget }));
    navigate("/match/resultados");
  };

  const origins = [
    { value: "ue", label: "Soy de la Unión Europea", desc: "Sin visado, sin PCE. Accedes en las mismas condiciones que un estudiante español." },
    { value: "convenio", label: "Soy de Latinoamérica", desc: "Colombia, México, Argentina y otros países con convenio con España. Necesitas visado y puedes homologar tu bachillerato para acceder a la universidad." },
    { value: "extracomunitario", label: "Soy de otro país", desc: "Necesitas visado de estudiante y en algunos casos homologar tu bachillerato mediante la prueba PCE/UNED." },
  ];
  const eduOptions = [
    { value: "bachillerato", label: "Bachillerato / Secundaria", desc: "He completado la educación secundaria o equivalente" },
    { value: "fp_superior", label: "FP Superior / Técnico Superior", desc: "Tengo un título de formación profesional de grado superior" },
    { value: "grado", label: "Grado / Licenciatura", desc: "Tengo un título universitario de grado o licenciatura" },
    { value: "master", label: "Máster universitario", desc: "Tengo un máster y quiero hacer el doctorado" },
  ];
  const budgetOptions = [
    { value: "bajo", label: "Menos de 5.000 €/año", desc: "Principalmente universidades públicas y programas con beca" },
    { value: "medio", label: "De 5.000 € a 12.000 €/año", desc: "Amplia variedad de programas públicos y privados" },
    { value: "alto", label: "Más de 12.000 €/año", desc: "Programas especializados y universidades privadas premium" },
    { value: "indiferente", label: "El precio no es determinante", desc: "Quiero ver todas las opciones disponibles" },
  ];

  return (
    <div className="pub-container">
      <div className="pub-card">
        {/* Numbered step indicator */}
        <div className="pub-step-indicator">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <div className={`pub-step-line ${s <= step ? "done" : ""}`} />}
              <div className={`pub-step-dot ${s < step ? "done" : s === step ? "current" : "pending"}`}>
                {s < step ? "✓" : s}
              </div>
            </React.Fragment>
          ))}
        </div>

        {step === 1 && <>
          <h2>¿De dónde eres?</h2>
          <p className="pub-card-sub">Tu origen determina los requisitos de admisión y los precios de matrícula</p>
          <div className="pub-options">
            {origins.map(o => (
              <div key={o.value} className={`pub-option ${origin === o.value ? "selected" : ""}`} onClick={() => setOrigin(o.value)}>
                <div className="pub-option-dot" />
                <div><div className="pub-option-label">{o.label}</div><div className="pub-option-desc">{o.desc}</div></div>
              </div>
            ))}
          </div>
          <div className="pub-field" style={{ marginTop: 20 }}>
            <label className="pub-label">¿De qué país eres?</label>
            <input className="pub-input" placeholder="Ej: Colombia, México, Francia..." value={country} onChange={e => setCountry(e.target.value)} />
          </div>
        </>}

        {step === 2 && <>
          <h2>¿Cuál es tu nivel educativo actual?</h2>
          <p className="pub-card-sub">Esto determina qué tipos de programas puedes cursar en España</p>
          <div className="pub-options">
            {eduOptions.map(o => (
              <div key={o.value} className={`pub-option ${eduLevel === o.value ? "selected" : ""}`} onClick={() => setEduLevel(o.value)}>
                <div className="pub-option-dot" />
                <div><div className="pub-option-label">{o.label}</div><div className="pub-option-desc">{o.desc}</div></div>
              </div>
            ))}
          </div>
        </>}

        {step === 3 && <>
          <h2>¿Qué área te interesa?</h2>
          <p className="pub-card-sub">Selecciona el campo de estudio que más te atrae</p>
          <div className="pub-area-grid">
            {AREAS_FORMULARIO.map(area => (
              <div key={area.id} className={`pub-area-card ${studyArea === area.id ? "selected" : ""}`} onClick={() => setStudyArea(area.id)}>
                <div className="pub-area-card-icon">{area.emoji}</div>
                <div className="pub-area-card-name">{area.label}</div>
                <div className="pub-area-card-desc">{area.descripcion}</div>
              </div>
            ))}
          </div>
        </>}

        {step === 4 && <>
          <h2>¿Dónde te gustaría estudiar?</h2>
          <p className="pub-card-sub">Puedes elegir una o varias ciudades</p>
          <div className="pub-city-grid">
            {CITIES_LIST.map(c => (
              <div key={c} className={`pub-city ${cities.includes(c) ? "selected" : ""}`} onClick={() => toggleCity(c)}>
                <div className="pub-city-check">{cities.includes(c) ? "✓" : ""}</div>{c}
              </div>
            ))}
          </div>
        </>}

        {step === 5 && <>
          <h2>¿Cuál es tu presupuesto anual?</h2>
          <p className="pub-card-sub">Esto nos ayuda a mostrarte opciones realistas y ajustadas a ti</p>
          <div className="pub-options">
            {budgetOptions.map(o => (
              <div key={o.value} className={`pub-option ${budget === o.value ? "selected" : ""}`} onClick={() => setBudget(o.value)}>
                <div className="pub-option-dot" />
                <div><div className="pub-option-label">{o.label}</div><div className="pub-option-desc">{o.desc}</div></div>
              </div>
            ))}
          </div>
        </>}

        <div className="pub-form-nav">
          {step > 1 ? <button className="pub-btn pub-btn-outline pub-btn-sm" onClick={() => setStep(s => s - 1)}>← Anterior</button> : <div />}
          {step < TOTAL_STEPS
            ? <button className="pub-btn pub-btn-primary pub-btn-sm" disabled={!canNext()} onClick={() => setStep(s => s + 1)}>Siguiente →</button>
            : <button className="pub-btn pub-btn-primary pub-btn-sm" disabled={!canNext()} onClick={handleFinish}>Ver mis resultados →</button>
          }
        </div>
      </div>
    </div>
  );
}

const MATCH_LOADING_STEPS = [
  { msg: "Analizando tu perfil académico...", pct: 15, delay: 0 },
  { msg: "Buscando programas en toda España...", pct: 35, delay: 750 },
  { msg: "Filtrando por tus ciudades preferidas...", pct: 58, delay: 1700 },
  { msg: "Calculando compatibilidad con cada programa...", pct: 80, delay: 2700 },
  { msg: "Casi listo, preparando tus recomendaciones...", pct: 93, delay: 3500 },
];

function MatchResults() {
  const [matches, setMatches] = useState([]);
  const [dataReady, setDataReady] = useState(false);
  const [animDone, setAnimDone] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(MATCH_LOADING_STEPS[0].msg);
  const [loadingPct, setLoadingPct] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [filterCity, setFilterCity] = useState("");

  const profile = JSON.parse(sessionStorage.getItem("matchProfile") || "{}");

  useEffect(() => {
    if (!profile.study_area) { navigate("/match"); return; }

    (async () => {
      const data = await publicQueryAll("programas", "id,nombre,ciudad,tipo,familia_area,modalidad,precio_anual_eur,precio_extracomunitario_eur,horas_semanales,activo,url_detalle", "activo=eq.true");
      setMatches(computeMatches(data, profile));
      setDataReady(true);
    })();

    const timers = MATCH_LOADING_STEPS.map(s =>
      setTimeout(() => { setLoadingMsg(s.msg); setLoadingPct(s.pct); }, s.delay)
    );
    const doneTimer = setTimeout(() => setAnimDone(true), 3500 + 900);
    return () => [...timers, doneTimer].forEach(clearTimeout);
  }, []);

  const showResults = dataReady && animDone;

  if (submitted) return (
    <div className="pub-container">
      <div className="pub-success">
        <div className="pub-success-icon">🎉</div>
        <h2>¡Solicitud enviada!</h2>
        <p>Hemos recibido tu solicitud. Revisaremos tu perfil y te contactaremos por email en los próximos días.</p>
        <button className="pub-btn pub-btn-primary" onClick={() => navigate("/")}>Volver al inicio</button>
      </div>
    </div>
  );

  if (!showResults) {
    const waitingData = animDone && !dataReady;
    const pct = waitingData ? 97 : loadingPct;
    const msg = waitingData ? "Últimos ajustes..." : loadingMsg;
    return (
      <div className="pub-container">
        <div className="pub-card" style={{ textAlign: "center", padding: "64px 40px" }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🔍</div>
          <h2 style={{ marginBottom: 10 }}>Buscando programas para ti</h2>
          <p style={{ color: "var(--pub-muted)", marginBottom: 36, minHeight: 26 }}>{msg}</p>
          <div style={{ background: "#e2e8f0", borderRadius: 999, height: 10, overflow: "hidden", maxWidth: 380, margin: "0 auto 10px" }}>
            <div style={{
              background: "linear-gradient(90deg, var(--pub-primary), var(--pub-secondary))",
              height: "100%", borderRadius: 999,
              width: `${pct}%`, transition: "width 0.8s ease",
            }} />
          </div>
          <div style={{ fontSize: 13, color: "var(--pub-light)" }}>{pct}%</div>
        </div>
      </div>
    );
  }

  const filteredMatches = filterCity ? matches.filter(m => m.ciudad === filterCity) : matches;
  const matchCities = [...new Set(matches.map(m => m.ciudad).filter(Boolean))];

  return (
    <div className="pub-container-wide">
      <div className="pub-card" style={{ marginBottom: 24 }}>
        <h2>Tus programas recomendados</h2>
        <p className="pub-card-sub">Hemos encontrado <strong>{matches.length}</strong> programas que encajan con tu perfil en <strong>{AREAS_FORMULARIO.find(a => a.id === profile.study_area)?.label || profile.study_area}</strong></p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select className="pub-select" style={{ width: "auto" }} value={filterCity} onChange={e => setFilterCity(e.target.value)}>
            <option value="">Todas las ciudades</option>
            {matchCities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="pub-btn pub-btn-primary pub-btn-sm" onClick={() => setShowModal(true)}>Quiero que me contacten</button>
        </div>
      </div>
      <div className="pub-grid">
        {filteredMatches.map(p => <ProgramCard key={p.id} program={p} />)}
      </div>
      {filteredMatches.length === 0 && <div style={{ textAlign: "center", padding: 40, color: "var(--pub-muted)" }}>No hay programas en esta ciudad. Prueba con otra.</div>}

      {showModal && <LeadCaptureModal profile={profile} onClose={() => setShowModal(false)} onSuccess={() => { setShowModal(false); setSubmitted(true); }} />}
    </div>
  );
}

function LeadCaptureModal({ profile, onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!name || !email) return;
    setSending(true);
    await publicInsert("public_leads", {
      full_name: name, email, phone,
      country_of_origin: profile.country_of_origin,
      flow_type: "indeciso",
      student_origin: profile.student_origin,
      education_level: profile.education_level,
      study_area: profile.study_area,
      preferred_cities: profile.preferred_cities,
    });
    setSending(false);
    onSuccess();
  };

  return (
    <div className="pub-overlay" onClick={onClose}>
      <div className="pub-modal" onClick={e => e.stopPropagation()}>
        <h2>Contactar con QueEstudiar</h2>
        <p className="pub-card-sub">Déjanos tus datos y te contactaremos por email</p>
        <div className="pub-field"><label className="pub-label">Nombre completo *</label><input className="pub-input" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" /></div>
        <div className="pub-field"><label className="pub-label">Email *</label><input className="pub-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" /></div>
        <div className="pub-field"><label className="pub-label">Teléfono (con prefijo)</label><input className="pub-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+34 600 000 000" /></div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="pub-btn pub-btn-outline pub-btn-sm" onClick={onClose} style={{ flex: 1 }}>Cancelar</button>
          <button className="pub-btn pub-btn-primary pub-btn-sm" onClick={handleSubmit} disabled={!name || !email || sending} style={{ flex: 1 }}>{sending ? "Enviando..." : "Enviar solicitud"}</button>
        </div>
      </div>
    </div>
  );
}

// ── Compact card for the explorer left panel ─────────────────────────────
// Mapea familia_area (valor exacto de BD) → imagen genérica local
// `offset` = índice global en la lista filtrada → garantiza que dentro de
// cualquier bloque de 20 cards del mismo área no se repite ninguna imagen.
const _AREA_FILE = { negocios:"negocios", tecnologia:"informatica", ingenieria:"ingenieria", salud:"salud", ciencias:"ciencias", derecho:"derecho", educacion:"educacion", humanidades:"humanidades", comunicacion:"comunicacion", arte:"arte", turismo:"turismo" };
const _AREA_VARIANTS = 20;
function getAreaImage(familiaArea, offset) {
  const area = AREAS_FORMULARIO.find(a => a.familia_areas.includes(familiaArea));
  const file = area ? (_AREA_FILE[area.id] || "default") : "default";
  const variant = (Math.abs(offset ?? 0) % _AREA_VARIANTS) + 1;
  return `/assets/areas/${file}-${variant}.jpg`;
}

function ProgramCardCompact({ program: p, selected, isDrawerOpen, onClick, imageOffset }) {
  const [logoErr, setLogoErr] = useState(false);
  const fmtPrice = (v) => v === 0 ? "Gratuito" : `${Number(v).toLocaleString("es-ES")} €/año`;
  const precioEU = p.precio_anual_eur != null ? fmtPrice(p.precio_anual_eur) : "Consultar precio";
  const hasIntl = p.precio_extracomunitario_eur != null && p.precio_extracomunitario_eur !== p.precio_anual_eur;
  const domain = p.url_detalle ? (() => { try { return new URL(p.url_detalle).hostname.replace(/^www\./,""); } catch { return null; } })() : null;
  const tipoCls = p.tipo === "master" ? "master" : p.tipo === "fp_superior" ? "fp_superior" : p.tipo === "doctorado" ? "doctorado" : "";
  return (
    <div className={`pub-card-compact${isDrawerOpen ? " selected" : ""}`} onClick={onClick}>
      <div className="pub-card-compact-img">
        <img src={getAreaImage(p.familia_area, imageOffset)} alt="" loading="lazy" className="area-img"
          onError={e => { e.target.onerror = null; e.target.src = getAreaImage(p.familia_area, 0); }} />
        {domain && !logoErr && (
          <img src={`https://logo.clearbit.com/${domain}`} alt="" className="logo-badge" onError={() => setLogoErr(true)} />
        )}
      </div>
      <div className="pub-card-compact-body">
        <div className="pub-card-compact-tags">
          <span className={`pub-badge pub-badge-tipo ${tipoCls}`}>{TIPO_LABELS[p.tipo] || p.tipo}</span>
          {p.ciudad && <span className="pub-badge pub-badge-city">{p.ciudad}</span>}
        </div>
        <div className="pub-card-compact-title">{p.nombre}</div>
        <div className="pub-card-compact-price">{precioEU}{hasIntl && <span style={{ fontFamily:"Work Sans",fontSize:10,color:"var(--pizarra)",marginLeft:4 }}>· v. intl.</span>}</div>
      </div>
    </div>
  );
}

function ProgramCardNew({ program: p, isFav, isCmp, cmpDisabled, onFavToggle, onCmpToggle, onCardClick, imageOffset }) {
  const [qvOpen, setQvOpen] = React.useState(false);
  const [logoErr, setLogoErr] = React.useState(false);

  const fmtPrice = (v) => v == null ? '—' : v === 0 ? 'Gratuito' : `${Number(v).toLocaleString('es-ES')} €/año`;
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
            {p.idioma || '—'}
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
            <span className="qe-rating-text">{p.valoracion}{p.num_resenas != null ? ` · ${p.num_resenas} reseñas` : ''}</span>
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

// ── Drawer / sheet program detail ────────────────────────────────────────
function DrawerProgramDetail({ program: p, selected, onToggleSelect, compact }) {
  const [logoErr, setLogoErr] = useState(false);
  const fmtPrice = (v) => v === 0 ? "Gratuito" : `${Number(v).toLocaleString("es-ES")} €/año`;
  const precioEU = p.precio_anual_eur != null ? fmtPrice(p.precio_anual_eur) : null;
  const hasIntl = p.precio_extracomunitario_eur != null && p.precio_extracomunitario_eur !== p.precio_anual_eur;
  const precioIntl = hasIntl ? fmtPrice(p.precio_extracomunitario_eur) : null;
  const domain = p.url_detalle ? (() => { try { return new URL(p.url_detalle).hostname.replace(/^www\./,""); } catch { return null; } })() : null;
  const abbr = domain ? domain.split(".")[0].toUpperCase().slice(0,5) : (p.nombre || "?").slice(0,4).toUpperCase();
  const desc = TIPO_DESC[p.tipo] || "";
  const tipoCls = p.tipo === "master" ? "master" : p.tipo === "fp_superior" ? "fp_superior" : p.tipo === "doctorado" ? "doctorado" : "";
  return (
    <>
      <div className="pub-drawer-img">
        <img src={getAreaImage(p.familia_area, 0)} alt="" className="area-img" />
        {domain && !logoErr && (
          <img src={`https://logo.clearbit.com/${domain}`} alt="" className="logo-badge" onError={() => setLogoErr(true)} />
        )}
      </div>
      <div className={compact ? "pub-bs-body" : "pub-drawer-body"}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
          <span className={`pub-badge pub-badge-tipo ${tipoCls}`}>{TIPO_LABELS[p.tipo] || p.tipo}</span>
          {p.ciudad && <span className="pub-badge pub-badge-city">{p.ciudad}</span>}
          <VisaBadge horas={p.horas_semanales} />
        </div>
        <div className="pub-drawer-title">{p.nombre}</div>
        {domain && <div className="pub-drawer-univ">{domain}</div>}
        {p.familia_area && <div className="pub-drawer-section-title">{p.familia_area}</div>}
        <p className="pub-drawer-desc">{desc}</p>
        <div className="pub-drawer-section-title">Precio de matrícula</div>
        <div>
          {precioEU && <div className="pub-drawer-data-row"><span className="pub-drawer-data-label">Residentes UE</span><span className="pub-drawer-data-value">{precioEU}</span></div>}
          {precioIntl && <div className="pub-drawer-data-row"><span className="pub-drawer-data-label">Internacionales</span><span className="pub-drawer-data-value">{precioIntl}</span></div>}
          {!precioEU && <div className="pub-drawer-data-row"><span className="pub-drawer-data-label">Precio</span><span className="pub-drawer-data-value">Consultar</span></div>}
        </div>
        {(p.horas_semanales || p.modalidad) && <>
          <div className="pub-drawer-section-title">Detalles</div>
          <div>
            {p.horas_semanales && <div className="pub-drawer-data-row"><span className="pub-drawer-data-label">Carga semanal</span><span className="pub-drawer-data-value">{p.horas_semanales}h/sem</span></div>}
            {p.modalidad && <div className="pub-drawer-data-row"><span className="pub-drawer-data-label">Modalidad</span><span className="pub-drawer-data-value">{p.modalidad}</span></div>}
          </div>
        </>}
      </div>
      <div className={compact ? "pub-bs-footer" : "pub-drawer-footer"}>
        {p.url_detalle && <a href={p.url_detalle} target="_blank" rel="noopener noreferrer" className="pub-btn-oficial">Ver programa oficial →</a>}
        {onToggleSelect && <button className={`pub-btn-guardar${selected ? " saved" : ""}`} onClick={() => onToggleSelect(p.id)}>{selected ? "✓ Guardado" : "Guardar"}</button>}
      </div>
    </>
  );
}

function ProgramBrowser() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterTipo, setFilterTipo] = useState(() => { const v = sessionStorage.getItem("filterTipo"); sessionStorage.removeItem("filterTipo"); return v || ""; });
  const [filterArea, setFilterArea] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(new Set());
  const [drawerProgram, setDrawerProgram] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetProgram, setSheetProgram] = useState(null);
  const PER_PAGE = 24;

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

  // ── Toast ──
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  const showToast = (msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  };

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

  // ── Nav favoritos: mostrar solo guardados ──
  const [showOnlyFavs, setShowOnlyFavs] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await publicQueryAll("programas", "id,nombre,ciudad,tipo,familia_area,modalidad,precio_anual_eur,precio_extracomunitario_eur,horas_semanales,url_detalle", "activo=eq.true&order=nombre.asc");
        setPrograms(Array.isArray(data) ? data : []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const closeDrawer = () => setDrawerProgram(null);

  // Close sheet or drawer on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (sheetOpen) { closeSheet(); return; }
      closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  const cities = [...new Set(programs.map(p => p.ciudad).filter(Boolean))].sort();
  const areas = [...new Set(programs.map(p => p.familia_area).filter(Boolean))].sort();

  const filtered = programs.filter(p => {
    if (search && !p.nombre?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCity && p.ciudad !== filterCity) return false;
    if (filterTipo && p.tipo !== filterTipo) return false;
    if (filterArea && p.familia_area !== filterArea) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const toggleSelect = (id) => setSelected(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  const handleSolicitar = () => {
    sessionStorage.setItem("selectedProgramIds", JSON.stringify([...selected]));
    sessionStorage.setItem("selectedPrograms", JSON.stringify(programs.filter(p => selected.has(p.id))));
    navigate("/solicitud");
  };

  const openCard = (p) => {
    if (window.innerWidth <= 768) {
      setSheetProgram(p); setSheetOpen(true);
      document.body.style.overflow = "hidden";
    } else {
      // Toggle: click en la misma card la cierra
      setDrawerProgram(prev => prev?.id === p.id ? null : p);
    }
  };

  const closeSheet = () => {
    setSheetOpen(false);
    document.body.style.overflow = "";
    setTimeout(() => setSheetProgram(null), 400);
  };

  // Swipe-to-dismiss refs
  const touchStartY = useRef(0);
  const sheetRef = useRef(null);

  if (loading) return (
    <div className="pub-container">
      <div className="pub-card" style={{ textAlign:"center", padding:60 }}>
        <div style={{ fontSize:36, marginBottom:12 }}>📚</div>
        <p>Cargando programas...</p>
      </div>
    </div>
  );

  return (
    <>
      <div className={`pub-explorer-layout${drawerProgram ? " drawer-open" : ""}`}>
        {/* LEFT PANEL — filters + compact cards */}
        <div className="pub-cards-panel">
          <div className="pub-filters-bar">
            <input className="pub-filter-search" placeholder="Buscar programa…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }} />
            <select className="pub-filter-select" value={filterCity}
              onChange={e => { setFilterCity(e.target.value); setPage(0); }}>
              <option value="">Todas las ciudades</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select className="pub-filter-select" value={filterTipo}
              onChange={e => { setFilterTipo(e.target.value); setPage(0); }}>
              <option value="">Todos los tipos</option>
              {Object.entries(TIPO_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="pub-filter-select" value={filterArea}
              onChange={e => { setFilterArea(e.target.value); setPage(0); }}>
              <option value="">Todas las áreas</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div className="pub-cards-scroll">
            <div style={{ padding:"24px var(--padding-x) 0" }}>
              <p style={{ fontFamily:"'Lora',serif", fontSize:13, color:"var(--pizarra)", marginBottom:12 }}>
                {filtered.length.toLocaleString("es-ES")} programas
              </p>
              {selected.size > 0 && (
                <div className="pub-selected-bar" style={{ marginBottom:12 }}>
                  <span>{selected.size} guardado{selected.size > 1 ? "s" : ""}</span>
                  <button className="pub-btn pub-btn-primary pub-btn-sm" onClick={handleSolicitar}>Solicitar revisión →</button>
                </div>
              )}
            </div>

            <div className="pub-compact-grid" style={{ padding:"8px var(--padding-x) 32px" }}>
              {paged.map((p, i) => (
                <ProgramCardCompact key={p.id} program={p}
                  imageOffset={page * PER_PAGE + i}
                  selected={selected.has(p.id)}
                  isDrawerOpen={drawerProgram?.id === p.id || sheetProgram?.id === p.id}
                  onClick={() => openCard(p)} />
              ))}
            </div>

            {filtered.length === 0 && (
              <div style={{ textAlign:"center", padding:60, color:"var(--pizarra)", fontFamily:"'Lora',serif" }}>
                No se encontraron programas con esos filtros.
              </div>
            )}

            {totalPages > 1 && (
              <div className="pub-pagination" style={{ padding:"0 var(--padding-x) 32px" }}>
                {page > 0 && <button className="pub-page-btn" onClick={() => setPage(p => p-1)}>← Anterior</button>}
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = totalPages<=7 ? i : page<=3 ? i : page>=totalPages-4 ? totalPages-7+i : page-3+i;
                  return <button key={p} className={`pub-page-btn${p===page?" active":""}`} onClick={() => setPage(p)}>{p+1}</button>;
                })}
                {page < totalPages-1 && <button className="pub-page-btn" onClick={() => setPage(p => p+1)}>Siguiente →</button>}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL — desktop drawer */}
        <div className="pub-drawer-desktop">
          {drawerProgram ? (
            <div className="pub-drawer-content">
              <div className="pub-drawer-header">
                <button className="pub-drawer-close" onClick={closeDrawer} aria-label="Cerrar detalle">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M3 3l12 12M15 3L3 15" stroke="#94A3B8" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
              <DrawerProgramDetail program={drawerProgram} selected={selected.has(drawerProgram.id)}
                onToggleSelect={toggleSelect} compact={false} />
            </div>
          ) : (
            <div className="pub-drawer-empty">
              <div className="pub-drawer-empty-icon">◎</div>
              <div className="pub-drawer-empty-text">Selecciona un programa para ver sus detalles</div>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE — bottom sheet overlay + sheet */}
      <div className={`pub-bs-overlay${sheetOpen ? " visible" : ""}`} onClick={closeSheet} />
      <div ref={sheetRef} className={`pub-bottom-sheet${sheetOpen ? " open" : ""}`}
        role="dialog" aria-modal="true" aria-label="Detalle del programa"
        onTouchStart={e => { touchStartY.current = e.touches[0].clientY; }}
        onTouchEnd={e => { if (e.changedTouches[0].clientY - touchStartY.current > 80) closeSheet(); }}>
        <div className="pub-bs-handle" />
        {sheetProgram && (
          <DrawerProgramDetail program={sheetProgram} selected={selected.has(sheetProgram.id)}
            onToggleSelect={toggleSelect} compact={true} />
        )}
      </div>
    </>
  );
}

function SolicitudForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [budget, setBudget] = useState("");
  const [startDate, setStartDate] = useState("");
  const [studentOrigin, setStudentOrigin] = useState("");
  const [educationLevel, setEducationLevel] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const selectedPrograms = JSON.parse(sessionStorage.getItem("selectedPrograms") || "[]");
  const selectedIds = JSON.parse(sessionStorage.getItem("selectedProgramIds") || "[]");

  useEffect(() => {
    if (selectedIds.length === 0) navigate("/programas");
  }, []);

  const handleSubmit = async () => {
    if (!name || !email || !studentOrigin || !educationLevel) return;
    setSending(true);
    setSubmitError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/onboard-student`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: name,
          email,
          phone,
          country_of_origin: country,
          student_origin: studentOrigin,
          education_level: educationLevel,
          budget_range: budget,
          planned_start_date: startDate,
          selected_programa_ids: selectedIds,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al enviar la solicitud.");
      }
      setSubmitted(true);
      sessionStorage.removeItem("selectedPrograms");
      sessionStorage.removeItem("selectedProgramIds");
    } catch (e) {
      setSubmitError(e.message || "No se pudo enviar. Inténtalo de nuevo.");
    }
    setSending(false);
  };

  if (submitted) return (
    <div className="pub-container">
      <div className="pub-success">
        <div className="pub-success-icon">🎉</div>
        <h2>¡Solicitud enviada!</h2>
        <p>Hemos recibido tu solicitud de revisión de expediente. La revisaremos y te contactaremos por email pronto.</p>
        <button className="pub-btn pub-btn-primary" onClick={() => navigate("/")}>Volver al inicio</button>
      </div>
    </div>
  );

  return (
    <div className="pub-container">
      <div className="pub-card">
        <h2>Solicitar revisión de expediente</h2>
        <p className="pub-card-sub">{selectedPrograms.length} programa{selectedPrograms.length > 1 ? "s" : ""} seleccionado{selectedPrograms.length > 1 ? "s" : ""}</p>

        <div style={{ marginBottom: 24, padding: 16, background: "var(--pub-surface)", borderRadius: 8 }}>
          {selectedPrograms.map(p => (
            <div key={p.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--pub-border)", fontSize: 14 }}>
              <strong>{p.nombre}</strong> <span style={{ color: "var(--pub-muted)" }}>· {p.ciudad} · {TIPO_LABELS[p.tipo] || p.tipo}</span>
            </div>
          ))}
        </div>

        <div className="pub-field"><label className="pub-label">Nombre completo *</label><input className="pub-input" value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="pub-field"><label className="pub-label">Email *</label><input className="pub-input" type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div className="pub-field"><label className="pub-label">Teléfono (con prefijo)</label><input className="pub-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+34 600 000 000" /></div>
        <div className="pub-field"><label className="pub-label">País de origen</label><input className="pub-input" value={country} onChange={e => setCountry(e.target.value)} /></div>
        <div className="pub-field">
          <label className="pub-label">¿De dónde eres? *</label>
          <select className="pub-select" value={studentOrigin} onChange={e => setStudentOrigin(e.target.value)}>
            <option value="">Selecciona tu origen...</option>
            <option value="comunitario">Ciudadano de la UE / EEE</option>
            <option value="latinoamerica">Latinoamérica (con acuerdo bilateral)</option>
            <option value="extracomunitario">Fuera de la UE — necesito visado de estudiante</option>
          </select>
        </div>
        <div className="pub-field">
          <label className="pub-label">¿Cuál es tu nivel de estudios actual? *</label>
          <select className="pub-select" value={educationLevel} onChange={e => setEducationLevel(e.target.value)}>
            <option value="">Selecciona tu nivel...</option>
            <option value="bachillerato">Bachillerato / Educación Secundaria</option>
            <option value="fp_superior">FP de Grado Superior o equivalente</option>
            <option value="grado">Grado universitario / Licenciatura</option>
            <option value="master">Máster o posgrado</option>
          </select>
        </div>
        <div className="pub-field">
          <label className="pub-label">Presupuesto anual</label>
          <select className="pub-select" value={budget} onChange={e => setBudget(e.target.value)}>
            <option value="">Selecciona un rango</option>
            <option value="<3000">Menos de 3.000 €</option>
            <option value="3000-6000">3.000 € - 6.000 €</option>
            <option value="6000-10000">6.000 € - 10.000 €</option>
            <option value=">10000">Más de 10.000 €</option>
          </select>
        </div>
        <div className="pub-field">
          <label className="pub-label">¿Cuándo quieres empezar?</label>
          <select className="pub-select" value={startDate} onChange={e => setStartDate(e.target.value)}>
            <option value="">Selecciona una fecha</option>
            <option value="sept-2026">Septiembre 2026</option>
            <option value="ene-2027">Enero 2027</option>
            <option value="sept-2027">Septiembre 2027</option>
            <option value="otro">Otra fecha</option>
          </select>
        </div>

        {submitError && (
          <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 13, color: "#dc2626" }}>
            ⚠ {submitError}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button className="pub-btn pub-btn-outline pub-btn-sm" onClick={() => navigate("/programas")} style={{ flex: 1 }}>← Volver</button>
          <button className="pub-btn pub-btn-primary pub-btn-sm" onClick={handleSubmit} disabled={!name || !email || !studentOrigin || !educationLevel || sending} style={{ flex: 1 }}>{sending ? "Enviando..." : "Enviar solicitud"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PORTAL DEL CLIENTE
// ═══════════════════════════════════════════════════════════════════════════

const TEAM_FALLBACK = [
  { email: "maria@queestudiar.es", name: "María" },
  { email: "alejandro.suarez@estuvisa.es", name: "Alejandro Suárez" },
  { email: "kenny.alvarez@estuvisa.es", name: "Kenny Álvarez" },
  { email: "luis.solanas@estuvisa.es", name: "Luis Solanas" },
];

function PortalCliente({ currentUser, onLogout }) {
  const [lead, setLead] = useState(null);
  const [matches, setMatches] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDocId, setActiveDocId] = useState(null);
  const [comments, setComments] = useState({});
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [uploadError, setUploadError] = useState({});
  const [newComment, setNewComment] = useState({});
  const [portalTab, setPortalTab] = useState("programas");

  useEffect(() => { loadPortalData(); }, []);

  async function loadPortalData() {
    setLoading(true);
    try {
      const leads = await query("student_leads", "*", { client_user_id: currentUser.id });
      if (!Array.isArray(leads) || leads.length === 0) { setLoading(false); return; }
      const sl = leads[0];
      setLead(sl);
      const [matchData, docData] = await Promise.all([
        query("matches", "*, programas(nombre, ciudad, tipo, visa_eligible, url_solicitud, url_solicitud_status, precio_anual_eur, precio_extracomunitario_eur)", { student_id: sl.id }),
        query("student_documents", "*", { student_id: sl.id }),
      ]);
      setMatches(Array.isArray(matchData) ? matchData.filter(m => m.programas?.visa_eligible !== 'no_elegible') : []);
      const docs = Array.isArray(docData) ? docData : [];
      setDocuments(docs);
    } catch {}
    setLoading(false);
  }

  async function toggleFavorito(matchId, current) {
    const next = current === true ? null : true;
    await patch("matches", matchId, { cliente_favorito: next });
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, cliente_favorito: next } : m));
  }

  async function loadComments(docId) {
    const data = await query("document_comments", "*", { student_document_id: docId });
    setComments(prev => ({ ...prev, [docId]: Array.isArray(data) ? data.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) : [] }));
  }

  async function sendComment(docId) {
    const msg = (newComment[docId] || "").trim();
    if (!msg) return;
    await fetch(`${SUPABASE_URL}/rest/v1/document_comments`, {
      method: "POST",
      headers: { ...getAuthHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ student_document_id: docId, author_id: currentUser.id, author_type: 'cliente', message: msg }),
    });
    setNewComment(prev => ({ ...prev, [docId]: "" }));
    await loadComments(docId);
  }

  async function uploadDocFile(docId, file) {
    if (!file || file.type !== "application/pdf") {
      setUploadError(prev => ({ ...prev, [docId]: "Solo se aceptan archivos PDF." }));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError(prev => ({ ...prev, [docId]: "El archivo no puede superar 10 MB." }));
      return;
    }
    setUploadingDoc(docId);
    setUploadError(prev => ({ ...prev, [docId]: null }));
    try {
      const path = `${currentUser.id}/${docId}.pdf`;
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/student-documents/${path}`;
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/pdf",
          "x-upsert": "true",
        },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Error al subir el archivo.");

      const fileUrl = `${SUPABASE_URL}/storage/v1/object/authenticated/student-documents/${path}`;
      await patch("student_documents", docId, {
        file_url: fileUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: "application/pdf",
        status: "en_revision",
        updated_at: new Date().toISOString(),
      });
      setDocuments(prev => prev.map(d =>
        d.id === docId
          ? { ...d, file_url: fileUrl, file_name: file.name, file_size: file.size, status: "en_revision" }
          : d
      ));

      fetch(`${SUPABASE_URL}/functions/v1/evaluate-document`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: docId }),
      }).then(r => console.log("evaluate-document status:", r.status))
        .catch(e => console.error("evaluate-document error:", e));
    } catch (e) {
      setUploadError(prev => ({ ...prev, [docId]: "No se pudo subir el archivo. Inténtalo de nuevo." }));
    }
    setUploadingDoc(null);
  }

  async function deleteDocFile(docId) {
    if (!window.confirm("¿Eliminar el archivo? Esta acción no se puede deshacer.")) return;
    setUploadingDoc(docId);
    try {
      const path = `${currentUser.id}/${docId}.pdf`;
      await fetch(`${SUPABASE_URL}/storage/v1/object/student-documents/${path}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      await patch("student_documents", docId, {
        file_url: null, file_name: null,
        file_size: null, file_type: null,
        status: "pendiente",
        updated_at: new Date().toISOString(),
      });
      setDocuments(prev => prev.map(d =>
        d.id === docId ? { ...d, file_url: null, file_name: null, file_size: null, status: "pendiente" } : d
      ));
    } catch {
      setUploadError(prev => ({ ...prev, [docId]: "No se pudo eliminar el archivo." }));
    }
    setUploadingDoc(null);
  }

  const toggleDoc = async (docId) => {
    if (activeDocId === docId) { setActiveDocId(null); return; }
    setActiveDocId(docId);
    if (!comments[docId]) await loadComments(docId);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{css}</style>
      <div className="loading"><div className="spinner" /> Cargando tu portal...</div>
    </div>
  );

  if (!lead) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <style>{css}</style>
      <div style={{ color: "var(--muted)", fontFamily: "var(--mono)", textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>◉</div>
        <div>Tu expediente aún no está listo.</div>
        <div style={{ fontSize: 12, marginTop: 8 }}>Contacta con tu asesor para que lo active.</div>
      </div>
      <button className="btn-ghost" onClick={onLogout}>Cerrar sesión</button>
    </div>
  );

  const favoritosCount = matches.filter(m => m.cliente_favorito === true).length;
  const docsAprobados = documents.filter(d => d.status === 'aprobado').length;
  const hasSolicitud = matches.some(m => m.match_stage === 'solicitud');
  const asesor = TEAM_FALLBACK.find(t => t.email === lead.assigned_to);
  const levelLow = (lead.education_level || "").toLowerCase();
  const isMaster = levelLow.includes("master");
  const isFP = levelLow.includes("fp");
  const isNonEU = lead.student_origin === "extracomunitario";

  const convocatorias = isMaster ? [
    { texto: "Másters con nota de corte",             fecha: "Enero – Marzo 2026",          past: true  },
    { texto: "Plazo general universidades públicas",   fecha: "Febrero – Abril 2026",        past: true  },
    { texto: "Plazo universidades privadas",           fecha: "Abierto todo el año",          past: false },
    { texto: "Inicio de clases",                       fecha: "Septiembre 2026 / Enero 2027", past: false },
  ] : isFP ? [
    { texto: "Convocatoria FP pública",                fecha: "Junio 2026",                  past: false },
    { texto: "Centros privados",                       fecha: "Matrícula abierta",            past: false },
    { texto: "Inicio de clases",                       fecha: "Septiembre 2026",              past: false },
  ] : [
    { texto: "Prueba de acceso (PCE/UNED)",            fecha: "Convocatoria mayo 2026",       past: false },
    { texto: "Preinscripción universidades públicas",  fecha: "Junio – Julio 2026",           past: false },
    { texto: "Plazo universidades privadas",           fecha: "Abierto todo el año",           past: false },
    { texto: "Inicio de clases",                       fecha: "Septiembre 2026",              past: false },
  ];

  const nextDeadline = convocatorias.find(c => !c.past && !c.texto.toLowerCase().includes("inicio"));
  const proximaConv = nextDeadline ? nextDeadline.fecha : (convocatorias.find(c => !c.past)?.fecha || "—");
  const proximaConvLabel = nextDeadline ? nextDeadline.texto : "Próxima fecha";
  const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.nuevo;

  const trackerSteps = [
    { key: "perfil",      label: "Perfil",      done: true },
    { key: "programas",   label: "Programas",   done: matches.length > 0 },
    { key: "documentos",  label: "Documentos",  done: documents.length > 0 },
    { key: "solicitudes", label: "Solicitudes", done: hasSolicitud },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <style>{css}</style>

      {/* HEADER */}
      <div className="header portal-header">
        <div className="header-left"><div className="logo-mark">▸ QueEstudiar</div><div className="header-title">Mi Portal</div></div>
        <div className="header-right">
          <div className="user-badge">{lead.full_name || currentUser.email}</div>
          <button className="btn-ghost" onClick={onLogout}>Salir</button>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 16px" }}>

        {/* BIENVENIDA */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 26, color: "var(--text)", marginBottom: 6 }}>
            Hola, {lead.full_name?.split(" ")[0] || "estudiante"} 👋
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
            {[lead.country_of_origin, lead.education_level, lead.study_area].filter(Boolean).join(" · ")}
          </div>
          <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: statusCfg.bg, color: statusCfg.color, fontFamily: "var(--mono)" }}>
            {statusCfg.label}
          </span>
        </div>

        {/* TRACKER DE PROGRESO — navegable como tabs */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
            <div style={{ position: "absolute", top: 14, left: "12.5%", right: "12.5%", height: 2, background: "var(--border)", zIndex: 0 }} />
            {trackerSteps.map((step, i) => {
              const isActive = portalTab === step.key;
              const isCurrent = !step.done && (i === 0 || trackerSteps[i - 1].done);
              return (
                <div
                  key={step.key}
                  onClick={() => setPortalTab(step.key)}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 1, cursor: "pointer" }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, fontFamily: "var(--mono)",
                    background: step.done ? "var(--accent)" : isActive ? "#ede9fe" : "var(--surface)",
                    color: step.done ? "#fff" : isActive ? "#7c3aed" : isCurrent ? "var(--accent)" : "var(--muted)",
                    border: isActive ? "2px solid #7c3aed" : step.done ? "2px solid var(--accent)" : isCurrent ? "2px solid var(--accent)" : "2px solid var(--border)",
                    boxShadow: isActive ? "0 0 0 3px #7c3aed22" : "none",
                    transition: "all 0.15s",
                  }}>
                    {step.done ? "✓" : i + 1}
                  </div>
                  <div style={{
                    fontSize: 9, fontFamily: "var(--mono)", textAlign: "center",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    color: isActive ? "#7c3aed" : step.done ? "var(--accent)" : isCurrent ? "var(--accent)" : "var(--muted)",
                    fontWeight: isActive ? 700 : 400,
                  }}>
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* STATS */}
        <div className="portal-stats" style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { label: "Programas recomendados", value: matches.length,                                    color: "var(--accent)",  mono: false, tab: "programas"  },
            { label: "Mis favoritos",           value: favoritosCount,                                   color: "var(--accent2)", mono: false, tab: "programas"  },
            { label: "Documentos aprobados",    value: `${docsAprobados} / ${documents.length || "—"}`, color: "#16a34a",        mono: true,  tab: "documentos" },
            { label: proximaConvLabel,          value: proximaConv,                                      color: "var(--accent)",  mono: true,  tab: "programas"  },
          ].map(({ label, value, color, mono, tab }) => (
            <div key={label} onClick={() => tab && setPortalTab(tab)} className="portal-stat-card" style={{ flex: "1 1 160px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "14px 16px", cursor: tab ? "pointer" : "default" }}>
              <div className="stat-value" style={{ fontSize: 22, fontWeight: 700, color, fontFamily: mono ? "var(--mono)" : "var(--display)", lineHeight: 1.2 }}>{value}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ASESOR */}
        {asesor && (
          <div style={{ background: "#dbeafe", borderRadius: 8, padding: "12px 16px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 20 }}>👤</span>
            <div>
              <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>Tu asesor: {asesor.name}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>Cualquier duda, escríbenos a hola@queestudiar.es</div>
            </div>
          </div>
        )}

        {/* ── SECCIÓN ACTIVA SEGÚN TAB ── */}

        {/* TAB: PERFIL */}
        {portalTab === "perfil" && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "20px 24px", marginBottom: 28 }}>
            <div className="section-title" style={{ marginBottom: 16 }}>Tu perfil académico</div>
            {[
              { label: "Nombre",              value: lead.full_name },
              { label: "País de origen",      value: lead.country_of_origin },
              { label: "Nivel de estudios",   value: lead.education_level },
              { label: "Área de interés",     value: lead.study_area },
              { label: "Ciudades preferidas", value: Array.isArray(lead.preferred_cities) ? lead.preferred_cities.join(", ") : lead.preferred_cities },
              { label: "Tipo de estudiante",  value: lead.student_origin === "extracomunitario" ? "Extracomunitario" : (lead.student_origin === "latam_convenio" || lead.student_origin === "convenio") ? "LATAM · Convenio" : lead.student_origin === "ue" ? "UE / EEE" : lead.student_origin },
            ].filter(r => r.value).map(({ label, value }) => (
              <div key={label} className="portal-perfil-row" style={{ display: "flex", gap: 16, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <span className="portal-perfil-label" style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", minWidth: 140 }}>{label}</span>
                <span style={{ fontSize: 12, color: "var(--text)", fontFamily: "var(--mono)" }}>{value}</span>
              </div>
            ))}
            <div style={{ marginTop: 14, fontSize: 11, color: "var(--muted)", fontStyle: "italic" }}>
              Para modificar tu perfil, contacta con tu asesor en hola@queestudiar.es
            </div>
          </div>
        )}

        {/* TAB: PROGRAMAS */}
        {portalTab === "programas" && (
          <div>
            <div style={{ marginBottom: 28 }}>
              <div className="section-title" style={{ marginBottom: 12 }}>Tus programas recomendados</div>
              {matches.length === 0 ? (
                <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: 24, textAlign: "center" }}>
                  <div style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic", lineHeight: 1.7 }}>
                    Estamos seleccionando los mejores programas para tu perfil.
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", marginTop: 8, lineHeight: 1.7 }}>
                    El equipo de QueEstudiar revisará tu expediente y te notificará pronto.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {matches.map(m => {
                    const p = m.programas || {};
                    const isFav = m.cliente_favorito === true;
                    const price = isNonEU && p.precio_extracomunitario_eur != null ? p.precio_extracomunitario_eur : p.precio_anual_eur;
                    return (
                      <div key={m.id} style={{ flex: "1 1 260px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                        <div style={{ height: 4, background: isFav ? "var(--accent2)" : "var(--accent)" }} />
                        <div style={{ padding: "12px 14px" }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", marginBottom: 2, lineHeight: 1.3 }}>{p.nombre || "Programa"}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 10 }}>{p.ciudad || "—"}</div>
                          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginBottom: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--display)" }}>
                              {price != null ? (price === 0 ? "Gratuito" : `${price.toLocaleString("es-ES")}€/año`) : "—"}
                            </div>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                            {p.tipo && <span className="tag highlight">{p.tipo}</span>}
                            {p.visa_eligible === 'elegible' && <span className="tag" style={{ color: "#16a34a", borderColor: "#16a34a44", background: "#dcfce7" }}>✓ Apto visado</span>}
                            {p.visa_eligible === 'pendiente' && <span className="tag" style={{ color: "#ca8a04", borderColor: "#ca8a0444", background: "#fef9c3" }}>⏳ Pendiente</span>}
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => toggleFavorito(m.id, m.cliente_favorito)}
                              style={{ flex: 1, fontSize: 11, padding: "5px 8px", borderRadius: 5, cursor: "pointer", border: `1px solid ${isFav ? "var(--accent)" : "var(--border)"}`, background: isFav ? "var(--accent)" : "var(--surface)", color: isFav ? "#fff" : "var(--muted)" }}
                            >
                              {isFav ? "👍 Me interesa" : "Marcar interés"}
                            </button>
                            {p.url_solicitud && p.url_solicitud_status !== 'rota' && (
                              <a href={p.url_solicitud} target="_blank" rel="noreferrer" className="url-btn url-ok" style={{ fontSize: 11 }}>↗ Ver</a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Próximas convocatorias — solo en tab Programas */}
            <div style={{ marginBottom: 28 }}>
              <div className="section-title" style={{ marginBottom: 4 }}>Próximas convocatorias</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>Fechas clave para los programas de tu perfil</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {convocatorias.map((c, i) => (
                  <div key={i} className="portal-conv-row" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, opacity: c.past ? 0.5 : 1 }}>
                    <span style={{ fontSize: 12, color: c.past ? "var(--muted)" : "var(--text)" }}>{c.past ? "✓ " : ""}{c.texto}</span>
                    <span className="portal-conv-fecha" style={{ fontSize: 11, color: c.past ? "var(--muted)" : "var(--accent)", fontFamily: "var(--mono)", whiteSpace: "nowrap", textDecoration: c.past ? "line-through" : "none" }}>{c.fecha}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: DOCUMENTOS */}
        {portalTab === "documentos" && (
          <div>
            <div className="section-title" style={{ marginBottom: 12 }}>Mi documentación</div>
            {documents.length === 0 ? (
              <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: 24, textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic", lineHeight: 1.7 }}>
                  Tu checklist de documentos está en preparación.
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", marginTop: 8, lineHeight: 1.7 }}>
                  Mientras tanto, puedes ir preparando: pasaporte vigente, título académico, certificado de notas y carta de motivación.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {documents.map(doc => {
                  const dsc = DOC_STATUS_CONFIG[doc.status] || DOC_STATUS_CONFIG.pendiente;
                  const isOpen = activeDocId === doc.id;
                  const docComments = comments[doc.id] || [];
                  return (
                    <div key={doc.id} style={{ background: "var(--surface)", border: `1px solid ${isOpen ? "var(--accent)" : "var(--border)"}`, borderRadius: 8, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", cursor: "pointer" }} onClick={() => toggleDoc(doc.id)}>
                        <span style={{ fontSize: 16 }}>{dsc.emoji}</span>
                        <span style={{ flex: 1, fontFamily: "var(--mono)", fontSize: 13 }}>{doc.document_type}</span>
                        <span style={{ fontSize: 11, color: dsc.color, fontFamily: "var(--mono)" }}>{dsc.label}</span>
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>{isOpen ? "▲" : "▼"}</span>
                      </div>
                      {isOpen && (
                        <div style={{ padding: "0 14px 14px", borderTop: "1px solid var(--border)" }}>
                          {doc.notes && (
                            <div style={{ fontSize: 11, color: "#ca8a04", fontFamily: "var(--mono)", margin: "10px 0 6px" }}>
                              ℹ {doc.notes}
                            </div>
                          )}

                          {doc.file_url ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, marginTop: 10 }}>
                              <span style={{ fontSize: 18 }}>📄</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {doc.file_name || "documento.pdf"}
                                </div>
                                <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 2 }}>
                                  {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : ""}
                                </div>
                              </div>
                              <button
                                onClick={() => openPdf(doc.file_url)}
                                style={{ fontSize: 11, padding: "4px 10px", borderRadius: 5, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer", fontFamily: "var(--mono)", whiteSpace: "nowrap" }}
                              >
                                Ver PDF
                              </button>
                              <button
                                onClick={() => deleteDocFile(doc.id)}
                                disabled={uploadingDoc === doc.id}
                                style={{ fontSize: 11, padding: "4px 10px", borderRadius: 5, background: "none", border: "1px solid #dc262644", color: "#dc2626", cursor: "pointer", fontFamily: "var(--mono)", whiteSpace: "nowrap", opacity: uploadingDoc === doc.id ? 0.5 : 1 }}
                              >
                                Eliminar
                              </button>
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 10, fontStyle: "italic" }}>
                              Aún no has subido ningún archivo.
                            </div>
                          )}

                          {doc.ai_score ? (
                            <div style={{ marginTop: 10, padding: "8px 12px", background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 6 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", fontFamily: "var(--mono)" }}>Evaluación IA:</span>
                                <span style={{ fontSize: 13 }}>{"⭐".repeat(doc.ai_score)}{"☆".repeat(5 - doc.ai_score)}</span>
                                <span style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{doc.ai_score}/5</span>
                              </div>
                              <div style={{ fontSize: 12, color: "var(--text)", lineHeight: 1.5 }}>{doc.ai_feedback}</div>
                            </div>
                          ) : doc.file_url ? (
                            <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", fontStyle: "italic" }}>
                              Evaluación pendiente — aparecerá en breve.
                            </div>
                          ) : null}

                          <div style={{ marginTop: 12 }}>
                            <label style={{ display: "block", fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", marginBottom: 6 }}>
                              {doc.file_url ? "Reemplazar PDF:" : "Subir PDF:"}
                            </label>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <input
                                type="file"
                                accept=".pdf,application/pdf"
                                id={`file-${doc.id}`}
                                style={{ display: "none" }}
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) uploadDocFile(doc.id, file);
                                  e.target.value = "";
                                }}
                              />
                              <label
                                htmlFor={`file-${doc.id}`}
                                style={{
                                  fontSize: 12, padding: "7px 16px", borderRadius: 6, cursor: "pointer",
                                  border: "1px solid var(--accent)", color: "var(--accent)", background: "var(--surface)",
                                  fontFamily: "var(--mono)", whiteSpace: "nowrap",
                                  opacity: uploadingDoc === doc.id ? 0.6 : 1,
                                  pointerEvents: uploadingDoc === doc.id ? "none" : "auto",
                                }}
                              >
                                {uploadingDoc === doc.id ? "Subiendo…" : "Seleccionar PDF"}
                              </label>
                              <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)" }}>
                                Máx. 10 MB · Solo PDF
                              </span>
                            </div>
                            {uploadError[doc.id] && (
                              <div style={{ marginTop: 6, fontSize: 11, color: "#dc2626", fontFamily: "var(--mono)" }}>
                                ⚠ {uploadError[doc.id]}
                              </div>
                            )}
                          </div>

                          {docComments.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)", marginBottom: 6 }}>Comentarios del equipo:</div>
                              {docComments.map(c => (
                                <div key={c.id} style={{ padding: "6px 10px", background: c.author_type === 'team' ? "#dbeafe" : "#f8fafc", border: "1px solid var(--border)", borderRadius: 6, marginBottom: 4, fontSize: 12, fontFamily: "var(--mono)" }}>
                                  <span style={{ color: c.author_type === 'team' ? "var(--accent)" : "var(--accent2)" }}>{c.author_type === 'team' ? "Asesor" : "Tú"}</span>
                                  <span style={{ color: "var(--muted)", marginLeft: 8, fontSize: 10 }}>{formatDate(c.created_at)}</span>
                                  <div style={{ marginTop: 4, color: "var(--text)" }}>{c.message}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                            <input
                              className="url-edit-input"
                              style={{ flex: 1 }}
                              value={newComment[doc.id] || ""}
                              onChange={e => setNewComment(prev => ({ ...prev, [doc.id]: e.target.value }))}
                              placeholder="Responder al equipo..."
                              onKeyDown={e => e.key === "Enter" && sendComment(doc.id)}
                            />
                            <button className="url-edit-btn save" onClick={() => sendComment(doc.id)}>Enviar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: SOLICITUDES */}
        {portalTab === "solicitudes" && (
          <div>
            <div className="section-title" style={{ marginBottom: 12 }}>Mis solicitudes activas</div>
            {(() => {
              const solicitudes = matches.filter(m => m.match_stage === 'solicitud');
              return solicitudes.length === 0 ? (
                <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 8, padding: 32, textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>📨</div>
                  <div style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic", lineHeight: 1.7 }}>
                    Aún no hay solicitudes activas.
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, lineHeight: 1.7 }}>
                    Cuando el equipo marque un programa como "en solicitud", aparecerá aquí con el enlace directo para aplicar.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {solicitudes.map(m => {
                    const p = m.programas || {};
                    return (
                      <div key={m.id} className="portal-solicitud-row" style={{ background: "var(--surface)", border: "1px solid #16a34a44", borderRadius: 8, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{p.nombre || "Programa"}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{p.ciudad || "—"}</div>
                        </div>
                        {p.url_solicitud && p.url_solicitud_status !== 'rota' && (
                          <a href={p.url_solicitud} target="_blank" rel="noreferrer" className="portal-solicitud-btn"
                            style={{ fontSize: 11, padding: "6px 14px", borderRadius: 6, background: "#16a34a", color: "#fff", textDecoration: "none", fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>
                            ↗ Solicitar plaza
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPEDIENTES DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

function ExpedientesDashboard({ students, teamMembers, onSelectStudent, onClose }) {
  const [filterAsesor, setFilterAsesor] = useState("all");
  const enProceso = students.filter(s => s.status === 'en_proceso');
  const displayed = filterAsesor === "all" ? enProceso : enProceso.filter(s => s.assigned_to === filterAsesor);
  const asesores = [...new Set(enProceso.map(s => s.assigned_to).filter(Boolean))];

  return (
    <div className="detail" style={{ overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div className="section-title">Expedientes activos · {displayed.length}</div>
        <button className="btn-ghost" onClick={onClose}>✕ Cerrar</button>
      </div>
      {asesores.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          <div className={`filter-chip ${filterAsesor === "all" ? "active" : ""}`} onClick={() => setFilterAsesor("all")}>Todos</div>
          {asesores.map(a => {
            const member = teamMembers.find(m => m.email === a);
            return <div key={a} className={`filter-chip ${filterAsesor === a ? "active" : ""}`} onClick={() => setFilterAsesor(a)}>{member?.name || a}</div>;
          })}
        </div>
      )}
      {displayed.length === 0 ? (
        <div style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 13, padding: "24px 0" }}>No hay expedientes en proceso.</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "var(--mono)" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Estudiante</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Asesor</th>
              <th style={{ textAlign: "center", padding: "6px 8px" }}>Origen</th>
              <th style={{ textAlign: "center", padding: "6px 8px" }}>Portal</th>
              <th style={{ textAlign: "left", padding: "6px 8px" }}>Recibido</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map(s => {
              const member = teamMembers.find(m => m.email === s.assigned_to);
              return (
                <tr key={s.id} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }} onClick={() => { onSelectStudent(s); onClose(); }}>
                  <td style={{ padding: "8px 8px" }}>
                    <div style={{ color: "var(--text)", fontWeight: 500 }}>{s.full_name || "—"}</div>
                    <div style={{ color: "var(--muted)", fontSize: 11 }}>{s.email}</div>
                  </td>
                  <td style={{ padding: "8px 8px", color: "var(--muted)" }}>{member?.name || s.assigned_to || "—"}</td>
                  <td style={{ padding: "8px 8px", textAlign: "center", color: "var(--muted)" }}>{getOriginLabel(s.student_origin)}</td>
                  <td style={{ padding: "8px 8px", textAlign: "center" }}>
                    {s.client_user_id ? <span style={{ color: "#16a34a" }}>✓ Activo</span> : <span style={{ color: "var(--muted)" }}>—</span>}
                  </td>
                  <td style={{ padding: "8px 8px", color: "var(--muted)" }}>{formatDate(s.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PublicApp({ route }) {
  const getPage = () => {
    const r = route;
    if (r === "/match/resultados" || r === "#/match/resultados") return <MatchResults />;
    if (r?.startsWith("/match") || r?.startsWith("#/match")) return <MatchForm />;
    if (r === "/solicitud" || r === "#/solicitud") return <SolicitudForm />;
    if (r?.startsWith("/programa") || r?.startsWith("#/programa")) return <ProgramBrowser />;
    return <LandingPage />;
  };
  return (
    <div className="pub-app">
      <style>{publicCss}</style>
      <a href="#main" className="skip-link">Saltar al contenido principal</a>
      <PublicNav route={route} />
      <main id="main" style={{ flex: 1 }}>{getPage()}</main>
      <footer className="pub-footer">
        <div className="pub-footer-links">
          <span className="pub-footer-link">Política de privacidad</span>
          <span className="pub-footer-link">Aviso legal</span>
          <span className="pub-footer-link">Contacto</span>
        </div>
        <div className="pub-footer-main">© 2026 QueEstudiar · Búsqueda de programas académicos en España</div>
        <div className="pub-footer-geo">QueEstudiar indexa los programas oficiales del Registro de Universidades, Centros y Títulos (RUCT) del Ministerio de Educación de España y del catálogo TodaFP de Formación Profesional. Todos los programas listados son titulaciones oficiales con validez académica en España y la Unión Europea.</div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN DETECTION
// ═══════════════════════════════════════════════════════════════════════════
const HOST = window.location.hostname;
const IS_PUBLIC_DOMAIN = HOST === "queestudiar.es" || HOST === "www.queestudiar.es";
const IS_ADMIN_DOMAIN = HOST === "app.queestudiar.es";

// Navigation helper — history routing on public domain, hash on admin/localhost
function navigate(path) {
  if (IS_PUBLIC_DOMAIN) {
    history.pushState(null, '', path);
    // Update canonical tag
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = 'https://queestudiar.es' + path;
    window.dispatchEvent(new PopStateEvent('popstate'));
  } else {
    location.hash = path.startsWith('#') ? path : '#' + path;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

function AdminDashboard({ students, docsPendientes, user, onNavigate }) {
  const counts = students.reduce((acc, s) => {
    acc[s.status || "nuevo"] = (acc[s.status || "nuevo"] || 0) + 1;
    return acc;
  }, {});

  const METRICS = [
    { label: "Total expedientes", value: students.length,        color: "var(--accent)",                                          filter: "all" },
    { label: "En proceso",        value: counts.en_proceso || 0, color: "#7c3aed",                                                filter: "en_proceso" },
    { label: "Docs pendiente",    value: docsPendientes ?? "…",  color: docsPendientes > 0 ? "#e8531a" : "var(--muted)",          filter: null },
    { label: "Cerrados total",    value: counts.cerrado || 0,    color: (counts.cerrado || 0) > 0 ? "#16a34a" : "var(--muted)",   filter: "cerrado" },
  ];

  const TYPE_BREAKDOWN = [
    { label: "Máster", count: students.filter(s => (s.desired_program_type || s.education_level || "").toLowerCase().includes("master")).length },
    { label: "Grado",  count: students.filter(s => (s.desired_program_type || s.education_level || "").toLowerCase().includes("grado")).length },
    { label: "FP",     count: students.filter(s => (s.desired_program_type || s.education_level || "").toLowerCase().includes("fp")).length },
    { label: "Otro",   count: students.filter(s => { const t = (s.desired_program_type || s.education_level || "").toLowerCase(); return !t.includes("master") && !t.includes("grado") && !t.includes("fp"); }).length },
  ].filter(r => r.count > 0);

  const UPCOMING_DATES = [
    { label: "PCE/UNED",               fecha: "Mayo 2026",    past: false },
    { label: "Preinscripción pública",  fecha: "Jun–Jul 2026", past: false },
    { label: "Másters públicos",        fecha: "Feb–Abr 2026", past: true  },
    { label: "Inicio de clases",        fecha: "Sep 2026",     past: false },
  ];

  const recentStudents = [...students]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5);

  const STATUS_COLORS = { nuevo: "#2563eb", contactado: "#ca8a04", en_proceso: "#7c3aed", cerrado: "#16a34a", descartado: "#dc2626" };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 960, margin: "0 auto", overflowY: "auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 22, color: "var(--text)", marginBottom: 4 }}>
          Dashboard
        </div>
        <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>
          Hola, {user?.name} · {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
        </div>
      </div>

      {/* Métricas principales */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {METRICS.map(({ label, value, color, filter }) => (
          <div key={label}
            onClick={() => filter !== null && onNavigate("expedientes", null, filter)}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "16px 18px", borderTop: `3px solid ${color}`, cursor: filter !== null ? "pointer" : "default", transition: "box-shadow 0.15s" }}
            onMouseEnter={e => { if (filter !== null) e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}
          >
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10, fontFamily: "var(--mono)", color: "var(--muted)", marginTop: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Expedientes recientes */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 9, fontFamily: "var(--mono)", color: "var(--muted)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>Expedientes recientes</div>
          {recentStudents.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>Sin expedientes</div>
          ) : recentStudents.map(s => {
            const status = s.status || "nuevo";
            const col = STATUS_COLORS[status] || "#2563eb";
            return (
              <div key={s.id} onClick={() => onNavigate("expedientes", s)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{s.full_name}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)" }}>{s.email}</div>
                </div>
                <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 12, background: col + "22", color: col, fontFamily: "var(--mono)" }}>
                  {STATUS_CONFIG[status]?.label || status}
                </span>
              </div>
            );
          })}
          <button onClick={() => onNavigate("expedientes")}
            style={{ marginTop: 10, fontSize: 11, fontFamily: "var(--mono)", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Ver todos los expedientes →
          </button>
        </div>

        {/* Desglose + fechas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 9, fontFamily: "var(--mono)", color: "var(--muted)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>Tipos de estudio</div>
            {TYPE_BREAKDOWN.length === 0
              ? <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>Sin datos</div>
              : TYPE_BREAKDOWN.map(({ label, count }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ color: "var(--text)", fontFamily: "var(--mono)" }}>{label}</span>
                  <span style={{ color: "var(--accent)", fontFamily: "var(--mono)", fontWeight: 700 }}>{count}</span>
                </div>
              ))}
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 9, fontFamily: "var(--mono)", color: "var(--muted)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>Próximas fechas clave</div>
            {UPCOMING_DATES.map(({ label, fecha, past }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 10, padding: "4px 0", borderBottom: "1px solid var(--border)", opacity: past ? 0.55 : 1 }}>
                <span style={{ color: "var(--muted)", fontFamily: "var(--mono)" }}>{past ? "✓ " : ""}{label}</span>
                <span style={{ color: past ? "var(--muted)" : "var(--accent)", fontFamily: "var(--mono)", textDecoration: past ? "line-through" : "none" }}>{fecha}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP COMPONENT (with hash routing)
// ═══════════════════════════════════════════════════════════════════════════

export default function App() {
  // Public domain uses pathname; admin/localhost use hash
  const getInitialRoute = () => {
    if (IS_PUBLIC_DOMAIN) return location.pathname || "/";
    return IS_ADMIN_DOMAIN && !window.location.hash ? "#/admin" : (window.location.hash || "#/");
  };
  const [route, setRoute] = useState(getInitialRoute);
  const [user, setUser] = useState(null);
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [adminView, setAdminView] = useState("dashboard"); // "dashboard" | "expedientes" | "usuarios" | "feedback"
  const [feedbackPrompt, setFeedbackPrompt] = useState(null);
  const [teamMembers, setTeamMembers] = useState(TEAM_FALLBACK);
  const [docsPendientes, setDocsPendientes] = useState(null);
  const [matchCounts, setMatchCounts] = useState({});
  const [matchCountsLoaded, setMatchCountsLoaded] = useState(false);

  // Routing: popstate on public domain, hashchange on admin/localhost
  useEffect(() => {
    if (IS_PUBLIC_DOMAIN) {
      const onPop = () => setRoute(location.pathname || "/");
      window.addEventListener("popstate", onPop);
      return () => window.removeEventListener("popstate", onPop);
    } else {
      const onHash = () => setRoute(window.location.hash || "#/");
      window.addEventListener("hashchange", onHash);
      return () => window.removeEventListener("hashchange", onHash);
    }
  }, []);

  // Restaurar sesión al cargar
  useEffect(() => {
    async function restoreSession() {
      const session = loadSession();
      if (!session) return;
      if (session.needsRefresh && session.refresh_token) {
        try {
          const refreshed = await authRefreshToken(session.refresh_token);
          saveSession(refreshed);
          setAccessToken(refreshed.access_token);
          setUser({
            name: refreshed.user.user_metadata?.name || refreshed.user.email.split("@")[0],
            email: refreshed.user.email,
            id: refreshed.user.id,
            role: refreshed.user.user_metadata?.role || "team",
          });
        } catch {
          clearSession();
        }
      } else {
        setAccessToken(session.access_token);
        setUser(session.user);
      }
    }
    restoreSession();
  }, []);
  useEffect(() => {
    if (user && user.role !== 'cliente') {
      loadStudents();
      if (user.role === "admin") {
        // Cargar miembros del equipo para asignación
        adminListUsers().then(users => {
          const team = users.filter(u => u.user_metadata?.role === "team").map(u => ({ email: u.email, name: u.user_metadata?.name || u.email.split("@")[0] }));
          setTeamMembers(team.length > 0 ? team : TEAM_FALLBACK);
        }).catch(() => { setTeamMembers(TEAM_FALLBACK); });
      }
    }
  }, [user]);

  async function loadDocsPendientes() {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/student_documents?select=id,status&or=(status.eq.pendiente,status.eq.necesita_correccion)`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json();
      setDocsPendientes(Array.isArray(data) ? data.length : 0);
    } catch { setDocsPendientes(0); }
  }

  async function loadMatchCounts() {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/matches?select=student_id`,
        { headers: getAuthHeaders() }
      );
      const data = await res.json();
      if (!Array.isArray(data)) return;
      const counts = data.reduce((acc, m) => {
        if (m.student_id) acc[m.student_id] = (acc[m.student_id] || 0) + 1;
        return acc;
      }, {});
      setMatchCounts(counts);
      setMatchCountsLoaded(true);
    } catch { /* silencioso */ }
  }

  async function loadStudents() {
    setLoading(true);
    try {
      const url = `${SUPABASE_URL}/rest/v1/student_leads?select=*&order=created_at.desc`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setStudents(list);
      if (list.length > 0 && !selected) setSelected(list[0]);
    } catch { setStudents([]); }
    setLoading(false);
    loadDocsPendientes();
    loadMatchCounts();
  }

  function handleLogin(u) { setUser(u); }
  async function handleLogout() {
    try {
      const session = loadSession();
      if (session?.access_token) await authSignOut(session.access_token);
    } catch {}
    clearSession();
    setAccessToken(null);
    setUser(null);
    setStudents([]);
    setSelected(null);
  }
  async function handleStatusChange(id, status) {
    await patch("student_leads", id, { status });
    setStudents(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    if (selected?.id === id) setSelected(prev => ({ ...prev, status }));
    setFeedbackPrompt("cambio_estado");
  }
  function handleNotesSave(id, notes) {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, notes } : s));
    setFeedbackPrompt("guardar_notas");
  }
  async function handleAssign(id, email) {
    const val = email || null;
    await patch("student_leads", id, { assigned_to: val });
    setStudents(prev => prev.map(s => s.id === id ? { ...s, assigned_to: val } : s));
    if (selected?.id === id) setSelected(prev => ({ ...prev, assigned_to: val }));
  }

  // ── DOMAIN-BASED ROUTING ──
  // On public domain (queestudiar.es): redirect admin attempts to app.queestudiar.es
  if (IS_PUBLIC_DOMAIN && (route.startsWith("#/admin") || route.startsWith("/admin"))) {
    window.location.href = "https://app.queestudiar.es/#/admin";
    return null;
  }

  // Portal route — available on all domains
  if (route === "#/portal" || route === "/portal") {
    if (!user) return <><style>{css}</style><Login onLogin={handleLogin} /></>;
    if (user.role === 'cliente') return <PortalCliente currentUser={user} onLogout={handleLogout} />;
    location.hash = "#/admin";
    return null;
  }

  // Public routes (pathname on public domain, hash on admin/localhost)
  if (IS_PUBLIC_DOMAIN || !route.startsWith("#/admin")) {
    return <PublicApp route={route} />;
  }

  // If authenticated as cliente and somehow on admin route → redirect to portal
  if (user?.role === 'cliente') {
    location.hash = "#/portal";
    return null;
  }

  // ── ADMIN ROUTES ──
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
        <div className="header-right">
          <div className="user-badge">{user.name}</div>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { key: "dashboard",   label: "📊 Dashboard",    roles: ["admin", "team"] },
              { key: "expedientes", label: "📁 Expedientes",   roles: ["admin", "team"] },
              { key: "usuarios",    label: "👤 Usuarios",      roles: ["admin"] },
              { key: "feedback",    label: "💬 Feedback",      roles: ["admin"] },
            ].filter(({ roles }) => roles.includes(user.role)).map(({ key, label }) => (
              <button key={key} onClick={() => setAdminView(key)} style={{
                fontSize: 11, fontFamily: "var(--mono)", padding: "5px 12px",
                borderRadius: 6, border: "1px solid var(--border)", cursor: "pointer",
                background: adminView === key ? "var(--accent)" : "var(--surface)",
                color: adminView === key ? "#fff" : "var(--muted)",
              }}>{label}</button>
            ))}
          </div>
          <button className="btn-ghost" onClick={() => { loadStudents(); loadMatchCounts(); }}>↻ Actualizar</button>
          <button className="btn-ghost" onClick={() => window.location.href = "https://queestudiar.es"}>Web pública</button>
          <button className="btn-ghost" onClick={handleLogout}>Salir</button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      {adminView === "dashboard" && (
        <div className="main" style={{ overflow: "auto" }}>
          <AdminDashboard
            students={students}
            docsPendientes={docsPendientes}
            user={user}
            onNavigate={(view, studentToSelect, filter) => {
              setAdminView(view);
              if (studentToSelect) setSelected(studentToSelect);
              if (filter !== undefined) setFilterStatus(filter || "all");
            }}
          />
        </div>
      )}

      {adminView === "expedientes" && (
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
              {loading
                ? <div className="loading" style={{ height: 200 }}><div className="spinner" /> Cargando...</div>
                : filtered.length === 0
                  ? <div className="empty" style={{ height: 200 }}><div className="empty-icon">◆</div><div className="empty-text">Sin estudiantes{search ? " con ese filtro" : " aún"}</div></div>
                  : filtered.map(s => {
                    const sc = STATUS_CONFIG[s.status || "nuevo"];
                    const nMatches = matchCountsLoaded ? (matchCounts[s.id] || 0) : null;
                    const dias = daysSince(s.status_updated_at || s.created_at);
                    const isStale = (s.status === "nuevo" || !s.status) && dias !== null && dias > 14;
                    const hasPortal = !!s.client_user_id;
                    const asesorName = TEAM_FALLBACK.find(t => t.email === s.assigned_to)?.name;
                    return (
                      <div key={s.id} className={`student-item ${selected?.id === s.id ? "active" : ""}`} onClick={() => setSelected(s)}>
                        {/* Fila 1: nombre + indicadores */}
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                          <div className="student-name" style={{ flex: 1 }}>{s.full_name || "Sin nombre"}</div>
                          {hasPortal && <span title="Con acceso al portal" style={{ fontSize: 10 }}>🔑</span>}
                          {isStale && (
                            <span title={`${dias} días sin avanzar`} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 8, background: "#fef9c3", color: "#ca8a04", fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>
                              {dias}d
                            </span>
                          )}
                        </div>
                        {/* Fila 2: email · país */}
                        <div className="student-meta">{s.email || "—"} · {s.country_of_origin || "—"}</div>
                        {/* Fila 3: tipo de estudio · asesor */}
                        <div className="match-count">
                          {(s.desired_program_type || s.education_level) ? `${s.desired_program_type || s.education_level}` : "Tipo no definido"}
                          {asesorName ? ` · ${asesorName}` : ""}
                        </div>
                        {/* Fila 4: estado + badge de matches */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                          <div className="student-status" style={{ color: sc.color, background: sc.bg }}>{sc.label}</div>
                          {nMatches !== null ? (
                            <span style={{
                              fontSize: 9, padding: "1px 6px", borderRadius: 8, fontFamily: "var(--mono)", whiteSpace: "nowrap",
                              background: nMatches > 0 ? "#dcfce7" : "#fee2e2",
                              color: nMatches > 0 ? "#16a34a" : "#dc2626",
                            }}>
                              {nMatches > 0 ? `${nMatches} prog.` : "Sin matches"}
                            </span>
                          ) : (
                            <span style={{ fontSize: 9, color: "var(--muted)", fontFamily: "var(--mono)" }}>…</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
          {selected
            ? <StudentDetail key={selected.id} student={selected} onStatusChange={handleStatusChange} onNotesSave={handleNotesSave} currentUser={user} onAssign={handleAssign} teamMembers={teamMembers} />
            : <div className="detail"><div className="empty"><div className="empty-icon">◉</div><div className="empty-text">Selecciona un estudiante para ver su expediente</div></div></div>
          }
        </div>
      )}

      {adminView === "usuarios" && (
        <div className="main"><UserManagement onClose={() => setAdminView("dashboard")} /></div>
      )}

      {adminView === "feedback" && (
        <div className="main"><FeedbackReview onClose={() => setAdminView("dashboard")} /></div>
      )}

    </div>
    {feedbackPrompt && <FeedbackPopup actionType={feedbackPrompt} userName={user.name} userEmail={user.email} onClose={() => setFeedbackPrompt(null)} />}
    </>
  );
}
