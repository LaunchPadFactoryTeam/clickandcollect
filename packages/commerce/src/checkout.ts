import { sanitizeCart } from "./cart.ts";
import { computeTotals, type Totals } from "./money.ts";
import { requiresAgeDeclaration, type SellableProduct } from "./order.ts";
import { findSlot, type PickupConfig, type PickupSlot } from "./slots.ts";

/**
 * Étape 2, côté serveur : tout ce que le navigateur envoie est relu. Les produits et les prix viennent du catalogue
 * courant, la disponibilité et le créneau sont revérifiés, la déclaration de majorité est exigée si besoin.
 */

export type CheckoutError =
  | { code: "EMPTY" }
  | { code: "UNAVAILABLE"; productIds: string[] }
  | { code: "SLOT_EXPIRED" }
  | { code: "AGE_REQUIRED" };

export interface CheckoutRequest {
  /** Panier tel qu'envoyé par le navigateur : seuls identifiants et quantités sont lus. */
  cart: unknown;
  slotId: unknown;
  ageDeclared: unknown;
}

export interface ValidCheckout<P extends SellableProduct> {
  ok: true;
  lines: { product: P; quantity: number }[];
  slot: PickupSlot;
  totals: Totals;
  hasAlcohol: boolean;
}

export function buildCheckout<P extends SellableProduct>(
  request: CheckoutRequest,
  ctx: { catalog: readonly P[]; pickup: PickupConfig; alcoholFeature: boolean; now: Date },
): ValidCheckout<P> | ({ ok: false } & CheckoutError) {
  const cart = sanitizeCart(request.cart);
  if (cart.length === 0) return { ok: false, code: "EMPTY" };

  const byId = new Map(ctx.catalog.map((p) => [p.id, p]));
  // Un produit inconnu (retiré du catalogue) ou coupé est signalé avant tout paiement.
  const unavailable = cart.filter((l) => !byId.get(l.productId)?.available).map((l) => l.productId);
  if (unavailable.length) return { ok: false, code: "UNAVAILABLE", productIds: unavailable };

  const slot = typeof request.slotId === "string" ? findSlot(ctx.pickup, request.slotId, ctx.now) : undefined;
  if (!slot) return { ok: false, code: "SLOT_EXPIRED" };

  const lines = cart.map((l) => ({ product: byId.get(l.productId)!, quantity: l.quantity }));
  const hasAlcohol = lines.some((l) => l.product.isAlcohol);
  if (requiresAgeDeclaration(ctx.alcoholFeature, { hasAlcohol }) && request.ageDeclared !== true) {
    return { ok: false, code: "AGE_REQUIRED" };
  }

  const totals = computeTotals(lines.map((l) => ({ ...l.product, quantity: l.quantity })));
  return { ok: true, lines, slot, totals, hasAlcohol };
}
