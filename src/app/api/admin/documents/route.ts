import { createHash, randomUUID } from "node:crypto";
import { DOCUMENTS_BUCKET, requireAdmin } from "@/lib/supabase/server";
import { apiError, checkRequestOrigin, HttpError, json, readBoundedBody } from "../_lib/http";
import { detectDocumentType, documentMetadataSchema, MAX_DOCUMENT_BYTES } from "../_lib/validation";

export const runtime = "nodejs";

const mimeTypes = { pdf: "application/pdf", csv: "text/csv", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };

export async function POST(request: Request) {
  try {
    const { client, user } = await requireAdmin(request, { roles: ["editor", "admin"] });
    checkRequestOrigin(request);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) throw new HttpError(415, "MULTIPART_REQUIRED");
    if (Number(request.headers.get("content-length") || 0) > MAX_DOCUMENT_BYTES + 65536) throw new HttpError(413, "FILE_TOO_LARGE");
    const body = await readBoundedBody(request, MAX_DOCUMENT_BYTES + 65536);
    let form: FormData;
    try { form = await new Response(body, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData(); }
    catch { throw new HttpError(400, "INVALID_MULTIPART"); }
    const metadata = documentMetadataSchema.parse(Object.fromEntries(["data_source_id", "institution_id", "title", "source_url", "published_at", "language"].map((key) => [key, form.get(key)])));
    const file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > MAX_DOCUMENT_BYTES) throw new HttpError(413, "FILE_TOO_LARGE");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let documentType: "pdf" | "csv" | "xlsx";
    try { documentType = detectDocumentType(bytes, file.name); } catch { throw new HttpError(415, "INVALID_FILE_FORMAT"); }
    const storagePath = `${user.id}/${randomUUID()}.${documentType}`;
    const { error: uploadError } = await client.storage.from(DOCUMENTS_BUCKET).upload(storagePath, bytes, { contentType: mimeTypes[documentType], upsert: false, cacheControl: "0" });
    if (uploadError) throw new HttpError(400, "UPLOAD_FAILED");
    const { data, error } = await client.from("source_documents").insert({ ...metadata, document_type: documentType, storage_path: storagePath, sha256: createHash("sha256").update(bytes).digest("hex"), byte_size: bytes.length, validation_status: "pending" }).select("id").single();
    if (error) {
      // Compensate only the object created by this request, never an existing
      // source document. Files remain private throughout the transaction.
      await client.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
      throw new HttpError(400, "DOCUMENT_REJECTED");
    }
    return json({ document: data }, 201);
  } catch (error) { return apiError(error); }
}
