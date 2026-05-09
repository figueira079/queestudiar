import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CHECKLISTS: Record<string, Array<{ type: string; notes: string | null }>> = {
  master: [
    { type: "Pasaporte",                   notes: "Vigente mínimo 1 año" },
    { type: "Título académico",             notes: "Grado universitario + Apostilla de La Haya o legalización diplomática" },
    { type: "Expediente académico / notas", notes: "Traducción oficial si no está en español" },
    { type: "Equivalencia nota media DENM", notes: "Declaración del Ministerio de Universidades — imprescindible para la admisión. El trámite tarda meses; solicitarlo cuanto antes." },
    { type: "Carta de motivación",          notes: null },
    { type: "CV / Currículum",              notes: null },
    { type: "Carta de recomendación",       notes: "1–2 cartas de profesores o empleadores. Consulta con la universidad si es obligatoria." },
    { type: "Certificado de idioma",        notes: "B2 mínimo en español o inglés según el programa" },
    { type: "Solvencia económica",          notes: "100 % IPREM (~600 €/mes). Extracto bancario de los últimos 3 meses o carta de sponsor" },
    { type: "Seguro médico privado",        notes: "Sin copago ni carencia, mínimo 1 año de cobertura en España" },
  ],
  grado: [
    { type: "Pasaporte",                         notes: "Vigente mínimo 1 año" },
    { type: "Título académico",                  notes: "Bachillerato o secundaria + Apostilla de La Haya o legalización diplomática" },
    { type: "Expediente académico / notas",      notes: "Notas de bachillerato. Traducción oficial si no está en español." },
    { type: "Homologación o Volante Inscripción",notes: "Resolución de homologación del Ministerio O Volante de Inscripción Condicional (VIC) de la universidad de destino" },
    { type: "Certificado de idioma",             notes: "B2 en español si el programa es en castellano y no eres hispanohablante nativo" },
    { type: "Solvencia económica",               notes: "Extracto bancario o carta de sponsor que acredite medios suficientes" },
    { type: "Seguro médico privado",             notes: "Privado, sin copago ni carencia, mínimo 1 año" },
  ],
  fp_superior: [
    { type: "Pasaporte",                         notes: "Vigente mínimo 1 año" },
    { type: "Título académico",                  notes: "Bachillerato o equivalente + Apostilla de La Haya o legalización diplomática" },
    { type: "Expediente académico / notas",      notes: "Notas del bachillerato o secundaria" },
    { type: "Homologación o Volante Inscripción",notes: "Resolución de homologación O Volante de Inscripción Condicional (VIC)" },
    { type: "Solvencia económica",               notes: "Extracto bancario o carta de sponsor" },
    { type: "Seguro médico privado",             notes: "Privado, sin copago ni carencia" },
  ],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      full_name,
      email,
      phone,
      country_of_origin,
      student_origin,
      education_level,
      budget_range,
      planned_start_date,
      selected_programa_ids,
    } = body;

    if (!full_name || !email || !student_origin || !education_level) {
      return new Response(
        JSON.stringify({ error: "Faltan campos obligatorios: full_name, email, student_origin, education_level" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Crear student_lead
    const { data: lead, error: leadError } = await supabase
      .from("student_leads")
      .insert({
        full_name,
        email,
        phone: phone || null,
        country_of_origin: country_of_origin || null,
        student_origin,
        education_level,
        status: "nuevo",
      })
      .select("id")
      .single();

    if (leadError) throw new Error(`Error creando expediente: ${leadError.message}`);

    const studentId = lead.id;

    // 2. Insertar matches
    const programaIds: string[] = Array.isArray(selected_programa_ids)
      ? selected_programa_ids.filter(Boolean)
      : [];

    if (programaIds.length > 0) {
      const matchRows = programaIds.map((pid) => ({
        student_id: studentId,
        programa_id: pid,
      }));
      const { error: matchError } = await supabase
        .from("matches")
        .insert(matchRows);
      if (matchError) throw new Error(`Error insertando matches: ${matchError.message}`);
    }

    // 3. Determinar tipo de programa para el checklist
    let programType: keyof typeof CHECKLISTS = "grado";

    if (programaIds.length > 0) {
      const { data: progs } = await supabase
        .from("programas")
        .select("tipo")
        .in("id", programaIds)
        .limit(20);

      const tipos = (progs ?? []).map((p: { tipo: string }) => p.tipo);
      if (tipos.includes("master")) programType = "master";
      else if (tipos.includes("fp_superior")) programType = "fp_superior";
      else programType = "grado";
    } else {
      if (education_level === "grado" || education_level === "master") {
        programType = "master";
      } else if (education_level === "fp_superior") {
        programType = "grado";
      } else {
        programType = "grado";
      }
    }

    // 4. Crear checklist de documentos
    const checklist = CHECKLISTS[programType] ?? CHECKLISTS.grado;
    const docRows = checklist.map((d) => ({
      student_id: studentId,
      document_type: d.type,
      status: "pendiente",
      notes: d.notes,
    }));

    const { error: docsError } = await supabase
      .from("student_documents")
      .insert(docRows);
    if (docsError) throw new Error(`Error creando checklist: ${docsError.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        student_id: studentId,
        program_type_detected: programType,
        docs_created: docRows.length,
        matches_created: programaIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("onboard-student error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error inesperado" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
