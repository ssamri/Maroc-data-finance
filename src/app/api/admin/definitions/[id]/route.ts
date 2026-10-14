import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";
import { apiError, HttpError, json, readJson } from "../../_lib/http";
import { definitionMetadataSchema } from "../../_lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { client } = await requireAdmin(request, { roles: ["editor", "reviewer", "admin"] });
    const id = z.string().uuid().parse((await context.params).id);
    const input = definitionMetadataSchema.parse(await readJson(request));
    const { data, error } = await client.from("indicator_definitions").update({ ...input, validation_status: "draft" }).eq("id", id).in("validation_status", ["draft", "pending", "rejected"]).is("approved_at", null).select("id").maybeSingle();
    if (error || !data) throw new HttpError(409, "DEFINITION_IMMUTABLE_OR_UNAVAILABLE");
    return json({ definition: data });
  } catch (error) { return apiError(error); }
}
