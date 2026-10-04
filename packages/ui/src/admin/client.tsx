"use client";

import { useEffect, useMemo, useState } from "react";
import { pendingChanges } from "@launchpadfactoryteam/commerce";
import { formatPrice } from "../format.ts";

/** Liste des commandes : relue toutes les 30 secondes tant que l'onglet est visible (nouvelles commandes). */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  useEffect(() => {
    const timer = window.setInterval(() => {
      // Pas de rechargement pendant une saisie ou si l'onglet est caché.
      if (document.visibilityState === "visible" && !document.querySelector("form :focus")) window.location.reload();
    }, seconds * 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);
  return null;
}

export interface AvailabilityProduct {
  id: string;
  name: string;
  format: string;
  priceCents: number;
  imageUrl?: string;
  available: boolean;
}

const pendingLabel = (n: number) => `${n} modification${n > 1 ? "s" : ""}`;

const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Page Disponibilité : l'interrupteur bascule tout de suite à l'écran ; rien n'est écrit avant « Enregistrer ».
 * Le formulaire n'envoie que les produits basculés (« produit ») et, parmi eux, ceux remis en vente (« en_vente ») :
 * deux postes qui enregistrent en même temps n'écrasent pas les changements l'un de l'autre.
 */
export function AvailabilityForm({ products, savedCount }: { products: AvailabilityProduct[]; savedCount?: number }) {
  const saved = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p.available])), [products]);
  const [state, setState] = useState(saved);
  const [query, setQuery] = useState("");
  const changed = pendingChanges(saved, state);
  const onSale = Object.values(state).filter(Boolean).length;
  const q = normalize(query.trim());
  const visible = q ? products.filter((p) => normalize(`${p.name} ${p.format}`).includes(q)) : products;

  return (
    <form method="post" action="/api/admin/disponibilite" className="bo-availability">
      <div className="bo-title-row">
        <h1 className="bo-h1">Disponibilité</h1>
        <span className="bo-mono" aria-live="polite">
          {onSale} / {products.length} en vente
        </span>
      </div>
      <p className="bo-lead">
        Coupez un produit et il disparaît du site en moins d'une minute. Les prix et les textes restent gérés par
        LaunchPad.
      </p>
      {savedCount !== undefined && (
        <p className="bo-notice bo-notice--info" role="status">
          {savedCount === 0
            ? "Aucune modification à enregistrer."
            : `${savedCount} modification${savedCount > 1 ? "s" : ""} enregistrée${savedCount > 1 ? "s" : ""} : le site est à jour dans moins d'une minute.`}
        </p>
      )}
      <label htmlFor="bo-search" className="bo-sr">
        Rechercher un produit
      </label>
      <input
        id="bo-search"
        type="search"
        className="bo-search"
        placeholder="Rechercher un produit"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      <ul className="bo-products">
        {products.map((p) => {
          const on = state[p.id] ?? true;
          return (
            <li key={p.id} className="bo-product" hidden={!visible.includes(p)}>
              {changed.includes(p.id) && <input type="hidden" name="produit" value={p.id} />}
              {changed.includes(p.id) && on && <input type="hidden" name="en_vente" value={p.id} />}
              {p.imageUrl ? (
                <img className="bo-product__thumb" src={p.imageUrl} alt="" width={48} height={60} loading="lazy" />
              ) : (
                <span className="bo-product__thumb" aria-hidden="true" />
              )}
              <div className="bo-product__text">
                <p className="bo-product__name" id={`p-${p.id}`}>
                  {p.name}
                </p>
                <p className="bo-muted">
                  {p.format} · <span className="bo-num">{formatPrice(p.priceCents)}</span>
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-labelledby={`p-${p.id} s-${p.id}`}
                className="bo-switch"
                onClick={() => setState((s) => ({ ...s, [p.id]: !on }))}
              >
                <span className="bo-switch__track" aria-hidden="true">
                  <span className="bo-switch__knob" />
                </span>
                <span className="bo-sr" id={`s-${p.id}`}>
                  {on ? "En vente" : "Coupé"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {visible.length === 0 && <p className="bo-empty">Aucun produit ne correspond à « {query} ».</p>}
      <p className="bo-sr" aria-live="polite">
        {changed.length === 0 ? "" : `${pendingLabel(changed.length)} à enregistrer`}
      </p>
      <div className="bo-savebar" hidden={changed.length === 0}>
        <span>{pendingLabel(changed.length)}</span>
        <button type="submit" className="bo-btn bo-btn--primary">
          Enregistrer
        </button>
      </div>
    </form>
  );
}
