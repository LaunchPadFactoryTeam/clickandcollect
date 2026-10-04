import { computeTotals } from "@launchpadfactoryteam/commerce";
import { WebhookSignatureError, type PaidCheckout, type PaymentProvider } from "@launchpadfactoryteam/psp";
import { customerHash } from "@launchpadfactoryteam/rgpd";
import type { OrderRecord, RecordResult } from "./orders";
import type { HandlerResult } from "./checkout";

export interface WebhookDeps {
  provider: PaymentProvider;
  shopId: string;
  /** Clé de la boutique pour l'empreinte client (SHOP_HASH_KEY). */
  hashKey: string;
  record: (order: OrderRecord) => Promise<RecordResult>;
  alert: (message: string, details: Record<string, unknown>) => Promise<void>;
  /** Après l'enregistrement d'une nouvelle commande : envoi des emails mis en file. */
  afterRecord?: () => void;
}

/** Empreinte client : HMAC-SHA256 de l'email normalisé, propre à la boutique (lot 8). */
export { customerHash };

export async function toOrderRecord(
  checkout: PaidCheckout,
  event: { eventId: string; type: string },
  hashKey: string,
): Promise<OrderRecord> {
  const hash = await customerHash(hashKey, checkout.email);
  const totals = computeTotals(
    checkout.lines.map((l) => ({ priceTtcCents: l.unitAmountCents, vatRate: l.vatRate, quantity: l.quantity })),
  );
  const m = checkout.metadata;
  return {
    event_id: event.eventId,
    event_type: event.type,
    shop_id: m.shopId,
    session_id: checkout.sessionId,
    payment_intent_id: checkout.paymentIntentId,
    slot_start: m.slotStart,
    slot_end: m.slotEnd,
    email: checkout.email.trim(),
    phone: checkout.phone,
    customer_name: checkout.name?.trim() || null,
    customer_hash: hash,
    // Le montant réellement débité fait foi.
    total_cents: checkout.amountTotalCents,
    vat_breakdown: totals.vatByRate,
    items: checkout.lines.map((l) => ({
      product_id: l.productId,
      name: l.name,
      format: l.format,
      unit_price_cents: l.unitAmountCents,
      vat_rate: l.vatRate,
      quantity: l.quantity,
      is_alcohol: l.isAlcohol,
    })),
    consent: m.marketingAccepted ? { version: m.consentVersion, hash: m.consentHash } : null,
  };
}

/**
 * POST /api/webhooks/stripe. 400 si la signature est invalide (rien n'est écrit) ; 200 pour un événement ignoré
 * (autre compte connecté, type non géré) ou déjà traité ; 500 si l'enregistrement échoue, pour que Stripe rejoue.
 */
export async function handleWebhook(
  rawBody: string,
  signature: string | null,
  deps: WebhookDeps,
): Promise<HandlerResult> {
  let event;
  try {
    event = await deps.provider.verifyWebhook(rawBody, signature);
  } catch (error) {
    if (error instanceof WebhookSignatureError) return { status: 400, body: { error: error.message } };
    await deps.alert("Webhook de paiement illisible", { error: String(error) });
    return { status: 500, body: { error: "Événement illisible" } };
  }
  // Tous les sites partagent la plateforme Stripe : chacun reçoit les événements de tous les comptes connectés.
  if (event.account !== deps.provider.accountId) {
    return { status: 200, body: { received: true, ignored: "autre compte connecté" } };
  }
  if (event.kind === "ignored") return { status: 200, body: { received: true, ignored: event.type } };
  if (event.checkout.metadata.shopId !== deps.shopId) {
    return { status: 200, body: { received: true, ignored: "autre boutique" } };
  }
  try {
    const result = await deps.record(await toOrderRecord(event.checkout, event, deps.hashKey));
    if (result.status === "created") deps.afterRecord?.();
    return { status: 200, body: { received: true, ...result } };
  } catch (error) {
    await deps.alert("Paiement reçu mais commande non enregistrée", {
      eventId: event.eventId,
      sessionId: event.checkout.sessionId,
      error: String(error),
    });
    return { status: 500, body: { error: "Enregistrement impossible, Stripe va rejouer l'événement" } };
  }
}
