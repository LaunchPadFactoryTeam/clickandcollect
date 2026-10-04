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
  customer_name: string | null;
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

/** Une commande et ses lignes, pour composer ses emails. */
export interface StoredOrder {
  id: string;
  number: number;
  slot_start: string;
  slot_end: string;
  email: string | null;
  phone: string | null;
  total_cents: number;
  vat_breakdown: Record<string, number>;
  anonymized_at: string | null;
  order_items: { name: string; format: string; quantity: number; unit_price_cents: number; vat_rate: number }[];
}

export async function fetchOrder(e: SiteEnv, id: string): Promise<StoredOrder | null> {
  const url = new URL(`${e.SUPABASE_URL}/rest/v1/orders`);
  url.searchParams.set(
    "select",
    "id,number,slot_start,slot_end,email,phone,total_cents,vat_breakdown,anonymized_at,order_items(name,format,quantity,unit_price_cents,vat_rate)",
  );
  url.searchParams.set("id", `eq.${id}`);
  const res = await fetch(url, { headers: headers(e), cache: "no-store" });
  if (!res.ok) throw new Error(`Lecture de la commande ${id} refusée (${res.status})`);
  return ((await res.json()) as StoredOrder[])[0] ?? null;
}

export interface OutboxRecord {
  id: number;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
}

/** Réserve les emails dus de la boutique (fonction public.claim_email_outbox, bail de 10 minutes). */
export async function claimOutbox(e: SiteEnv, limit: number): Promise<OutboxRecord[]> {
  const res = await fetch(`${e.SUPABASE_URL}/rest/v1/rpc/claim_email_outbox`, {
    method: "POST",
    headers: headers(e),
    body: JSON.stringify({ p_limit: limit }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Réservation de la file d'envoi refusée (${res.status}) : ${await res.text()}`);
  return (await res.json()) as OutboxRecord[];
}

export async function updateOutbox(
  e: SiteEnv,
  id: number,
  patch: Partial<{ attempts: number; next_attempt_at: string; sent_at: string; failed_at: string; last_error: string }>,
) {
  const res = await fetch(`${e.SUPABASE_URL}/rest/v1/email_outbox?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers(e), Prefer: "return=minimal" },
    body: JSON.stringify(patch),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Mise à jour de l'email ${id} refusée (${res.status})`);
}

export async function logEmailEvent(
  e: SiteEnv,
  event: {
    shop_id: string;
    kind: string;
    order_id: string | null;
    provider_message_id: string | null;
    status: "sent" | "failed";
  },
) {
  const res = await fetch(`${e.SUPABASE_URL}/rest/v1/email_events`, {
    method: "POST",
    headers: { ...headers(e), Prefer: "return=minimal" },
    body: JSON.stringify(event),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Journal des emails refusé (${res.status})`);
}
