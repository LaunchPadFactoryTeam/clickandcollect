import type { CartLine } from "./cart.ts";
import { computeTotals, type Totals } from "./money.ts";

/** Ce que le panier a besoin de savoir d'un produit ; le prix vient toujours du catalogue, jamais du navigateur. */
export interface SellableProduct {
  id: string;
  priceTtcCents: number;
  vatRate: number;
  available: boolean;
  isAlcohol?: boolean;
}

export interface ResolvedLine<P extends SellableProduct> {
  product: P;
  quantity: number;
  lineTotalCents: number;
}

export interface ResolvedCart<P extends SellableProduct> {
  /** Lignes vendables, prises en compte dans les montants. */
  lines: ResolvedLine<P>[];
  /** Produits coupés depuis l'ajout : affichés, exclus des montants, à retirer avant de payer. */
  unavailable: ResolvedLine<P>[];
  totals: Totals;
  /** Au moins une ligne vendable est alcoolisée. */
  hasAlcohol: boolean;
}

/** Rapproche le panier du catalogue courant ; les produits inconnus sont ignorés. */
export function resolveCart<P extends SellableProduct>(
  cart: readonly CartLine[],
  catalog: readonly P[],
): ResolvedCart<P> {
  const byId = new Map(catalog.map((p) => [p.id, p]));
  const lines: ResolvedLine<P>[] = [];
  const unavailable: ResolvedLine<P>[] = [];
  for (const { productId, quantity } of cart) {
    const product = byId.get(productId);
    if (!product) continue;
    const line = { product, quantity, lineTotalCents: product.priceTtcCents * quantity };
    (product.available ? lines : unavailable).push(line);
  }
  return {
    lines,
    unavailable,
    totals: computeTotals(lines.map((l) => ({ ...l.product, quantity: l.quantity }))),
    hasAlcohol: lines.some((l) => l.product.isAlcohol),
  };
}

/** La case de déclaration de majorité est due si l'option alcool est active et qu'une ligne est alcoolisée. */
export function requiresAgeDeclaration(
  alcoholFeature: boolean,
  cart: Pick<ResolvedCart<SellableProduct>, "hasAlcohol">,
) {
  return alcoholFeature && cart.hasAlcohol;
}
