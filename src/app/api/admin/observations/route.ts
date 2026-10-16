import { requireAdmin } from "@/lib/supabase/server";
import { apiError, HttpError, json, readJson } from "../_lib/http";
import { observationSchema } from "../_lib/validation";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { client, profile } = await requireAdmin(request);
    const responses = await Promise.all([
      client.from("observations").select("id,indicator_id,value_exact:value::text,unit,scale,economic_scope,period_start,period_end,published_at,validation_status,observation_status,version,source_document_id,source_url,document_locator,review_note").order("created_at", { ascending: false }).limit(100),
      client.from("indicators").select("id,code,name,validation_status").order("name"),
      client.from("indicator_definitions").select("id,indicator_id,version,definition,unit,scale,economic_scope,frequency,accounting_basis,comparability_notes,valid_from,valid_until,validation_status,approved_at").order("version", { ascending: false }),
      client.from("institutions").select("id,name,validation_status").order("name"),
      client.from("data_sources").select("id,institution_id,name,validation_status").order("name"),
      client.from("source_documents").select("id,title,institution_id,data_source_id,source_url,published_at,validation_status,document_type,storage_path").order("created_at", { ascending: false }).limit(100),
    ]);
    if (responses.some((response) => response.error)) throw new HttpError(500, "READ_FAILED");
    const [observations, indicators, definitions, institutions, sources, documents] = responses.map((response) => response.data);
    return json({ profile: { role: profile.role }, observations, indicators, definitions, institutions, sources, documents });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const { client } = await requireAdmin(request, { roles: ["editor", "admin"] });
    const input = observationSchema.parse(await readJson(request));
    // Provenance relationships and approved definition compatibility are also
    // enforced in PostgreSQL. A client can never submit an approval status.
    const { data, error } = await client.from("observations").insert({ ...input, validation_status: "pending", version: 1 }).select("id").single();
    if (error) throw new HttpError(error.code === "23505" ? 409 : 400, error.code === "23505" ? "DUPLICATE_OBSERVATION" : "DRAFT_REJECTED");
    return json({ observation: data }, 201);
  } catch (error) { return apiError(error); }
}
