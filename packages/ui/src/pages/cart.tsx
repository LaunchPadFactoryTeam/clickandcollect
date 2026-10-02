import { splitAddress } from "@launchpadfactoryteam/seo";
import { PageShell } from "../chrome.tsx";
import { CartView, type CartProduct, type CartTexts } from "../client/CartView.tsx";
import type { Site, Variant } from "../shared.tsx";

/** Le strict nécessaire de chaque produit pour l'îlot panier (le reste du catalogue ne part pas au navigateur). */
export function cartProducts(site: Site): CartProduct[] {
  return site.content.catalog.map((p) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    format: p.format,
    priceTtcCents: p.priceTtcCents,
    vatRate: p.vatRate,
    available: p.available,
    isAlcohol: p.isAlcohol,
    ...(p.images?.[0] ? { image: { url: p.images[0].url, alt: p.images[0].alt } } : {}),
  }));
}

const hours = (h: number) => `${h} heure${h > 1 ? "s" : ""}`;

function texts(site: Site, variant: Variant): CartTexts {
  const { adresse } = site.config.boutique;
  const delay = site.config.retrait.delai_preparation_heures;
  const a = splitAddress(adresse);
  if (variant === "C") {
    return {
      slotLegend: "Quand passez-vous ?",
      where: `${a.street}. ${delay ? `Il nous faut ${hours(delay)} pour préparer.` : "Commande prête dès le début du créneau."}`,
    };
  }
  return {
    slotLegend: "Créneau de retrait",
    where: `${a.street}, ${a.postalCode} ${a.city}. ${delay ? `Préparation en ${hours(delay)} minimum.` : "Commande prête dès le début du créneau."}`,
  };
}

/** Indicateur des trois étapes du tunnel ; l'étape en cours porte aria-current="step". */
export function Steps({ variant, current }: { variant: Variant; current: 1 | 2 | 3 }) {
  const labels = [variant === "B" ? "Panier" : "Panier & créneau", "Paiement", "Confirmation"];
  return (
    <ol className={`steps steps--${variant.toLowerCase()}`} aria-label="Étapes de la commande">
      {labels.map((label, i) => (
        <li
          key={label}
          aria-current={i + 1 === current ? "step" : undefined}
          className={i + 1 <= current ? "is-done" : undefined}
        >
          <span className="steps__n" aria-hidden="true">
            {i + 1}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function Cart({ site, variant }: { site: Site; variant: Variant }) {
  const v = variant.toLowerCase();
  const { settings } = site.content.pages;
  return (
    <PageShell site={site} variant={variant} current="panier">
      <section className={`cart-page cart-page--${v}`}>
        <Steps variant={variant} current={1} />
        <h1 className={`cart-page__title ${v}-cart-title`}>Votre panier</h1>
        <CartView
          shop={site.config.boutique.domaine}
          variant={variant}
          products={cartProducts(site)}
          pickup={site.config.retrait}
          texts={texts(site, variant)}
          alcoholFeature={site.config.features.alcool}
          marketing={{ text: settings.marketingConsentText, version: settings.marketingConsentVersion }}
        />
      </section>
    </PageShell>
  );
}

export const CartA = ({ site }: { site: Site }) => <Cart site={site} variant="A" />;
export const CartB = ({ site }: { site: Site }) => <Cart site={site} variant="B" />;
export const CartC = ({ site }: { site: Site }) => <Cart site={site} variant="C" />;
