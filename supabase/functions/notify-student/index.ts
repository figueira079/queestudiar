import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "noreply@queestudiar.es";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ─── Email templates ──────────────────────────────────────────────────────────

type NotificationType = "doc_status_changed" | "team_comment" | "new_matches";

interface NotifyPayload {
  type: NotificationType;
  student_email: string;
  student_name: string;
  // doc_status_changed
  document_type?: string;
  new_status?: string;
  doc_notes?: string;
  // team_comment
  comment_message?: string;
  document_name?: string;
  // new_matches
  match_count?: number;
}

const DOC_STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente de envío",
  en_revision: "En revisión",
  aprobado: "Aprobado",
  necesita_correccion: "Necesita corrección",
  no_aplica: "No aplica",
};

function getSubjectAndBody(payload: NotifyPayload): { subject: string; html: string } {
  const { student_name } = payload;
  const firstName = student_name?.split(" ")[0] ?? "estudiante";

  if (payload.type === "doc_status_changed") {
    const statusLabel = DOC_STATUS_LABELS[payload.new_status ?? ""] ?? payload.new_status ?? "actualizado";
    const isApproved = payload.new_status === "aprobado";
    const needsCorrection = payload.new_status === "necesita_correccion";

    const subject = isApproved
      ? `✅ Documento aprobado: ${payload.document_type}`
      : needsCorrection
      ? `✏️ Revisión necesaria: ${payload.document_type}`
      : `Actualización en tu expediente — ${payload.document_type}`;

    const notesBlock = payload.doc_notes
      ? `<p style="margin:16px 0;padding:12px 16px;background:#f1f5f9;border-left:3px solid #2563eb;border-radius:4px;font-size:14px;color:#334155;">
           <strong>Nota del equipo:</strong><br>${payload.doc_notes}
         </p>`
      : "";

    const html = emailWrapper(firstName, `
      <p>Tu equipo ha actualizado el estado de un documento en tu expediente:</p>
      <p style="margin:16px 0;padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
        <strong>${payload.document_type}</strong><br>
        <span style="color:${isApproved ? "#16a34a" : needsCorrection ? "#e8531a" : "#64748b"};font-size:14px;">
          ${isApproved ? "✅" : needsCorrection ? "✏️" : "🔄"} ${statusLabel}
        </span>
      </p>
      ${notesBlock}
      ${needsCorrection
        ? `<p>Por favor, revisa las indicaciones y vuelve a subir el documento desde tu portal.</p>`
        : isApproved
        ? `<p>¡Excelente! Sigue así — cada documento aprobado te acerca más a tu plaza.</p>`
        : `<p>Puedes ver el estado actualizado de todos tus documentos en tu portal.</p>`
      }
    `);

    return { subject, html };
  }

  if (payload.type === "team_comment") {
    const subject = `💬 Nuevo mensaje de tu asesor — ${payload.document_name ?? "tu expediente"}`;
    const html = emailWrapper(firstName, `
      <p>Tu asesor te ha dejado un mensaje sobre tu expediente:</p>
      ${payload.document_name
        ? `<p style="font-size:13px;color:#64748b;margin-bottom:8px;">Documento: ${payload.document_name}</p>`
        : ""}
      <p style="margin:16px 0;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:15px;line-height:1.6;color:#0f172a;">
        "${payload.comment_message}"
      </p>
      <p>Puedes responder desde tu portal.</p>
    `);
    return { subject, html };
  }

  if (payload.type === "new_matches") {
    const count = payload.match_count ?? 1;
    const subject = `🎓 ${count === 1 ? "Un programa nuevo" : `${count} programas nuevos`} en tu expediente`;
    const html = emailWrapper(firstName, `
      <p>Tu equipo ha seleccionado ${count === 1 ? "un nuevo programa" : `${count} nuevos programas`} que encajan con tu perfil:</p>
      <p style="margin:16px 0;padding:12px 16px;background:#dbeafe;border-radius:8px;font-size:15px;color:#1e40af;">
        🎓 ${count} ${count === 1 ? "programa disponible" : "programas disponibles"} para revisar
      </p>
      <p>Entra en tu portal para ver todos los detalles, marcar tus favoritos y consultar los requisitos de admisión.</p>
    `);
    return { subject, html };
  }

  return {
    subject: "Actualización en tu expediente",
    html: emailWrapper(firstName, "<p>Tu expediente ha sido actualizado. Entra en tu portal para ver los cambios.</p>"),
  };
}

function emailWrapper(firstName: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#faf6f0;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf6f0;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr>
          <td style="background:#2563eb;padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.5px;">QueEstudiar</p>
            <p style="margin:4px 0 0;color:#bfdbfe;font-size:12px;">Tu portal para estudiar en España</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;color:#0f172a;">Hola, <strong>${firstName}</strong></p>
            ${content}
            <div style="margin:32px 0 24px;text-align:center;">
              <a href="https://app.queestudiar.es/#/portal"
                 style="display:inline-block;padding:12px 28px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
                Ir a mi portal →
              </a>
            </div>
            <p style="font-size:13px;color:#64748b;line-height:1.6;">
              Tu equipo en QueEstudiar está aquí para ayudarte en cada paso del proceso.
              Si tienes dudas, responde a este email o escríbenos directamente.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;">
            <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
              QueEstudiar · queestudiar.es<br>
              Estás recibiendo este email porque tienes un expediente activo con nosotros.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Fetch student data from Supabase ─────────────────────────────────────────

async function getStudentByEmail(email: string): Promise<{ full_name: string; email: string } | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/student_leads?email=eq.${encodeURIComponent(email)}&select=full_name,email&limit=1`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );
  const data = await res.json();
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function getStudentByLeadId(studentId: string): Promise<{ full_name: string; email: string } | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/student_leads?id=eq.${studentId}&select=full_name,email&limit=1`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );
  const data = await res.json();
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

// ─── Send via Resend ──────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: `QueEstudiar <${FROM_EMAIL}>`, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const rawBody = await req.json();

    // Si viene del Database Webhook de Supabase (tiene "table" y "record")
    if (rawBody.table === "matches" && rawBody.type === "INSERT" && rawBody.record?.student_id) {
      const studentId = rawBody.record.student_id;
      const student = await getStudentByLeadId(studentId);
      if (!student || !student.email) {
        return new Response(JSON.stringify({ ok: true, skipped: "no student email" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      const countRes = await fetch(
        `${SUPABASE_URL}/rest/v1/matches?student_id=eq.${studentId}&select=id`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
      );
      const matchData = await countRes.json();
      const matchCount = Array.isArray(matchData) ? matchData.length : 1;

      // Solo notificar en el primer match o cada 10 para no spamear
      if (matchCount === 1 || matchCount % 10 === 0) {
        const { subject, html } = getSubjectAndBody({
          type: "new_matches",
          student_email: student.email,
          student_name: student.full_name,
          match_count: matchCount,
        });
        await sendEmail(student.email, subject, html);
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Payload normal desde App.jsx
    const payload: NotifyPayload = rawBody;

    if (!payload.type || !payload.student_email) {
      return new Response(JSON.stringify({ error: "Missing type or student_email" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    let studentName = payload.student_name;
    if (!studentName) {
      const student = await getStudentByEmail(payload.student_email);
      studentName = student?.full_name ?? payload.student_email;
    }

    const { subject, html } = getSubjectAndBody({ ...payload, student_name: studentName });
    await sendEmail(payload.student_email, subject, html);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-student error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
