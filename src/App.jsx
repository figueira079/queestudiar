import { useState, useEffect, useCallback } from "react";

// ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ CONFIG ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;

// ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ AUTH HELPERS ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ
async function authSignIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error || "Error de autenticaci‚àö‚â•n");
  return data;
}

async function authRefreshToken(refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return data;
}

async function authSignOut(accessToken) {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${accessToken}` },
  });
}

// Gesti‚àö‚â•n de sesi‚àö‚â•n
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
  const token = _accessToken || SUPABASE_KEY;
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
}

const STATUS_CONFIG = {
  nuevo:       { label: "Nuevo",        color: "#4FC3F7", bg: "#0d2a38" },
  contactado:  { label: "Contactado",   color: "#FFB74D", bg: "#2d1f0a" },
  en_proceso:  { label: "En proceso",   color: "#CE93D8", bg: "#1e0d2a" },
  cerrado:     { label: "Cerrado ‚Äö√∫√¨",    color: "#81C784", bg: "#0d2213" },
  descartado:  { label: "Descartado",   color: "#EF9A9A", bg: "#2a0d0d" },
};

// ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ SUPABASE CLIENT ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ
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

// ‚Äî‚Äî‚Äî URL MANAGEMENT & LEARNING ‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî
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

// ‚Äî‚Äî‚Äî ADMIN: USER MANAGEMENT ‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî‚Äî
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

async function adminDeleteUser(userId) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: getAdminHeaders()
  });
  if (!res.ok) throw new Error("Error al eliminar usuario");
  return true;
}


// ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ STYLES ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ‚Äö√Æ√Ñ
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
  .learning-banner { margin-bottom: 16px; padding: 12px 16px; background: #1a1500; border: 1px solid #f9731644; border-radius: 10px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; font-size: 12px; font-family: var(--mono); color: var(--text); }
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
  .user-mgmt-grid { display: flex; flex-direction: column; gap: 8px; }
  .user-card { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; transition: border-color 0.2s; }
  .user-card:hover { border-color: #2c3e5a; }
  .user-name { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
  .user-email { font-size: 11px; color: var(--muted); font-family: var(--mono); }
  .user-role { font-size: 10px; padding: 3px 10px; border-radius: 20px; border: 1px solid var(--border); font-family: var(--mono); }
  .user-role.admin { color: #CE93D8; border-color: #CE93D844; }
  .user-role.team { color: var(--accent2); border-color: var(--accent2)44; }
  .user-form { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 24px; }
  .user-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .user-form select { width: 100%; padding: 12px 16px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: var(--font); font-size: 14px; outline: none; }
  .user-form select:focus { border-color: var(--accent); }
  .success-msg { padding: 10px 16px; background: #0d2213; border: 1px solid #81C78444; border-radius: 8px; color: #81C784; font-size: 12px; font-family: var(--mono); margin-bottom: 16px; }
  .user-delete-btn { padding: 4px 8px; background: none; border: 1px solid transparent; color: var(--muted); cursor: pointer; border-radius: 4px; opacity: 0.4; transition: all 0.15s; font-size: 12px; }
  .user-delete-btn:hover { opacity: 1; border-color: #ef444488; color: #ef9a9a; }
`;

function formatDate(d) {
  if (!d) return "‚Äö√Ñ√Æ";
  return new Date(d).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function getOriginLabel(origin) {
  const map = { eu: "UE / EEE", latam_convenio: "LATAM Convenio", extracomunitario: "Extracomunitario" };
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
        ? "Email o contrase‚àö¬±a incorrectos"
        : error.message || "Error al iniciar sesi‚àö‚â•n");
    }
    setLoading(false);
  }
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">‚Äö√±‚àè QueEstudiar ¬¨‚àë Admisiones</div>
        <div className="login-title">Panel de gesti‚àö‚â•n</div>
        <div className="login-sub">Acceso restringido al equipo de admisiones</div>
        <form onSubmit={handle}>
          <div className="field"><label>Email</label><input type="email" value={email} onChange={e => { setEmail(e.target.value); setErr(""); }} autoComplete="email" placeholder="tu@queestudiar.es" /></div>
          <div className="field"><label>Contrase‚àö¬±a</label><input type="password" value={pass} onChange={e => { setPass(e.target.value); setErr(""); }} autoComplete="current-password" /></div>
          <button className="btn-primary" type="submit" disabled={loading}>{loading ? "Verificando..." : "Entrar ‚Äö√ú√≠"}</button>
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
        <div className="req-label">Ô£ø√º√¨√£ Homologaci‚àö‚â•n del t‚àö‚â†tulo</div>
        <div className="req-value">{hom.proceso || "‚Äö√Ñ√Æ"}</div>
        {hom.tasa_eur && <div style={{ marginTop: 8 }}><span className="req-pill">Tasa: {hom.tasa_eur}‚Äö√á¬®</span>{hom.modelo_tasa && <span className="req-pill">Modelo {hom.modelo_tasa}</span>}{hom.plazo_resolucion_meses && <span className="req-pill">Plazo: {hom.plazo_resolucion_meses} meses</span>}</div>}
        {hom.volante_condicional && <div style={{ marginTop: 8, fontSize: 12, color: "#FFB74D", fontFamily: "var(--mono)" }}>‚Äö√∂‚Ä† Volante Condicional disponible</div>}
      </div>
      <div className="req-block">
        <div className="req-label">Ô£ø√º√≥¬£ Requisito ling‚àö¬∫‚àö‚â†stico</div>
        <div className="req-value">Nivel m‚àö‚â†nimo: <strong>{lang.nivel_minimo || "‚Äö√Ñ√Æ"}</strong> ({lang.marco || ""})</div>
        {lang.certificados_aceptados?.length > 0 && <div style={{ marginTop: 6 }}>{lang.certificados_aceptados.map(c => <span key={c} className="req-pill">{c}</span>)}</div>}
      </div>
      {tests.nombre && (
        <div className="req-block">
          <div className="req-label">Ô£ø√º√¨√π {tests.nombre}</div>
          {tests.organismo && <div style={{ fontSize: 11, color: "var(--accent2)", fontFamily: "var(--mono)", marginBottom: 6 }}>{tests.organismo}</div>}
          <div className="req-value">{tests.descripcion || ""}</div>
          {tests.formula_nota_base && <div style={{ marginTop: 10, padding: "8px 12px", background: "#0a1020", borderRadius: 6, fontFamily: "var(--mono)", fontSize: 11, color: "var(--accent2)" }}>{tests.formula_nota_base}</div>}
          {tests.convocatorias?.map((c, i) => <div key={i} style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>Ô£ø√º√¨√ñ <strong style={{ color: "var(--text)" }}>{c.tipo}:</strong> {c.fechas_espana}{c.fechas_sedes_internacionales && ` ¬¨‚àë Internacional: ${c.fechas_sedes_internacionales}`}</div>)}
        </div>
      )}
      {scholarships.length > 0 && (
        <div className="req-block">
          <div className="req-label">Ô£ø√º√©√¨ Becas disponibles</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {scholarships.map((b, i) => (
              <div key={i} style={{ padding: "8px 12px", background: "#0a1020", borderRadius: 6, borderLeft: "2px solid var(--accent)" }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{b.nombre}</div>
                {b.organismo && <div style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>{b.organismo}</div>}
                {(b.cuantia || b.cuantia_eur) && <div style={{ fontSize: 11, color: "var(--accent2)", marginTop: 2 }}>{b.cuantia || `${b.cuantia_eur}‚Äö√á¬®`}</div>}
                {b.url && <a href={b.url} target="_blank" rel="noreferrer" style={{ fontSize: 10, color: "var(--accent)", fontFamily: "var(--mono)" }}>‚Äö√ú√≠ {b.url}</a>}
              </div>
            ))}
          </div>
        </div>
      )}
      {dates.length > 0 && (
        <div className="req-block">
          <div className="req-label">Ô£ø√º√¨√ú Calendario clave</div>
          <div className="dates-list">{dates.map((d, i) => <div key={i} className="date-item"><span className="date-hito">{d.hito}</span><span className="date-mes">{d.mes || d.fecha}</span></div>)}</div>
        </div>
      )}
      {req.notes && <div className="req-block"><div className="req-label">Ô£ø√º√¨√• Notas</div><div className="req-value" style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>{req.notes}</div></div>}
    </div>
  );
}

function RegionPanel({ regionData, studentOrigin }) {
  if (!regionData || regionData.length === 0) return <div style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--mono)" }}>Sin datos de costes para las regiones seleccionadas.</div>;
  const isNonEU = studentOrigin === "extracomunitario";
  const ptypeLabel = { "fp_superior": "FP Grado Superior", "university_bachelor": "Grado Universitario", "university_master": "M‚àö¬∞ster" };
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
              <div style={{ fontSize: 20, fontWeight: 800, color: r.public_cost_eur === 0 ? "#81C784" : "var(--accent)" }}>
                {r.public_cost_eur === 0 ? "Gratuito" : `${r.public_cost_eur?.toLocaleString("es-ES")}‚Äö√á¬®`}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)" }}>p‚àö‚à´blico UE / a‚àö¬±o</div>
              {isNonEU && r.non_eu_surcharge && (
                <div style={{ fontSize: 11, color: "#FFB74D", fontFamily: "var(--mono)", marginTop: 2 }}>‚Äö√∂‚Ä† +recargo no-UE</div>
              )}
            </div>
          </div>
          {r.private_cost_range && <div style={{ marginBottom: 8 }}><span className="req-pill">Privado: {r.private_cost_range}‚Äö√á¬®/a‚àö¬±o</span>{r.non_eu_surcharge && <span className="req-pill" style={{ color: "#FFB74D" }}>‚Äö√∂‚Ä† Recargo no-UE</span>}</div>}
          {r.key_dates?.length > 0 && <div className="dates-list" style={{ marginBottom: 8 }}>{r.key_dates.map((d, j) => <div key={j} className="date-item"><span className="date-hito">{d.hito}</span><span className="date-mes">{d.fecha || d.mes}</span></div>)}</div>}
          {r.platform_url && <a href={r.platform_url} target="_blank" rel="noreferrer" className="url-btn" style={{ marginTop: 4 }}>‚Äö√ú√≥ Portal de admisi‚àö‚â•n</a>}
          {r.notes && <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted)", lineHeight: 1.6, fontFamily: "var(--mono)" }}>{r.notes}</div>}
        </div>
      ))}
    </div>
  );
}

function UrlBtn({ url, status, label, style: extraStyle }) {
  if (!url) return null;
  if (status === "rota") {
    return <span className="url-rota" title="URL rota o no disponible">‚ö† {label}: no disponible</span>;
  }
  if (status === "generica") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="url-btn url-generica" title="URL gen√©rica ‚Äî redirige a la web principal de la instituci√≥n" style={extraStyle}>
        üåê {label}
      </a>
    );
  }
  if (status === "manual_ok") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="url-btn url-manual-ok" title="URL verificada manualmente por el equipo" style={extraStyle}>
        ‚úÖ {label}
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="url-btn url-ok" style={extraStyle}>
      ‚Üó {label}
    </a>
  );
}

function EditableUrlBtn({ url, status, label, style: extraStyle, programId, field, onUrlUpdated }) {
  const [editing, setEditing] = useState(false);
  const [newUrl, setNewUrl] = useState(url || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setNewUrl(url || ""); setEditing(false); }, [url]);

  async function handleSave() {
    const trimmed = newUrl.trim();
    if (!trimmed || trimmed === url) { setEditing(false); return; }
    setSaving(true);
    await updateProgramUrl(programId, field, trimmed);
    setSaving(false);
    setEditing(false);
    if (onUrlUpdated) onUrlUpdated(programId, field, trimmed, url);
  }

  if (editing) {
    return (
      <div className="url-edit-row">
        <input className="url-edit-input" value={newUrl} onChange={e => setNewUrl(e.target.value)}
          placeholder={"URL de " + label.toLowerCase()}
          onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setEditing(false); setNewUrl(url || ""); } }}
          autoFocus />
        <button className="url-edit-btn save" onClick={handleSave} disabled={saving}>{saving ? "‚Ä¶" : "‚úì"}</button>
        <button className="url-edit-btn" onClick={() => { setEditing(false); setNewUrl(url || ""); }}>‚úï</button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <UrlBtn url={url} status={status} label={label} style={extraStyle} />
      <button className="url-pencil" onClick={() => setEditing(true)} title="Editar URL">‚úèÔ∏è</button>
    </div>
  );
}

function generateExpedienteReport(student, matches, requirements, regionData) {
  const now = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
  const originMap = { eu: "UE / EEE", latam_convenio: "LATAM Convenio", extracomunitario: "Extracomunitario" };
  const typeMap = { grado: "Grado", master: "M‚àö¬∞ster", fp_superior: "FP Superior", doctorado: "Doctorado", bachillerato: "Bachillerato" };
  const cities = Array.isArray(student.preferred_cities) ? student.preferred_cities.join(", ") : (student.preferred_cities || "‚Äö√Ñ√Æ");
  const programType = typeMap[student.desired_program_type] || typeMap[student.education_level] || "‚Äö√Ñ√Æ";

  let r = `‚Äö√Ø√™‚Äö√Ø√™‚Äö√Ø√™ INFORME DE EXPEDIENTE ‚Äö√Ø√™‚Äö√Ø√™‚Äö√Ø√™\nGenerado: ${now}\n\n`;
  r += `‚Äö√±‚àè DATOS DEL ESTUDIANTE\n`;
  r += `  Nombre: ${student.full_name || "‚Äö√Ñ√Æ"}\n`;
  r += `  Email: ${student.email || "‚Äö√Ñ√Æ"}\n`;
  r += `  Pa‚àö‚â†s: ${student.country_of_origin || "‚Äö√Ñ√Æ"}\n`;
  r += `  Origen: ${originMap[student.student_origin] || student.student_origin || "‚Äö√Ñ√Æ"}\n`;
  r += `  Nivel educativo: ${typeMap[student.education_level] || student.education_level || "‚Äö√Ñ√Æ"}\n`;
  r += `  Programa deseado: ${programType}\n`;
  r += `  ‚àö√Örea de estudio: ${student.study_area || "‚Äö√Ñ√Æ"}\n`;
  r += `  Ciudades preferidas: ${cities}\n`;
  if (student.base_degree) r += `  Titulaci‚àö‚â•n base: ${student.base_degree}\n`;

  r += `\n‚Äö√±‚àè PROGRAMAS ASIGNADOS (${matches.length})\n`;
  if (matches.length > 0) {
    const byArea = {};
    matches.forEach(m => {
      const area = m.programas?.familia_area || "Sin ‚àö¬∞rea";
      if (!byArea[area]) byArea[area] = [];
      byArea[area].push(m);
    });
    Object.entries(byArea).sort().forEach(([area, ms]) => {
      r += `  [${area}] ‚Äö√Ñ√Æ ${ms.length} programa${ms.length > 1 ? "s" : ""}\n`;
      ms.slice(0, 5).forEach(m => {
        const p = m.programas || {};
        const price = student.student_origin === "extracomunitario" && p.precio_extracomunitario_eur != null ? p.precio_extracomunitario_eur : p.precio_anual_eur;
        r += `    ‚Äö√Ñ¬¢ ${p.nombre || "?"} (${p.ciudad || "?"})`;
        if (price != null) r += ` ‚Äö√Ñ√Æ ${price === 0 ? "Gratuito" : price.toLocaleString("es-ES") + "‚Äö√á¬®/a‚àö¬±o"}`;
        r += `\n`;
      });
      if (ms.length > 5) r += `    ... y ${ms.length - 5} m‚àö¬∞s\n`;
    });
  } else {
    r += `  Sin programas asignados\n`;
  }

  if (requirements) {
    r += `\n‚Äö√±‚àè REQUISITOS DE ADMISI‚àö√¨N\n`;
    const hom = requirements.homologacion || {};
    if (hom.proceso) r += `  Homologaci‚àö‚â•n: ${hom.proceso}\n`;
    if (hom.tasa_eur) r += `  Tasa homologaci‚àö‚â•n: ${hom.tasa_eur}‚Äö√á¬®\n`;
    if (hom.plazo_resolucion_meses) r += `  Plazo resoluci‚àö‚â•n: ${hom.plazo_resolucion_meses} meses\n`;
    const lang = requirements.language_req || {};
    if (lang.nivel_minimo) r += `  Idioma m‚àö‚â†nimo: ${lang.nivel_minimo} (${lang.marco || ""})\n`;
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
    r += `\n‚Äö√±‚àè COSTES POR REGI‚àö√¨N\n`;
    regionData.forEach(reg => {
      r += `  ${reg.region} (${reg.program_type}): `;
      r += reg.public_cost_eur === 0 ? "Gratuito" : `${reg.public_cost_eur?.toLocaleString("es-ES")}‚Äö√á¬®/a‚àö¬±o p‚àö‚à´blico`;
      if (reg.private_cost_range) r += ` | Privado: ${reg.private_cost_range}‚Äö√á¬®/a‚àö¬±o`;
      r += `\n`;
    });
  }

  r += `\n‚Äö√±‚àè CHECKLIST DE SEGUIMIENTO\n`;
  r += `  [ ] Documentaci‚àö‚â•n acad‚àö¬©mica recibida\n`;
  r += `  [ ] Homologaci‚àö‚â•n del t‚àö‚â†tulo iniciada\n`;
  if (requirements?.language_req?.nivel_minimo) r += `  [ ] Certificado de idioma presentado\n`;
  if (requirements?.access_tests?.nombre) r += `  [ ] Inscripci‚àö‚â•n en ${requirements.access_tests.nombre}\n`;
  r += `  [ ] Solicitud de admisi‚àö‚â•n enviada\n`;
  r += `  [ ] Confirmaci‚àö‚â•n de plaza recibida\n`;
  r += `  [ ] Matr‚àö‚â†cula formalizada\n`;
  if (student.student_origin === "extracomunitario") {
    r += `  [ ] Visado de estudiante solicitado\n`;
    r += `  [ ] Seguro m‚àö¬©dico contratado\n`;
  }

  r += `\n‚Äö√±‚àè OBSERVACIONES\n`;
  r += `  (A‚àö¬±adir notas manuales aqu‚àö‚â†)\n`;
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
    try {
      const list = await adminListUsers();
      setUsers(list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch { setUsers([]); }
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
          <div className="detail-name">Gesti\u00f3n de usuarios</div>
          <div style={{ fontSize: 12, color: "var(--muted)", fontFamily: "var(--mono)", marginTop: 4 }}>Crear y gestionar cuentas del equipo de admisiones</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="save-btn" style={{ marginTop: 0 }} onClick={() => { setShowForm(!showForm); setError(""); }}>{showForm ? "\u2715 Cancelar" : "+ Nuevo usuario"}</button>
          <button className="btn-ghost" onClick={onClose}>\u2190 Volver</button>
        </div>
      </div>

      {success && <div className="success-msg">\u2705 {success}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="user-form">
          <div style={{ fontSize: 10, fontFamily: "var(--mono)", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 16 }}>Nuevo usuario</div>
          <div className="user-form-grid">
            <div className="field"><label>Nombre completo</label><input value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} required placeholder="Mar\u00eda Garc\u00eda" /></div>
            <div className="field"><label>Email</label><input type="email" value={formData.email} onChange={e => setFormData(p => ({...p, email: e.target.value}))} required placeholder="maria@queestudiar.es" /></div>
            <div className="field"><label>Contrase\u00f1a</label><input type="password" value={formData.password} onChange={e => setFormData(p => ({...p, password: e.target.value}))} required minLength={6} placeholder="M\u00edn. 6 caracteres" /></div>
            <div className="field"><label>Rol</label><select className="user-form" value={formData.role} onChange={e => setFormData(p => ({...p, role: e.target.value}))}><option value="team">Equipo</option><option value="admin">Administrador</option></select></div>
          </div>
          {error && <div className="login-err" style={{ textAlign: "left", marginTop: 8 }}>{error}</div>}
          <button className="btn-primary" type="submit" disabled={creating} style={{ width: "auto", marginTop: 16, padding: "10px 28px" }}>{creating ? "Creando..." : "Crear usuario \u2192"}</button>
        </form>
      )}

      {loading ? <div className="loading" style={{ height: 200 }}><div className="spinner" /> Cargando usuarios...</div>
      : users.length === 0 ? <div className="empty" style={{ height: 200 }}><div className="empty-icon">\u25cb</div><div className="empty-text">No hay usuarios registrados</div></div>
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
                <span style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--mono)" }}>{new Date(u.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</span>
                <button className="user-delete-btn" onClick={() => handleDelete(u)} title="Eliminar usuario">\ud83d\uddd1</button>
              </div>
            </div>
          ))}
        </div>
      )}
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
  const [filterArea, setFilterArea] = useState("all");
  const [urlLearning, setUrlLearning] = useState(null);
  const [applyingLearning, setApplyingLearning] = useState(false);

  useEffect(() => { setNotes(student.notes || ""); setTab("matches"); setFilterArea("all"); setUrlLearning(null); }, [student.id]);
  useEffect(() => { loadMatches(); loadRequirements(); }, [student.id]);

  async function loadMatches() {
    setLoadingMatches(true);
    try {
      const data = await query("matches", "*, programas(nombre, ciudad, tipo, familia_area, url_solicitud, url_solicitud_status, url_detalle, url_detalle_status, modalidad, idioma, precio_anual_eur, precio_extracomunitario_eur)", { student_id: student.id });
      setMatches(Array.isArray(data) ? data : []);
    } catch { setMatches([]); }
    setLoadingMatches(false);
  }

  async function loadRequirements() {
    try {
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
      const ptype = ptypeMap[student.desired_program_type] || ptypeMapLegacy[student.education_level] || "university_bachelor";
      const origin = student.student_origin || "extracomunitario";
      const reqs = await query("admission_requirements", "*", { program_type: ptype, student_origin: origin });
      if (Array.isArray(reqs) && reqs.length > 0) setRequirements(reqs[0]);
      const cityToRegion = {
        "Madrid": "Madrid", "Barcelona": "Catalu‚àö¬±a", "Valencia": "Comunidad Valenciana",
        "Sevilla": "Andaluc‚àö‚â†a", "M‚àö¬∞laga": "Andaluc‚àö‚â†a", "Granada": "Andaluc‚àö‚â†a",
        "Bilbao": "Pa‚àö‚â†s Vasco", "San Sebasti‚àö¬∞n": "Pa‚àö‚â†s Vasco", "Vitoria": "Pa‚àö‚â†s Vasco",
        "Zaragoza": "Arag‚àö‚â•n", "Pamplona": "Navarra", "Santander": "Cantabria",
        "A Coru‚àö¬±a": "Galicia", "Santiago de Compostela": "Galicia", "Vigo": "Galicia",
        "Murcia": "Murcia", "Alicante": "Comunidad Valenciana", "Castell‚àö‚â•n": "Comunidad Valenciana",
        "Valladolid": "Castilla y Le‚àö‚â•n", "Salamanca": "Castilla y Le‚àö‚â•n",
        "Toledo": "Castilla-La Mancha", "Albacete": "Castilla-La Mancha",
        "Palma de Mallorca": "Islas Baleares", "Las Palmas": "Canarias", "Santa Cruz de Tenerife": "Canarias",
        "Oviedo": "Asturias", "Logro‚àö¬±o": "La Rioja", "M‚àö¬©rida": "Extremadura",
      };
      const studentCities = Array.isArray(student.preferred_cities) ? student.preferred_cities : [];
      const regions = [...new Set(studentCities.map(c => cityToRegion[c]).filter(Boolean))];
      let regionResults = [];
      if (regions.length > 0) {
        const regionParam = regions.map(r => encodeURIComponent(r)).join(",");
        const url = `${SUPABASE_URL}/rest/v1/admission_by_region?select=*&program_type=eq.${ptype}&region=in.(${regionParam})`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        regionResults = await res.json();
      }
      if (!Array.isArray(regionResults) || regionResults.length === 0) {
        const fallback = await query("admission_by_region", "*", { program_type: ptype });
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
          <div className="detail-meta-item">Email: <span>{student.email || "‚Äö√Ñ√Æ"}</span></div>
          <div className="detail-meta-item">Pa‚àö‚â†s: <span>{student.country_of_origin || "‚Äö√Ñ√Æ"}</span></div>
          <div className="detail-meta-item">Origen: <span>{getOriginLabel(student.student_origin)}</span></div>
          <div className="detail-meta-item">Recibido: <span>{formatDate(student.created_at)}</span></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <select className="status-select" value={student.status || "nuevo"} onChange={e => onStatusChange(student.id, e.target.value)} style={{ color: sc.color, borderColor: sc.color, background: sc.bg }}>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {(student.desired_program_type || student.education_level) && <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>Programa deseado: <span style={{ color: "var(--text)" }}>{student.desired_program_type || student.education_level}</span></div>}
          {student.base_degree && <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>Titulaci‚àö‚â•n base: <span style={{ color: "var(--text)" }}>{student.base_degree}</span></div>}
          {student.preferred_cities && <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>Ciudades: <span style={{ color: "var(--text)" }}>{Array.isArray(student.preferred_cities) ? student.preferred_cities.join(", ") : student.preferred_cities}</span></div>}
          {student.study_area && <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--muted)" }}>‚àö√Örea: <span style={{ color: "var(--text)" }}>{student.study_area}</span></div>}
        </div>
      </div>
      <div className="tabs">
        {[["matches", `Matches (${matches.length})`], ["requisitos", "Requisitos admisi‚àö‚â•n"], ["region", "Costes y plazos"], ["notas", "Notas expediente"]].map(([k, l]) => (
          <div key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{l}</div>
        ))}
      </div>
      {tab === "matches" && (
        <div className="section">
          {loadingMatches ? <div className="loading"><div className="spinner" /> Cargando programas...</div>
          : matches.length === 0 ? <div style={{ color: "var(--muted)", fontSize: 13, fontFamily: "var(--mono)", padding: "20px 0" }}>Sin matches a‚àö‚à´n. N8N los guardar‚àö¬∞ cuando el estudiante complete el formulario.</div>
          : (() => {
              const areas = ["all", ...Array.from(new Set(matches.map(m => m.programas?.familia_area).filter(Boolean))).sort()];
              const filtered = filterArea === "all" ? matches : matches.filter(m => m.programas?.familia_area === filterArea);
              return (
                <>
                  {areas.length > 2 && (
                    <div style={{ marginBottom: 16, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {areas.map(a => (
                        <div key={a} className={`filter-chip ${filterArea === a ? "active" : ""}`} onClick={() => setFilterArea(a)}>
                          {a === "all" ? `Todas las ‚àö¬∞reas (${matches.length})` : `${a} (${matches.filter(m => m.programas?.familia_area === a).length})`}
                        </div>
                      ))}
                    </div>
                  )}
                  {urlLearning && (
                    <div className="learning-banner">
                      <span>üß†</span>
                      <span><span className="learning-count">{urlLearning.appliedCount > 0 ? `‚úÖ ${urlLearning.appliedCount}` : urlLearning.programs.length}</span>{urlLearning.appliedCount > 0 ? " programas corregidos" : ` programa${urlLearning.programs.length > 1 ? "s" : ""} m√°s ten√≠an esta misma URL gen√©rica`}</span>
                      {!urlLearning.appliedCount && <button className="learning-btn apply" onClick={applyLearning} disabled={applyingLearning}>{applyingLearning ? "Aplicando..." : "‚úì Corregir todos"}</button>}
                      <button className="learning-btn dismiss" onClick={() => setUrlLearning(null)}>{urlLearning.appliedCount > 0 ? "Cerrar" : "Ignorar"}</button>
                    </div>
                  )}
                  <div className="program-grid">{filtered.map((m, i) => { const p = m.programas || {};
                    const isNonEU = student.student_origin === "extracomunitario";
                    const price = isNonEU && p.precio_extracomunitario_eur != null ? p.precio_extracomunitario_eur : p.precio_anual_eur;
                    const priceLabel = isNonEU && p.precio_extracomunitario_eur !== p.precio_anual_eur ? "no-UE" : "UE/residente";
                    return (
                    <div key={i} className="program-card">
                      <div className="program-name">{p.nombre || "Programa sin nombre"}</div>
                      <div className="program-inst">{p.ciudad || "‚Äö√Ñ√Æ"}</div>
                      <div className="program-tags">
                        {p.tipo && <span className="tag highlight">{p.tipo}</span>}
                        {p.modalidad && <span className="tag">{p.modalidad}</span>}
                        {p.familia_area && <span className="tag">{p.familia_area}</span>}
                        {p.idioma && <span className="tag">{p.idioma}</span>}
                        {price != null && <span className="tag" style={{ color: "#81C784", borderColor: "#81C78444" }}>{price === 0 ? "Gratuito" : `${price.toLocaleString("es-ES")}‚Äö√á¬®/a‚àö¬±o`} ¬¨‚àë {priceLabel}</span>}
                      </div>
                      <div className="program-footer">
                        <EditableUrlBtn url={p.url_solicitud} status={p.url_solicitud_status} label="Solicitud" programId={m.programa_id} field="url_solicitud" onUrlUpdated={handleUrlUpdated} />
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
            {" ¬¨‚àë "}
            <span style={{ color: "var(--accent2)" }}>
              {{ "grado": "Grado Universitario", "fp_superior": "FP Grado Superior", "master": "M‚àö¬∞ster", "doctorado": "Doctorado" }[student.desired_program_type]
              || { "bachillerato": "Grado Universitario", "fp_superior": "FP Grado Superior", "grado": "M‚àö¬∞ster", "master": "M‚àö¬∞ster" }[student.education_level]
              || "Programa"}
            </span>
          </div>
          {(student.desired_program_type === "grado" || (!student.desired_program_type && student.education_level === "bachillerato")) && (
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "#1c1500", border: "1px solid #FFB74D44", borderRadius: 8, fontSize: 11, fontFamily: "var(--mono)", color: "#FFB74D", lineHeight: 1.7 }}>
              ‚Äö√∂‚Ä† <strong>PCE (UNED):</strong> Requerida para carreras con nota de corte: Medicina, Enfermer‚àö‚â†a, Psicolog‚àö‚â†a, Ingenier‚àö‚â†as. Excepci‚àö‚â•n: estudiantes colombianos con Saber 11.
            </div>
          )}
          <RequirementsPanel req={requirements} />
        </div>
      )}
      {tab === "region" && <div className="section"><RegionPanel regionData={regionData} studentOrigin={student.student_origin} /></div>}
      {tab === "notas" && <div className="section">
        <div className="section-title">Notas del expediente</div>
        <button className="save-btn" style={{ marginBottom: 12, background: "var(--accent2)" }} onClick={() => {
          const report = generateExpedienteReport(student, matches, requirements, regionData);
          setNotes(prev => prev ? prev + "\n\n" + report : report);
        }}>‚Äö√∂¬∞ Generar informe autom‚àö¬∞tico</button>
        <textarea className="notes-area" style={{ minHeight: 200 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Documentos recibidos, comunicaciones, estado de homologaci‚àö‚â•n..." />
        <button className="save-btn" onClick={saveNotes} disabled={saving}>{saving ? "Guardando..." : saved ? "‚Äö√∫√¨ Guardado" : "Guardar notas"}</button>
      </div>}
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
  const [showUserMgmt, setShowUserMgmt] = useState(false);

  // Restaurar sesi‚àö‚â•n al cargar
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
        <div className="header-left"><div className="logo-mark">‚Äö√±‚àè QueEstudiar</div><div className="header-title">Panel de Admisiones</div></div>
        <div className="header-right"><div className="user-badge">{user.name}</div>{user.role === "admin" && <button className="btn-ghost" onClick={() => setShowUserMgmt(!showUserMgmt)} style={showUserMgmt ? { borderColor: "var(--accent)", color: "var(--accent)" } : {}}>‚öô Usuarios</button>}<button className="btn-ghost" onClick={loadStudents}>‚Äö√ú¬™ Actualizar</button><button className="btn-ghost" onClick={handleLogout}>Salir</button></div>
      </div>
      <div className="main">
        <div className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title">Estudiantes ¬¨‚àë {filtered.length}</div>
            <input className="search-input" placeholder="Buscar por nombre, email, pa‚àö‚â†s..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="filter-row">
              <div className={`filter-chip ${filterStatus === "all" ? "active" : ""}`} onClick={() => setFilterStatus("all")}>Todos ({students.length})</div>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => counts[k] > 0 && <div key={k} className={`filter-chip ${filterStatus === k ? "active" : ""}`} onClick={() => setFilterStatus(k)}>{v.label} ({counts[k]})</div>)}
            </div>
          </div>
          <div className="student-list">
            {loading ? <div className="loading" style={{ height: 200 }}><div className="spinner" /> Cargando...</div>
            : filtered.length === 0 ? <div className="empty" style={{ height: 200 }}><div className="empty-icon">‚Äö√≥√•</div><div className="empty-text">Sin estudiantes{search ? " con ese filtro" : " a‚àö‚à´n"}</div></div>
            : filtered.map(s => { const sc = STATUS_CONFIG[s.status || "nuevo"]; return (
              <div key={s.id} className={`student-item ${selected?.id === s.id ? "active" : ""}`} onClick={() => setSelected(s)}>
                <div className="student-name">{s.full_name || "Sin nombre"}</div>
                <div className="student-meta">{s.email || "‚Äö√Ñ√Æ"} ¬¨‚àë {s.country_of_origin || "‚Äö√Ñ√Æ"}</div>
                <div className="match-count">{(s.desired_program_type || s.education_level) ? `${s.desired_program_type || s.education_level} ¬¨‚àë ` : ""}{formatDate(s.created_at)}</div>
                <div className="student-status" style={{ color: sc.color, background: sc.bg }}>{sc.label}</div>
              </div>
            );})}
          </div>
        </div>
        {showUserMgmt ? <UserManagement onClose={() => setShowUserMgmt(false)} />
        : selected ? <StudentDetail key={selected.id} student={selected} onStatusChange={handleStatusChange} onNotesSave={handleNotesSave} />
        : <div className="detail"><div className="empty"><div className="empty-icon">‚Äö√≥√©</div><div className="empty-text">Selecciona un estudiante para ver su expediente</div></div></div>}
      </div>
    </div></>
  );
}
