/**
 * Secrets et réglages du Worker (variables d'environnement Cloudflare, exposées par OpenNext dans process.env).
 * Aucun n'est lu au build : les pages statiques n'en dépendent pas.
 */
export interface SiteEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SHOP_JWT?: string;
  SHOP_HASH_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_ACCOUNT_ID?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  /** « fake » : faux fournisseur de paiement (tests de bout en bout, démonstration), jamais en production. */
  LP_PSP?: string;
  FAKE_PSP_SECRET?: string;
  /** Adresse qui reçoit les alertes (webhook Slack ou équivalent) quand un paiement n'a pas pu être enregistré. */
  ALERT_WEBHOOK_URL?: string;
}

export const env = (): SiteEnv => process.env as SiteEnv;

/** Boutique du jeton de site : la revendication shop_id, lue sans vérification (le jeton est un secret du Worker). */
export function shopIdFromToken(token: string | undefined): string | null {
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/"))) as { shop_id?: string };
    return json.shop_id ?? null;
  } catch {
    return null;
  }
}
