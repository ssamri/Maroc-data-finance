import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** The Supabase project is shared; browser persistence belongs to this app. */
export function createAdminAuthClient(url: string, publicKey: string): SupabaseClient {
  return createClient(url, publicKey, {
    auth: {
      storageKey: "maroc-en-chiffres-auth",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

/** Revoke this session only. A global logout would affect other applications
 * using the same account in the shared Supabase project.
 */
export async function signOutAdministrator(client: Pick<SupabaseClient, "auth">) {
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw error;
}
