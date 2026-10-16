import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/server";
import { apiError, HttpError, json, readJson } from "../../_lib/http";
import { reviewSchema } from "../../_lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { client } = await requireAdmin(request, { roles: ["reviewer", "admin"] });
    const id = z.string().uuid().parse((await context.params).id);
    const { decision, reason } = reviewSchema.parse(await readJson(request));
    const { data, error } = await client.rpc("review_observation", { p_observation_id: id, p_decision: decision, p_reason: reason });
    if (error) throw new HttpError(400, "REVIEW_REJECTED");
    return json({ observation: data ? { id: data.id, validation_status: data.validation_status, version: data.version, approved_at: data.approved_at } : null });
  } catch (error) { return apiError(error); }
}
