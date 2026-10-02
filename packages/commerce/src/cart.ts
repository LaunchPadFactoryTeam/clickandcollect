/** Une ligne de panier : un identifiant et une quantité, jamais de prix (recalculés côté serveur). */
export interface CartLine {
  productId: string;
  quantity: number;
}

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 20;

const clamp = (q: number) => Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.trunc(q)));

/** Clé de stockage du panier, propre à chaque boutique. */
export function cartStorageKey(shop: string): string {
  return `lp:panier:${shop}`;
}

/** Ajoute `quantity` unités ; un produit déjà présent garde une seule ligne. */
export function addToCart(cart: readonly CartLine[], productId: string, quantity = 1): CartLine[] {
  const existing = cart.find((l) => l.productId === productId);
  if (!existing) return [...cart, { productId, quantity: clamp(quantity) }];
  return cart.map((l) => (l.productId === productId ? { ...l, quantity: clamp(l.quantity + quantity) } : l));
}

/** Fixe la quantité d'une ligne entre 1 et 20 ; le bouton − ne descend pas sous 1 (retirer est une action à part). */
export function setQuantity(cart: readonly CartLine[], productId: string, quantity: number): CartLine[] {
  if (!Number.isFinite(quantity)) return [...cart];
  return cart.map((l) => (l.productId === productId ? { ...l, quantity: clamp(quantity) } : l));
}

export function removeFromCart(cart: readonly CartLine[], productId: string): CartLine[] {
  return cart.filter((l) => l.productId !== productId);
}

export function cartCount(cart: readonly CartLine[]): number {
  return cart.reduce((n, l) => n + l.quantity, 0);
}

/**
 * Relit un panier stocké : ignore ce qui n'est pas une ligne valide, fusionne les doublons, plafonne les quantités
 * et retire les produits absents du catalogue courant (`knownIds`).
 */
export function sanitizeCart(raw: unknown, knownIds?: ReadonlySet<string>): CartLine[] {
  if (!Array.isArray(raw)) return [];
  let cart: CartLine[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const { productId, quantity } = item as Record<string, unknown>;
    if (typeof productId !== "string" || !productId) continue;
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity < MIN_QUANTITY) continue;
    if (knownIds && !knownIds.has(productId)) continue;
    cart = addToCart(cart, productId, quantity);
  }
  return cart;
}

export function parseCart(json: string | null, knownIds?: ReadonlySet<string>): CartLine[] {
  if (!json) return [];
  try {
    return sanitizeCart(JSON.parse(json), knownIds);
  } catch {
    return [];
  }
}
