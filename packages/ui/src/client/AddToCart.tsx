"use client";

import { useEffect, useRef, useState } from "react";
import { addToCart } from "@launchpadfactoryteam/commerce";
import { updateCart } from "./cart-store.ts";

/**
 * Bouton d'ajout au panier. Désactivé et libellé « Indisponible » pour un produit coupé.
 * Après un ajout, le libellé confirme brièvement et une région live l'annonce aux lecteurs d'écran.
 */
export function AddToCart({
  shop,
  productId,
  productName,
  available,
  className,
  label = "Ajouter",
}: {
  shop: string;
  productId: string;
  productName: string;
  available: boolean;
  className: string;
  label?: string;
}) {
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function add() {
    updateCart(shop, (cart) => addToCart(cart, productId));
    setAdded(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 2000);
  }

  return (
    <>
      <button
        type="button"
        className={`btn ${className}`}
        data-add-to-cart={productId}
        data-added={added || undefined}
        disabled={!available}
        onClick={add}
        aria-label={available ? `${label} : ${productName}` : `${productName} indisponible`}
      >
        {available ? (added ? "Ajouté ✓" : label) : "Indisponible"}
      </button>
      <span className="sr-only" role="status">
        {added ? `${productName} ajouté au panier.` : ""}
      </span>
    </>
  );
}
