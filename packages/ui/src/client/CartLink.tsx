"use client";

import { cartCount } from "@launchpadfactoryteam/commerce";
import { useCart } from "./cart-store.ts";

/** Lien « Panier » de l'en-tête avec le nombre d'articles ; le nombre apparaît une fois la page hydratée. */
export function CartLink({
  shop,
  className,
  format,
  current,
}: {
  shop: string;
  className: string;
  /** Mise en forme du libellé selon le template : « Panier · 3 » ou « Panier (3) ». */
  format: "dot" | "paren";
  current: boolean;
}) {
  const cart = useCart(shop);
  const count = cart ? cartCount(cart) : 0;
  const label = format === "paren" ? `Panier (${count})` : `Panier · ${count}`;
  return (
    <a
      className={className}
      href="/panier"
      aria-current={current ? "page" : undefined}
      aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}`}
    >
      {label}
    </a>
  );
}
