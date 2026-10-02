import type { SiteEnv } from "./env";

/** Accès du site à la base centrale (PostgREST), avec le jeton de site : rôle lp_site, sa boutique seulement. */

export interface OrderRecord {
  event_id: string;
  event_type: string;
  shop_id: string;
  session_id: string;
  payment_intent_id: string | null;
  slot_start: string;
  slot_end: string;
  email: string;
  phone: string | null;
  customer_hash: string;
  total_cents: number;
  vat_breakdown: Record<string, number>;
  items: {
    product_id: string;
    name: string;
    format: string;
    unit_price_cents: number;
    vat_rate: number;
    quantity: number;
    is_alcohol: boolean;
  }[];
  consent: { version: string; hash: string } | null;
}

export type RecordResult = { status: "created" | "duplicate"; order_id?: string; number?: number };

export interface OrderStatus {
  number: number;
  slot_start: string;
  slot_end: string;
  total_cents: number;
  status: string;
}

function headers(e: SiteEnv) {
  return {
    apikey: e.SUPABASE_ANON_KEY ?? e.SUPABASE_SHOP_JWT!,
    Authorization: `Bearer ${e.SUPABASE_SHOP_JWT}`,
    "Content-Type": "application/json",
  };
}

export function hasDatabase(e: SiteEnv): boolean {
  return Boolean(e.SUPABASE_URL && e.SUPABASE_SHOP_JWT);
}

/** Commande, lignes, consentement et emails en une transaction (fonction public.record_paid_checkout). */
export async function recordPaidCheckout(e: SiteEnv, record: OrderRecord): Promise<RecordResult> {
  const res = await fetch(`${e.SUPABASE_URL}/rest/v1/rpc/record_paid_checkout`, {
    method: "POST",
    headers: headers(e),
    body: JSON.stringify({ p: record }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Enregistrement de la commande refusé (${res.status}) : ${await res.text()}`);
  return (await res.json()) as RecordResult;
}

export async function findOrderBySession(e: SiteEnv, sessionId: string): Promise<OrderStatus | null> {
  const url = new URL(`${e.SUPABASE_URL}/rest/v1/orders`);
  url.searchParams.set("select", "number,slot_start,slot_end,total_cents,status");
  url.searchParams.set("stripe_session_id", `eq.${sessionId}`);
  const res = await fetch(url, { headers: headers(e), cache: "no-store" });
  if (!res.ok) throw new Error(`Lecture de la commande refusée (${res.status})`);
  const rows = (await res.json()) as OrderStatus[];
  return rows[0] ?? null;
}
