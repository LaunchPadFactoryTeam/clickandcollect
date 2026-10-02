import type { ClientConfig } from "@launchpadfactoryteam/config";
import type { CatalogProduct, ContentSnapshot, OpeningHours } from "@launchpadfactoryteam/content";
import { pickupSummary, preparationLabel, siteUrl, splitAddress } from "./facts.ts";

/** Titres pensés pour le local : dénomination, puis catégorie, puis ville. */
export function productTitle(product: Pick<CatalogProduct, "name" | "category">, config: ClientConfig): string {
  const { city } = splitAddress(config.boutique.adresse);
  return [product.name, product.category.name, city].filter(Boolean).join(" — ");
}

export function pageTitle(page: string | null, config: ClientConfig): string {
  const { city } = splitAddress(config.boutique.adresse);
  const shop = config.boutique.nom;
  return page ? `${page} — ${shop}` : `${shop} — épicerie fine à ${city}, retrait en boutique`;
}

/** Description générée d'une fiche (les pages éditoriales ont la leur, rédigée à la main). */
export function productDescription(product: CatalogProduct, config: ClientConfig): string {
  const price = (product.priceTtcCents / 100).toFixed(2).replace(".", ",");
  return `${product.name}, ${product.format}, ${price} € chez ${config.boutique.nom}. Commande en ligne, retrait en boutique à ${splitAddress(config.boutique.adresse).city}.`;
}

const SCHEMA_DAYS: Record<string, string> = {
  lundi: "Monday",
  mardi: "Tuesday",
  mercredi: "Wednesday",
  jeudi: "Thursday",
  vendredi: "Friday",
  samedi: "Saturday",
  dimanche: "Sunday",
};

export function openingHoursSpecification(hours: readonly OpeningHours[]) {
  return hours.flatMap((h) =>
    h.plages.map((plage) => {
      const [opens, closes] = plage.split("-");
      return {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: h.jours.map((j) => `https://schema.org/${SCHEMA_DAYS[j]}`),
        opens,
        closes,
      };
    }),
  );
}

export function groceryStoreJsonLd(config: ClientConfig, content: Pick<ContentSnapshot, "pages">) {
  const address = splitAddress(config.boutique.adresse);
  const url = siteUrl(config);
  const { settings } = content.pages;
  return {
    "@context": "https://schema.org",
    "@type": "GroceryStore",
    "@id": `${url}/#boutique`,
    name: config.boutique.nom,
    url,
    telephone: config.boutique.telephone,
    email: settings.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: address.street,
      postalCode: address.postalCode,
      addressLocality: address.city,
      addressCountry: "FR",
    },
    openingHoursSpecification: openingHoursSpecification(settings.openingHours),
    ...(settings.googleBusinessUrl ? { sameAs: [settings.googleBusinessUrl] } : {}),
    // Faits utiles aux assistants : retrait en boutique, créneaux et délai, en texte.
    description: [
      `Click & collect : commande et paiement en ligne, retrait en boutique (${preparationLabel(config.retrait.delai_preparation_heures)}).`,
      ...pickupSummary(config.retrait.creneaux).map((l) => `Créneaux : ${l.days}, ${l.slots}.`),
    ].join(" "),
  };
}

export function productJsonLd(product: CatalogProduct, config: ClientConfig) {
  const url = `${siteUrl(config)}/produits/${product.slug}`;
  const allergens = product.inco.allergens ?? [];
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#produit`,
    name: product.name,
    sku: product.id,
    url,
    category: product.category.name,
    ...(product.description ? { description: product.description } : {}),
    ...(product.producer ? { brand: { "@type": "Brand", name: product.producer } } : {}),
    ...(product.images?.length ? { image: product.images.map((i) => i.url) } : {}),
    additionalProperty: [
      { "@type": "PropertyValue", name: "Quantité nette", value: product.inco.netQuantity },
      { "@type": "PropertyValue", name: "Ingrédients", value: product.inco.ingredients },
      {
        "@type": "PropertyValue",
        name: "Allergènes",
        value: allergens.length ? allergens.join(", ") : "Aucun déclaré",
      },
      ...(product.inco.origin ? [{ "@type": "PropertyValue", name: "Origine", value: product.inco.origin }] : []),
    ],
    offers: {
      "@type": "Offer",
      url,
      price: (product.priceTtcCents / 100).toFixed(2),
      priceCurrency: "EUR",
      availability: product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      availableDeliveryMethod: "http://purl.org/goodrelations/v1#DeliveryModePickUp",
      seller: { "@id": `${siteUrl(config)}/#boutique` },
    },
  };
}

/** Sérialisation sûre dans une balise script (aucune fermeture de balise possible). */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
