"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  computeSlots,
  MAX_QUANTITY,
  removeFromCart,
  requiresAgeDeclaration,
  resolveCart,
  setQuantity,
  type PickupConfig,
  type PickupSlot,
} from "@launchpadfactoryteam/commerce";
import { formatPrice, formatVat } from "../format.ts";
import { saveOrderChoice, updateCart, useCart } from "./cart-store.ts";

/** Ce que la page panier reçoit de chaque produit : de quoi afficher une ligne et calculer les montants. */
export interface CartProduct {
  id: string;
  slug: string;
  name: string;
  format: string;
  priceTtcCents: number;
  vatRate: number;
  available: boolean;
  isAlcohol: boolean;
  image?: { url: string; alt?: string };
}

export interface CartTexts {
  slotLegend: string;
  /** Rappel de l'adresse et du délai de préparation, sous la légende des créneaux. */
  where: string;
}

/** Nombre de créneaux affichés avant « Afficher d'autres créneaux ». */
const SLOTS_SHOWN = 6;

/**
 * Étape 1 du tunnel : lignes du panier, créneau de retrait, récapitulatif avec la TVA par taux, cases de majorité
 * (si alcool) et marketing. Rendue côté navigateur : le panier vit dans localStorage et les créneaux dépendent de l'heure.
 */
export function CartView({
  shop,
  variant,
  products,
  pickup,
  texts,
  alcoholFeature,
  marketing,
}: {
  shop: string;
  variant: "A" | "B" | "C";
  products: CartProduct[];
  pickup: PickupConfig;
  texts: CartTexts;
  alcoholFeature: boolean;
  marketing: { text: string; version: string };
}) {
  const v = variant.toLowerCase();
  const ids = useMemo(() => new Set(products.map((p) => p.id)), [products]);
  const cart = useCart(shop, ids);
  const rawCart = useCart(shop);
  const [slots, setSlots] = useState<PickupSlot[]>([]);
  const [slotId, setSlotId] = useState<string>();
  const [allSlots, setAllSlots] = useState(false);
  const [message, setMessage] = useState("");

  // Les créneaux dépendent de l'heure : calculés dans le navigateur, une fois la page hydratée.
  useEffect(() => setSlots(computeSlots(pickup, new Date())), [pickup]);

  // Un produit retiré du catalogue disparaît du panier stocké dès le chargement.
  useEffect(() => {
    if (rawCart && cart && rawCart.length !== cart.length)
      updateCart(shop, (c) => c.filter((l) => ids.has(l.productId)));
  }, [rawCart, cart, ids, shop]);

  if (cart === null) return <div className={`cart cart--${v} cart--loading`} aria-busy="true" />;

  const resolved = resolveCart(cart, products);
  const lines = [...resolved.lines, ...resolved.unavailable].sort(
    (a, b) => cart.findIndex((l) => l.productId === a.product.id) - cart.findIndex((l) => l.productId === b.product.id),
  );

  if (lines.length === 0) {
    return (
      <div className={`cart cart--${v} cart__empty`}>
        <p>Votre panier est vide.</p>
        <a className={`btn ${v}-btn ${v}-btn--primary`} href="/boutique">
          Voir les produits
        </a>
      </div>
    );
  }

  const chosen = slots.find((s) => s.id === slotId) ?? slots[0];
  const ageRequired = requiresAgeDeclaration(alcoholFeature, resolved);
  const blocked = resolved.unavailable.length > 0 || !chosen;
  const visibleSlots = allSlots ? slots : slots.slice(0, SLOTS_SHOWN);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Le choix du créneau et des cases accompagne le panier vers l'étape 2 ; le serveur revérifie tout.
    const form = new FormData(e.currentTarget);
    const saved = saveOrderChoice(shop, {
      slotId: chosen!.id,
      ageDeclared: form.get("majorite") === "on",
      marketing: form.get("marketing") === "on",
    });
    if (saved) window.location.assign("/paiement");
    else setMessage("Votre navigateur bloque le stockage local : impossible de poursuivre la commande sur ce site.");
  }

  return (
    <form className={`cart cart--${v}`} onSubmit={submit} noValidate={false}>
      <div className="cart__main">
        <ul className="cart__lines">
          {lines.map(({ product, quantity, lineTotalCents }) => (
            <li key={product.id} className={`cart__line${product.available ? "" : " cart__line--off"}`}>
              <div className="cart__thumb">
                {product.image ? (
                  <img src={product.image.url} alt="" width={144} height={180} loading="lazy" decoding="async" />
                ) : (
                  <div className="ph" aria-hidden="true" />
                )}
              </div>
              <div className="cart__info">
                <h2 className="cart__name">
                  <a href={`/produits/${product.slug}`}>{product.name}</a>
                </h2>
                <p className="cart__format">
                  {product.format} · {formatPrice(product.priceTtcCents)}
                </p>
                {product.available ? (
                  <div className="cart__qty" role="group" aria-label={`Quantité de ${product.name}`}>
                    <button
                      type="button"
                      className="cart__step"
                      aria-label={`Retirer une unité de ${product.name}`}
                      disabled={quantity <= 1}
                      onClick={() => updateCart(shop, (c) => setQuantity(c, product.id, quantity - 1))}
                    >
                      −
                    </button>
                    <span className="cart__count" aria-live="polite">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      className="cart__step"
                      aria-label={`Ajouter une unité de ${product.name}`}
                      disabled={quantity >= MAX_QUANTITY}
                      onClick={() => updateCart(shop, (c) => setQuantity(c, product.id, quantity + 1))}
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <p className="cart__off">Indisponible : ce produit n'est plus proposé pour le moment.</p>
                )}
                <button
                  type="button"
                  className="cart__remove"
                  aria-label={`Retirer ${product.name} du panier`}
                  onClick={() => updateCart(shop, (c) => removeFromCart(c, product.id))}
                >
                  Retirer
                </button>
              </div>
              <span className="price cart__total-line">{product.available ? formatPrice(lineTotalCents) : "—"}</span>
            </li>
          ))}
        </ul>

        <fieldset className="cart__slots">
          <legend className="cart__legend">{texts.slotLegend}</legend>
          <p className="cart__where">{texts.where}</p>
          {slots.length === 0 ? (
            <p className="cart__warn">Aucun créneau de retrait n'est ouvert dans les 14 prochains jours.</p>
          ) : (
            <div className="cart__slot-list">
              {visibleSlots.map((s) => (
                <label key={s.id} className="cart__slot">
                  <input
                    type="radio"
                    name="creneau"
                    value={s.id}
                    checked={s.id === chosen?.id}
                    onChange={() => setSlotId(s.id)}
                  />
                  <span className="cart__slot-label">{s.label}</span>
                  {s.note && <span className="cart__slot-note">{s.note}</span>}
                </label>
              ))}
            </div>
          )}
          {!allSlots && slots.length > SLOTS_SHOWN && (
            <button type="button" className="cart__more" onClick={() => setAllSlots(true)}>
              Afficher d'autres créneaux
            </button>
          )}
        </fieldset>
      </div>

      <aside className="cart__summary" aria-labelledby="recapitulatif">
        <h2 id="recapitulatif" className="cart__summary-title">
          Récapitulatif
        </h2>
        <dl className="cart__amounts">
          <div>
            <dt>Sous-total</dt>
            <dd className="price">{formatPrice(resolved.totals.subtotalCents)}</dd>
          </div>
          {resolved.totals.vatLines.map(({ rate, cents }) => (
            <div key={rate}>
              <dt>Dont TVA {formatVat(rate)}</dt>
              <dd className="price">{formatPrice(cents)}</dd>
            </div>
          ))}
          <div>
            <dt>Retrait en boutique</dt>
            <dd>Gratuit</dd>
          </div>
        </dl>
        <p className="cart__grand">
          <span>Total</span>
          <span className="price">{formatPrice(resolved.totals.totalCents)}</span>
        </p>
        {chosen && <p className="cart__chosen">Créneau retenu : {chosen.label}</p>}

        <div className="cart__consents">
          {ageRequired && (
            <label className="cart__check cart__check--age">
              <input type="checkbox" name="majorite" required />
              <span>
                <strong>Je déclare avoir 18 ans ou plus.</strong> Votre panier contient une boisson alcoolisée ; la
                vente aux mineurs de moins de 18 ans est interdite.
                <span className="req" aria-hidden="true">
                  {" "}
                  *
                </span>
              </span>
            </label>
          )}
          <label className="cart__check">
            <input type="checkbox" name="marketing" />
            <span>{marketing.text}</span>
          </label>
        </div>

        {resolved.unavailable.length > 0 && (
          <p className="cart__warn" role="alert">
            Retirez les produits indisponibles pour continuer.
          </p>
        )}
        <button type="submit" className={`btn ${v}-btn ${v}-btn--primary cart__pay`} disabled={blocked}>
          Passer au paiement
        </button>
        <p className="cart__status" role="status">
          {message}
        </p>
        <p className="cart__secure">
          Paiement sécurisé par Stripe. Aucune donnée bancaire n'est conservée par la boutique.
        </p>
      </aside>
    </form>
  );
}
