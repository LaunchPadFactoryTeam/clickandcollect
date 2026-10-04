import type { SiteEnv } from "./env";

export interface RetentionReport {
  anonymized_orders: number;
  archived_consents: number;
  deleted_consents: number;
  deleted_orders: number;
}

/** Applique les durées de conservation à la boutique du site (fonction public.apply_retention, jeton de site). */
export async function applyRetention(e: SiteEnv): Promise<RetentionReport> {
  const res = await fetch(`${e.SUPABASE_URL}/rest/v1/rpc/apply_retention`, {
    method: "POST",
    headers: {
      apikey: e.SUPABASE_ANON_KEY ?? e.SUPABASE_SHOP_JWT!,
      Authorization: `Bearer ${e.SUPABASE_SHOP_JWT}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Conservation refusée par la base (${res.status}) : ${await res.text()}`);
  return (await res.json()) as RetentionReport;
}
