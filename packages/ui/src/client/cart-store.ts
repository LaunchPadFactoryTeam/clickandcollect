import { useSyncExternalStore } from "react";
import { cartStorageKey, parseCart, type CartLine } from "@launchpadfactoryteam/commerce";

/**
 * Panier du navigateur, dans localStorage (une clé par boutique), partagé entre les îlots de la page
 * et synchronisé entre onglets. Ne contient que des identifiants et des quantités.
 */

const listeners = new Set<() => void>();
/** Un instantané stable par filtre d'identifiants : useSyncExternalStore exige la même référence tant que rien ne change. */
const caches = new Map<ReadonlySet<string> | undefined, { raw: string | null; value: CartLine[] }>();

function readRaw(shop: string): string | null {
  try {
    return window.localStorage.getItem(cartStorageKey(shop));
  } catch {
    // Stockage refusé (navigation privée stricte) : panier vide, le site reste utilisable.
    return null;
  }
}

function snapshot(shop: string, ids?: ReadonlySet<string>): CartLine[] {
  const raw = readRaw(shop);
  let cached = caches.get(ids);
  if (!cached || cached.raw !== raw) {
    cached = { raw, value: parseCart(raw, ids) };
    caches.set(ids, cached);
  }
  return cached.value;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key?.startsWith("lp:panier:")) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Lit le panier ; `null` tant que la page n'est pas hydratée (rendu serveur : panier inconnu). */
export function useCart(shop: string, ids?: ReadonlySet<string>): CartLine[] | null {
  return useSyncExternalStore<CartLine[] | null>(
    subscribe,
    () => snapshot(shop, ids),
    () => null,
  );
}

/** Applique une modification et prévient tous les îlots abonnés. */
export function updateCart(shop: string, change: (cart: CartLine[]) => CartLine[]) {
  const next = change(snapshot(shop));
  try {
    if (next.length) window.localStorage.setItem(cartStorageKey(shop), JSON.stringify(next));
    else window.localStorage.removeItem(cartStorageKey(shop));
  } catch {
    return;
  }
  for (const listener of listeners) listener();
}

/** Choix de l'étape 1 (créneau, cases cochées), transmis à l'étape 2 le temps de l'onglet. */
export interface OrderChoice {
  slotId: string;
  ageDeclared: boolean;
  marketing: boolean;
}

const choiceKey = (shop: string) => `lp:commande:${shop}`;

export function saveOrderChoice(shop: string, choice: OrderChoice): boolean {
  try {
    window.sessionStorage.setItem(choiceKey(shop), JSON.stringify(choice));
    return true;
  } catch {
    return false;
  }
}

export function readOrderChoice(shop: string): OrderChoice | null {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(choiceKey(shop)) ?? "null") as Partial<OrderChoice> | null;
    return raw && typeof raw.slotId === "string"
      ? { slotId: raw.slotId, ageDeclared: raw.ageDeclared === true, marketing: raw.marketing === true }
      : null;
  } catch {
    return null;
  }
}

/** Commande payée : panier et choix effacés. */
export function clearOrder(shop: string) {
  try {
    window.sessionStorage.removeItem(choiceKey(shop));
  } catch {
    // rien à effacer
  }
  updateCart(shop, () => []);
}
