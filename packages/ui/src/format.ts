/** Formats d'affichage, sans dépendance : utilisables dans les composants serveur comme dans les îlots client. */

/** 1250 → « 12,50 € » (espace insécable avant l'euro). */
export function formatPrice(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")}\u00a0€`;
}

/** 5.5 → « 5,5 % ». */
export function formatVat(rate: number): string {
  return `${String(rate).replace(".", ",")}\u00a0%`;
}
