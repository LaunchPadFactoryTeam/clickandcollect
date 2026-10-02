import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types.ts";

export type Db = SupabaseClient<Database>;

/**
 * Client du serveur d'un site : la clé publique (anon) identifie le projet, le jeton de site fixe le rôle
 * lp_site et la boutique. Aucune session persistée, aucun rafraîchissement : le jeton est un secret du Worker.
 */
export function createSiteClient(url: string, anonKey: string, siteToken: string): Db {
  return createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${siteToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
