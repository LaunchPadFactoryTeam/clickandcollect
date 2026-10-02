/** Taux de TVA d'une épicerie fine : réduit (5,5 %) pour l'alimentaire, normal (20 %) pour l'alcool. */
export type VatRate = 5.5 | 20;

/**
 * TVA contenue dans un montant TTC, au centime le plus proche :
 * arrondi(TTC × taux / (100 + taux)). Calcul en entiers (taux × 10) pour éviter les erreurs de virgule flottante.
 */
export function vatFromTtc(ttcCents: number, rate: number): number {
  const r10 = Math.round(rate * 10);
  const numerator = ttcCents * r10;
  const denominator = 1000 + r10;
  // Arrondi « au plus proche », moitié vers le haut (montants positifs).
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

export interface PricedLine {
  priceTtcCents: number;
  vatRate: number;
  quantity: number;
}

export interface Totals {
  /** Somme TTC des lignes ; le retrait est gratuit en V1, donc total = sous-total. */
  subtotalCents: number;
  totalCents: number;
  /** TVA par taux présent, calculée sur le total TTC de ce taux. */
  vatByRate: Record<string, number>;
  /** Les mêmes montants, du plus petit taux au plus grand : l'ordre des lignes du récapitulatif. */
  vatLines: { rate: number; cents: number }[];
}

/** Montants du récapitulatif. */
export function computeTotals(lines: readonly PricedLine[]): Totals {
  const ttcByRate = new Map<number, number>();
  let subtotalCents = 0;
  for (const line of lines) {
    const amount = line.priceTtcCents * line.quantity;
    subtotalCents += amount;
    ttcByRate.set(line.vatRate, (ttcByRate.get(line.vatRate) ?? 0) + amount);
  }
  // Un objet range ses clés entières (« 20 ») avant les autres (« 5.5 ») : l'ordre d'affichage vient de vatLines.
  const vatLines = [...ttcByRate.keys()]
    .sort((a, b) => a - b)
    .map((rate) => ({ rate, cents: vatFromTtc(ttcByRate.get(rate)!, rate) }));
  const vatByRate = Object.fromEntries(vatLines.map((l) => [String(l.rate), l.cents]));
  return { subtotalCents, totalCents: subtotalCents, vatByRate, vatLines };
}
