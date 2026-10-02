"use client";

import { useEffect, useState } from "react";
import { TIME_ZONE } from "@launchpadfactoryteam/commerce";
import { formatPrice } from "../format.ts";
import { clearOrder } from "./cart-store.ts";

type State =
  | { step: "waiting"; tries: number }
  | { step: "paid"; number: number; slotStart: string; slotEnd: string; totalCents: number }
  | { step: "late" }
  | { step: "missing" };

/** Intervalle entre deux interrogations, et nombre maximal avant d'afficher le message d'attente prolongée. */
const POLL_MS = 2000;
const MAX_TRIES = 30;

const day = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });
const time = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });

/** « mardi 6 octobre, entre 16:00 et 19:00 » */
export function slotText(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  return `${day.format(start)}, entre ${time.format(start)} et ${time.format(new Date(endIso))}`;
}

/**
 * Étape 3 : la commande est créée par le webhook, parfois quelques secondes après le paiement.
 * La page interroge le serveur jusqu'à la voir, puis vide le panier.
 */
export function ConfirmationView({ shop, where, variant }: { shop: string; where: string; variant: "A" | "B" | "C" }) {
  const v = variant.toLowerCase();
  const [state, setState] = useState<State>({ step: "waiting", tries: 0 });

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (!sessionId) return setState({ step: "missing" });
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      tries++;
      try {
        const res = await fetch(`/api/commande?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
        const body = await res.json();
        if (body.status === "paid") {
          clearOrder(shop);
          return setState({ step: "paid", ...body });
        }
      } catch {
        // Réseau coupé : on réessaie.
      }
      if (tries >= MAX_TRIES) return setState({ step: "late" });
      setState({ step: "waiting", tries });
      timer = setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => clearTimeout(timer);
  }, [shop]);

  return (
    <div className={`confirm confirm--${v}`}>
      <div role="status" aria-live="polite">
        {state.step === "waiting" && (
          <p className="confirm__lead">Paiement en cours de confirmation… Cette page se met à jour toute seule.</p>
        )}
        {state.step === "paid" && (
          <>
            <p className="confirm__lead">
              Merci ! Votre commande <strong>n° {state.number}</strong> est confirmée.
            </p>
            <dl className="confirm__facts">
              <div>
                <dt>Retrait</dt>
                <dd>{slotText(state.slotStart, state.slotEnd)}</dd>
              </div>
              <div>
                <dt>Adresse</dt>
                <dd>{where}</dd>
              </div>
              <div>
                <dt>Montant payé</dt>
                <dd className="price">{formatPrice(state.totalCents)}</dd>
              </div>
            </dl>
            <p className="confirm__note">
              Un email de confirmation vous est envoyé. Présentez simplement votre nom ou votre numéro de commande au
              retrait.
            </p>
          </>
        )}
        {state.step === "late" && (
          <p className="confirm__lead">
            Votre paiement est bien reçu par notre prestataire, la confirmation prend plus de temps que prévu. Vous
            recevrez un email dès que la commande est enregistrée.
          </p>
        )}
        {state.step === "missing" && <p className="confirm__lead">Aucune commande à afficher sur cette page.</p>}
      </div>
      <a className={`btn ${v}-btn ${v}-btn--ghost confirm__back`} href="/boutique">
        Retour à la boutique
      </a>
    </div>
  );
}
