"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { resolveCart } from "@launchpadfactoryteam/commerce";
import { formatPrice } from "../format.ts";
import { readOrderChoice, useCart } from "./cart-store.ts";
import type { CartProduct } from "./CartView.tsx";

interface Created {
  provider: "stripe" | "fake";
  sessionId: string;
  clientSecret: string;
  publishableKey?: string;
  accountId?: string;
  totalCents: number;
  slotLabel: string;
}

type State =
  | { step: "loading" }
  | { step: "error"; title: string; detail?: string; back: boolean }
  | { step: "ready"; created: Created };

interface StripeEmbedded {
  mount(el: HTMLElement): void;
  destroy(): void;
}
type StripeFactory = (
  key: string,
  opts: { stripeAccount?: string },
) => {
  initEmbeddedCheckout(opts: { fetchClientSecret: () => Promise<string> }): Promise<StripeEmbedded>;
};

/** Stripe.js n'est chargé que sur cette page, au moment d'afficher le formulaire. */
function loadStripe(): Promise<StripeFactory> {
  const w = window as unknown as { Stripe?: StripeFactory };
  if (w.Stripe) return Promise.resolve(w.Stripe);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.onload = () => (w.Stripe ? resolve(w.Stripe) : reject(new Error("Stripe.js indisponible")));
    script.onerror = () => reject(new Error("Stripe.js n'a pas pu être chargé"));
    document.head.append(script);
  });
}

function errorState(status: number, body: { code?: string; products?: { name: string | null }[] }): State {
  switch (body.code) {
    case "UNAVAILABLE":
      return {
        step: "error",
        title: "Un produit de votre panier n'est plus disponible.",
        detail: `${(body.products ?? []).map((p) => p.name ?? "Produit retiré").join(", ")} : retirez-le de votre panier pour continuer.`,
        back: true,
      };
    case "SLOT_EXPIRED":
      return {
        step: "error",
        title: "Ce créneau de retrait n'est plus disponible.",
        detail: "Choisissez-en un autre.",
        back: true,
      };
    case "AGE_REQUIRED":
      return {
        step: "error",
        title: "La déclaration de majorité est nécessaire pour acheter de l'alcool.",
        detail: "Cochez la case sur la page panier.",
        back: true,
      };
    case "EMPTY":
      return { step: "error", title: "Votre panier est vide.", back: true };
    case "PAYMENT_UNAVAILABLE":
      return { step: "error", title: "Le paiement en ligne n'est pas encore ouvert sur ce site.", back: true };
    default:
      return {
        step: "error",
        title: "Le paiement n'a pas pu être préparé.",
        detail: `Réessayez dans un instant (erreur ${status}).`,
        back: true,
      };
  }
}

/**
 * Étape 2 du tunnel : le serveur revérifie le panier et ouvre la session, puis le formulaire Stripe Checkout
 * s'affiche dans la page (le client ne quitte jamais le domaine de la boutique). Faux fournisseur : formulaire de test.
 */
export function CheckoutView({
  shop,
  variant,
  products,
}: {
  shop: string;
  variant: "A" | "B" | "C";
  products: CartProduct[];
}) {
  const v = variant.toLowerCase();
  const ids = useMemo(() => new Set(products.map((p) => p.id)), [products]);
  const cart = useCart(shop, ids);
  const [state, setState] = useState<State>({ step: "loading" });
  const started = useRef(false);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cart === null || started.current) return;
    started.current = true;
    const choice = readOrderChoice(shop);
    if (cart.length === 0) return setState({ step: "error", title: "Votre panier est vide.", back: true });
    if (!choice) return setState({ step: "error", title: "Choisissez d'abord votre créneau de retrait.", back: true });
    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cart, ...choice }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        setState(res.ok ? { step: "ready", created: body as Created } : errorState(res.status, body));
      })
      .catch(() => setState(errorState(0, {})));
  }, [cart, shop]);

  // Formulaire Stripe intégré, monté une fois la session créée.
  useEffect(() => {
    if (state.step !== "ready" || state.created.provider !== "stripe" || !frame.current) return;
    const { publishableKey, accountId, clientSecret } = state.created;
    let checkout: StripeEmbedded | undefined;
    let cancelled = false;
    loadStripe()
      .then((Stripe) =>
        Stripe(publishableKey!, { stripeAccount: accountId }).initEmbeddedCheckout({
          fetchClientSecret: () => Promise.resolve(clientSecret),
        }),
      )
      .then((c) => {
        checkout = c;
        if (cancelled) c.destroy();
        else c.mount(frame.current!);
      })
      .catch((error: Error) =>
        setState({
          step: "error",
          title: "Le formulaire de paiement n'a pas pu s'afficher.",
          detail: error.message,
          back: true,
        }),
      );
    return () => {
      cancelled = true;
      checkout?.destroy();
    };
  }, [state]);

  const resolved = cart ? resolveCart(cart, products) : null;

  return (
    <div className={`cart cart--${v} pay`}>
      <div className="cart__main">
        {state.step === "loading" && (
          <p className="pay__status" role="status">
            Vérification du panier et du créneau…
          </p>
        )}
        {state.step === "error" && (
          <div className="pay__error" role="alert">
            <p className="pay__error-title">{state.title}</p>
            {state.detail && <p>{state.detail}</p>}
            {state.back && (
              <a className={`btn ${v}-btn ${v}-btn--primary`} href="/panier">
                Revenir au panier
              </a>
            )}
          </div>
        )}
        {state.step === "ready" && state.created.provider === "stripe" && <div ref={frame} className="pay__frame" />}
        {state.step === "ready" && state.created.provider === "fake" && (
          <FakePaymentForm created={state.created} variant={variant} />
        )}
      </div>

      <aside className="cart__summary" aria-labelledby="votre-commande">
        <h2 id="votre-commande" className="cart__summary-title">
          Votre commande
        </h2>
        {resolved && (
          <ul className="pay__lines">
            {resolved.lines.map((l) => (
              <li key={l.product.id}>
                <span>
                  {l.quantity} × {l.product.name}
                </span>
                <span className="price">{formatPrice(l.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
        )}
        {state.step === "ready" && (
          <>
            <p className="cart__grand">
              <span>Total</span>
              <span className="price">{formatPrice(state.created.totalCents)}</span>
            </p>
            <p className="cart__chosen">Retrait : {state.created.slotLabel}</p>
          </>
        )}
        <a className="pay__edit" href="/panier">
          Modifier le panier ou le créneau
        </a>
      </aside>
    </div>
  );
}

/** Mode test (LP_PSP=fake) : imite les champs de Stripe Checkout et déclenche le webhook simulé. */
function FakePaymentForm({ created, variant }: { created: Created; variant: "A" | "B" | "C" }) {
  const v = variant.toLowerCase();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function pay(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/paiement-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: created.sessionId,
        email: form.get("email"),
        phone: form.get("telephone") || undefined,
        name: form.get("nom") || undefined,
      }),
    });
    if (res.ok) window.location.assign(`/confirmation?session_id=${encodeURIComponent(created.sessionId)}`);
    else {
      setBusy(false);
      setError(`Paiement de test refusé (${res.status}).`);
    }
  }

  return (
    <form className="pay__fake" onSubmit={pay}>
      <p className="pay__badge">Mode test : aucun paiement réel</p>
      <label htmlFor="pay-nom">Nom sur la carte</label>
      <input id="pay-nom" name="nom" type="text" autoComplete="cc-name" required />
      <label htmlFor="pay-email">Email</label>
      <input id="pay-email" name="email" type="email" autoComplete="email" required />
      <label htmlFor="pay-tel">Téléphone (facultatif)</label>
      <input id="pay-tel" name="telephone" type="tel" autoComplete="tel" />
      <label className="cart__check">
        <input type="checkbox" name="cgv" required />
        <span>
          J'accepte les <a href="/cgv">conditions générales de vente</a>. Les denrées périssables ne sont pas soumises
          au droit de rétractation.
        </span>
      </label>
      <button type="submit" className={`btn ${v}-btn ${v}-btn--primary cart__pay`} disabled={busy}>
        Payer {formatPrice(created.totalCents)}
      </button>
      {error && (
        <p className="cart__warn" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
