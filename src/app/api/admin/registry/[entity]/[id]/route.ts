import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";
import { apiError, HttpError, json, readJson } from "../../../_lib/http";
import { reviewSchema } from "../../../_lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const { client } = await requireAdmin(request, { roles: ["reviewer", "admin"] });
    const params = await context.params;
    const entity = z.enum(["institutions", "data_sources", "indicators", "indicator_definitions"]).parse(params.entity);
    const id = z.string().uuid().parse(params.id);
    const { decision, reason } = reviewSchema.parse(await readJson(request));
    const { data, error } = await client.rpc("review_registry", { p_entity: entity, p_id: id, p_decision: decision, p_reason: reason });
    if (error) throw new HttpError(400, "REVIEW_REJECTED");
    return json({ entry: data });
  } catch (error) { return apiError(error); }
}
