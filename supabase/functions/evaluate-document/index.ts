import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RUBRICS: Record<string, string> = {
  "Carta de motivación": `
Eres un experto en admisiones universitarias en España. Evalúa esta carta de motivación
de un estudiante internacional.

Criterios (valora cada uno internamente y da una puntuación global):
- Claridad en la motivación: ¿por qué España, por qué este programa?
- Trayectoria personal relevante: experiencias, logros, contexto
- Coherencia entre el perfil del estudiante y el programa
- Calidad y estructura del texto
- Longitud adecuada (mínimo 400 palabras, máximo 1.000)

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):
{"score": <número del 1 al 5>, "feedback": "<2-3 frases concretas: qué está bien y qué mejorar>", "extracted_summary": "<1 frase resumiendo el perfil del candidato>"}
`,

  "CV / Currículum": `
Eres un experto en admisiones universitarias en España. Evalúa este CV o currículum
de un estudiante internacional que quiere estudiar en España.

Criterios:
- Información de contacto presente
- Formación académica detallada (institución, fechas, título)
- Experiencia relevante (laboral, voluntariado, proyectos)
- Idiomas con nivel indicado
- Estructura clara y legible

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):
{"score": <número del 1 al 5>, "feedback": "<2-3 frases concretas: qué está bien y qué mejorar>", "extracted_summary": "<1 frase resumiendo el perfil del candidato>"}
`,

  "Carta de recomendación": `
Eres un experto en admisiones universitarias en España. Evalúa esta carta de
recomendación de un estudiante internacional.

Criterios:
- El autor se identifica claramente (nombre, cargo, institución)
- Relación con el estudiante explicada
- Menciona logros o competencias concretas del estudiante
- Tono profesional y objetivo
- Firma o sello institucional (si es visible)

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):
{"score": <número del 1 al 5>, "feedback": "<2-3 frases concretas: qué está bien y qué mejorar>", "extracted_summary": "<1 frase: quién la firma y su relación con el estudiante>"}
`,

  "Expediente académico / notas": `
Eres un experto en admisiones universitarias en España. Evalúa este expediente
académico o certificado de notas de un estudiante internacional.

Criterios:
- Institución emisora identificable
- Período académico cubierto
- Notas o calificaciones visibles y legibles
- Promedio general presente o calculable
- Sello o firma oficial visible

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):
{"score": <número del 1 al 5>, "feedback": "<2-3 frases concretas: qué está bien y qué falta>", "extracted_summary": "<1 frase: institución, período y nota media aproximada si visible>"}
`,

  "Título académico": `
Eres un experto en admisiones universitarias en España. Evalúa este título o diploma
académico de un estudiante internacional.

Criterios:
- Nombre completo del estudiante visible
- Institución emisora clara
- Tipo de título o grado obtenido
- Fecha de expedición presente
- Apostilla de La Haya o mención de legalización (si es visible)

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):
{"score": <número del 1 al 5>, "feedback": "<2-3 frases concretas: qué está bien y qué falta>", "extracted_summary": "<1 frase: título, institución y año si visible>"}
`,

  "Certificado de idioma": `
Eres un experto en admisiones universitarias en España. Evalúa este certificado
de idioma de un estudiante internacional.

Criterios:
- Idioma certificado claramente indicado
- Nivel alcanzado (A1–C2 o equivalente) visible
- Institución certificadora reconocida (DELE, DELF, Cambridge, IELTS, TOEFL, etc.)
- Fecha de expedición y vigencia (si aplica)
- Nombre del titular visible

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):
{"score": <número del 1 al 5>, "feedback": "<2-3 frases concretas: qué está bien y qué falta>", "extracted_summary": "<1 frase: idioma, nivel y entidad certificadora>"}
`,

  "Solvencia económica": `
Eres un experto en admisiones universitarias en España. Evalúa este documento
de solvencia económica de un estudiante internacional (extracto bancario, carta de
sponsor o similar).

Criterios:
- Titular del documento identificable
- Importe o saldo visible
- Período cubierto (idealmente últimos 3 meses)
- Entidad emisora identificable (banco, institución)
- Si es carta de sponsor: firmada y con datos del patrocinador

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):
{"score": <número del 1 al 5>, "feedback": "<2-3 frases concretas: qué está bien y qué falta>", "extracted_summary": "<1 frase: tipo de documento e importe aproximado si visible>"}
`,

  "Seguro médico privado": `
Eres un experto en admisiones universitarias en España. Evalúa esta póliza o
certificado de seguro médico privado para un estudiante internacional en España.

Criterios:
- Nombre del asegurado visible
- Cobertura válida en España
- Sin copago ni carencia (o lo indica claramente)
- Período de vigencia mínimo 1 año
- Entidad aseguradora identificable

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):
{"score": <número del 1 al 5>, "feedback": "<2-3 frases concretas: qué está bien y qué falta>", "extracted_summary": "<1 frase: aseguradora, cobertura y período si visible>"}
`,

  "Equivalencia nota media DENM": `
Eres un experto en admisiones universitarias en España. Evalúa este documento
de equivalencia de nota media (DENM) emitido por el Ministerio de Universidades
de España.

Criterios:
- Emitido por el Ministerio de Universidades de España
- Nombre del solicitante visible
- Nota equivalente en escala española (0–10) presente
- Universidad o institución de origen indicada
- Fecha de expedición reciente (dentro de los últimos 2 años)

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):
{"score": <número del 1 al 5>, "feedback": "<2-3 frases concretas: qué está bien y qué falta>", "extracted_summary": "<1 frase: nota equivalente y universidad de origen si visible>"}
`,

  "Homologación o Volante Inscripción": `
Eres un experto en admisiones universitarias en España. Evalúa este documento,
que puede ser una resolución de homologación de título o un Volante de Inscripción
Condicional (VIC) emitido por una universidad española.

Criterios:
- Tipo de documento identificable (homologación o VIC)
- Nombre del solicitante presente
- Institución emisora española identificable
- Título al que hace referencia indicado
- Fecha de expedición presente

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):
{"score": <número del 1 al 5>, "feedback": "<2-3 frases concretas: qué está bien y qué falta>", "extracted_summary": "<1 frase: tipo de documento e institución emisora>"}
`,
};

const RUBRIC_DEFAULT = `
Eres un experto en admisiones universitarias en España. Evalúa este documento
de un estudiante internacional en términos de completitud, claridad y utilidad
para un proceso de admisión en España.

Responde ÚNICAMENTE con este JSON (sin texto adicional, sin markdown):
{"score": <número del 1 al 5>, "feedback": "<2-3 frases concretas>", "extracted_summary": "<1 frase describiendo el documento>"}
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(
        JSON.stringify({ error: "document_id es obligatorio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 1. Obtener el registro del documento ─────────────────────────────
    const { data: doc, error: docError } = await supabase
      .from("student_documents")
      .select("id, document_type, file_url, status")
      .eq("id", document_id)
      .single();

    if (docError || !doc) {
      return new Response(
        JSON.stringify({ error: "Documento no encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!doc.file_url) {
      return new Response(
        JSON.stringify({ error: "El documento no tiene archivo subido todavía" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 2. Descargar el PDF usando el cliente JS (service role bypasa RLS) ─
    // Extraer solo la ruta dentro del bucket: "USER_ID/DOC_ID.pdf"
    const objectPath = doc.file_url
      .split("/storage/v1/object/authenticated/student-documents/")[1];

    if (!objectPath) {
      throw new Error(`No se pudo extraer la ruta del archivo de: ${doc.file_url}`);
    }

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("student-documents")
      .download(objectPath);

    if (downloadError || !fileBlob) {
      throw new Error(`Error descargando archivo: ${downloadError?.message ?? "blob vacío"}`);
    }

    const fileBuffer = await fileBlob.arrayBuffer();

    // ── 3. Convertir a base64 en chunks (evita stack overflow en PDFs grandes) ─
    const bytes = new Uint8Array(fileBuffer);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const base64Pdf = btoa(binary);

    // ── 4. Seleccionar rúbrica y llamar a Gemini ──────────────────────────
    const rubric = RUBRICS[doc.document_type] ?? RUBRIC_DEFAULT;
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
    const GEMINI_MODEL = "gemini-1.5-flash";

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: "application/pdf",
                    data: base64Pdf,
                  },
                },
                {
                  text: rubric.trim(),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 512,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      throw new Error(`Error en la API de Gemini: ${geminiRes.status} — ${errBody}`);
    }

    // ── 5. Parsear respuesta de Gemini ────────────────────────────────────
    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let score = 0;
    let feedback = "No se pudo evaluar el documento.";
    let extractedSummary = "";

    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        score = Math.min(5, Math.max(1, parseInt(parsed.score) || 0));
        feedback = parsed.feedback || feedback;
        extractedSummary = parsed.extracted_summary || "";
      }
    } catch {
      feedback = rawText.slice(0, 500);
    }

    // ── 6. Guardar en student_documents ───────────────────────────────────
    const { error: updateError } = await supabase
      .from("student_documents")
      .update({
        ai_score: score || null,
        ai_feedback: feedback,
        content: extractedSummary || null,
        ai_evaluated_at: new Date().toISOString(),
      })
      .eq("id", document_id);

    if (updateError) throw new Error(`Error guardando evaluación: ${updateError.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        document_id,
        score,
        feedback,
        extracted_summary: extractedSummary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("evaluate-document error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
