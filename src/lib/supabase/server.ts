import "server-only";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { AdminProfile, AdminRole, ApprovedObservation, Database } from "./database.types";

export const DOCUMENTS_BUCKET = "maroc-en-chiffres-documents";

export class AdminAuthError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "AdminAuthError";
  }
}

type SupabaseConfiguration = { url: string; key: string };
function configuration(): SupabaseConfiguration {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  if (!url || !key || !projectRef) {
    throw new AdminAuthError(503, "SUPABASE_NOT_CONFIGURED", "La connexion au projet Supabase vérifié n’est pas configurée.");
  }
  let parsed: URL;
  try { parsed = new URL(url); } catch {
    throw new AdminAuthError(503, "SUPABASE_INVALID_CONFIGURATION", "Configuration Supabase invalide.");
  }
  if (!/^[a-z0-9]{10,32}$/.test(projectRef) || parsed.protocol !== "https:" ||
    parsed.hostname !== `${projectRef}.supabase.co` || parsed.port ||
    parsed.username || parsed.password || parsed.search || parsed.hash ||
    (parsed.pathname !== "/" && parsed.pathname !== "")) {
    throw new AdminAuthError(503, "SUPABASE_PROJECT_MISMATCH", "L’URL doit correspondre à la référence du projet Supabase vérifié.");
  }
  return { url: parsed.origin, key };
}

export function isSupabaseConfigured(): boolean {
  try { configuration(); return true; } catch { return false; }
}

export function createPublicSupabaseClient(): SupabaseClient<Database, "maroc_en_chiffres"> {
  const { url, key } = configuration();
  return createClient<Database, "maroc_en_chiffres">(url, key, {
    db: { schema: "maroc_en_chiffres" },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type AdminContext = { user: User; client: SupabaseClient<Database, "maroc_en_chiffres">; profile: AdminProfile };

/** Authenticate with the Auth server, then authorize through the user's RLS
 * session. Neither decoded JWT claims nor a frontend role claim is trusted.
 * Returned CRUD client carries the user token, preserving RLS and audit actor.
 */
export async function requireAdmin(
  request: Request,
  options: { roles?: readonly AdminRole[] } = {},
): Promise<AdminContext> {
  const { url, key } = configuration();
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (!token || token.length > 8192) {
    throw new AdminAuthError(401, "AUTH_REQUIRED", "Connexion administrateur requise.");
  }
  const client = createClient<Database, "maroc_en_chiffres">(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    db: { schema: "maroc_en_chiffres" },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: authentication, error: authenticationError } = await client.auth.getUser(token);
  if (authenticationError || !authentication.user) {
    throw new AdminAuthError(401, "INVALID_SESSION", "Session expirée ou invalide.");
  }
  const { data: profile, error: profileError } = await client.from("admin_users")
    .select("user_id,display_name,role,active,created_at,updated_at")
    .eq("user_id", authentication.user.id).maybeSingle();
  if (profileError) {
    throw new AdminAuthError(503, "ADMIN_PROFILE_UNAVAILABLE", "Le contrôle des autorisations est indisponible.");
  }
  if (!profile || !profile.active || (options.roles && !options.roles.includes(profile.role))) {
    throw new AdminAuthError(403, "ADMIN_FORBIDDEN", "Ce compte ne possède pas les droits requis.");
  }
  return { user: authentication.user, client, profile };
}

export async function readApprovedObservations(indicatorId?: string): Promise<ApprovedObservation[]> {
  let query = createPublicSupabaseClient().from("approved_observations")
    .select("*").order("period_end", { ascending: true });
  if (indicatorId) query = query.eq("indicator_id", indicatorId);
  const { data, error } = await query;
  if (error) throw new Error("Impossible de lire les observations approuvées.");
  return data ?? [];
}
