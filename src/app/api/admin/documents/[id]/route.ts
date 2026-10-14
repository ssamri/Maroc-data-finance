import { z } from "zod";
import { DOCUMENTS_BUCKET, requireAdmin } from "@/lib/supabase/server";
import { apiError, HttpError, json, readJson } from "../../_lib/http";
import { reviewSchema } from "../../_lib/validation";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { client } = await requireAdmin(request);
    const id = z.string().uuid().parse((await context.params).id);
    const { data: document, error: readError } = await client.from("source_documents").select("storage_path").eq("id", id).single();
    if (readError || !document?.storage_path) throw new HttpError(404, "DOCUMENT_NOT_FOUND");
    const { data, error } = await client.storage.from(DOCUMENTS_BUCKET).createSignedUrl(document.storage_path, 60);
    if (error) throw new HttpError(400, "DOWNLOAD_FAILED");
    return json({ url: data.signedUrl });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { client } = await requireAdmin(request, { roles: ["reviewer", "admin"] });
    const id = z.string().uuid().parse((await context.params).id);
    const { decision, reason } = reviewSchema.parse(await readJson(request));
    const { data, error } = await client.rpc("review_source_document", { p_document_id: id, p_decision: decision, p_reason: reason });
    if (error) throw new HttpError(400, "REVIEW_REJECTED");
    return json({ document: data });
  } catch (error) { return apiError(error); }
}
