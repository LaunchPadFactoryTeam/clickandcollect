import type { ClientConfig } from "@launchpadfactoryteam/config";
import { fetchSanityContent, type Availability, type ContentSnapshot } from "@launchpadfactoryteam/content";
import type { Site } from "@launchpadfactoryteam/ui";
import contentJson from "../generated/content.json";
import siteJson from "../generated/site.json";
import tokens from "../public/theme/tokens.json";

/**
 * Configuration validée et contenus figés par `pnpm prepare:site` (lp-theme et lp-content) depuis LP_SITE_DIR,
 * par défaut l'exemple Maison Ferrand. Importés en JSON : le Worker Cloudflare n'a pas de système de fichiers.
 */
export const config = siteJson as ClientConfig;
export const fontPreload: string[] = tokens.preload ?? [];
/** Jetons de couleur et de typographie de la boutique, pour la charte des emails. */
export const themeTokens = { isDark: tokens.isDark, variables: tokens.variables as Record<string, string> };

const env = process.env;

async function availabilityFromSupabase(): Promise<Availability[]> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SHOP_JWT) return [];
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/product_availability?select=product_id,available`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY ?? env.SUPABASE_SHOP_JWT,
      Authorization: `Bearer ${env.SUPABASE_SHOP_JWT}`,
    },
    next: { tags: ["catalogue"] },
  });
  if (!res.ok) throw new Error(`Supabase a répondu ${res.status} pour les disponibilités`);
  return (await res.json()) as Availability[];
}

/**
 * Contenus du site. Avec un projet Sanity configuré, ils sont relus à chaque revalidation (au build, puis à chaque
 * appel de /api/revalidate) ; sinon, ce sont les contenus de départ du repo client, figés au build.
 */
export async function getContent(): Promise<ContentSnapshot> {
  if (env.SANITY_PROJECT_ID && env.SANITY_DATASET) {
    return fetchSanityContent(
      { projectId: env.SANITY_PROJECT_ID, dataset: env.SANITY_DATASET, token: env.SANITY_READ_TOKEN },
      await availabilityFromSupabase(),
      (input, init) => fetch(input, { ...init, next: { tags: ["catalogue"] } }),
    );
  }
  return contentJson as unknown as ContentSnapshot;
}

export async function getSite(): Promise<Site> {
  return { config, content: await getContent() };
}
