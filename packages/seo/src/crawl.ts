import type { ClientConfig } from "@launchpadfactoryteam/config";
import { formatOpeningHours, type ContentSnapshot } from "@launchpadfactoryteam/content";
import { displayPhone, pickupSummary, preparationLabel, siteUrl, splitAddress } from "./facts.ts";

/** Robots d'IA connus : autorisés ou refusés ensemble selon seo.robots_ia. */
export const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
] as const;

export const STATIC_PAGES = ["/", "/boutique", "/epicerie", "/contact"] as const;

export function categorySlugs(content: Pick<ContentSnapshot, "catalog">): string[] {
  return [...new Set(content.catalog.map((p) => p.category.slug))];
}

/** Toutes les URL publiques du site, pour le sitemap. */
/** Pages du sitemap ; `extra` : pages statiques supplémentaires (pages légales, en fin de liste). */
export function sitemapPaths(content: Pick<ContentSnapshot, "catalog">, extra: readonly string[] = []): string[] {
  return [
    ...STATIC_PAGES,
    ...categorySlugs(content).map((c) => `/boutique/${c}`),
    ...content.catalog.map((p) => `/produits/${p.slug}`),
    ...extra,
  ];
}

export function robotsTxt(config: ClientConfig): string {
  const lines = ["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /api/", ""];
  for (const bot of AI_CRAWLERS) {
    lines.push(`User-agent: ${bot}`, config.seo.robots_ia ? "Allow: /" : "Disallow: /", "");
  }
  lines.push(`Sitemap: ${siteUrl(config)}/sitemap.xml`, "");
  return lines.join("\n");
}

const euros = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

/**
 * llms.txt : résumé factuel et autonome du site, citable tel quel par un assistant
 * (où, quand, combien, comment retirer). Publié seulement si seo.robots_ia est vrai.
 */
export function llmsTxt(config: ClientConfig, content: ContentSnapshot): string {
  const url = siteUrl(config);
  const { street, postalCode, city } = splitAddress(config.boutique.adresse);
  const { pages, catalog } = content;
  const out = [
    `# ${config.boutique.nom}`,
    "",
    `> ${pages.settings.tagline} à ${city}. Commande et paiement en ligne, retrait en boutique au ${street}, ${postalCode} ${city}.`,
    "",
    "## Retrait des commandes",
    "",
    `- Adresse : ${street}, ${postalCode} ${city}`,
    `- Préparation : ${preparationLabel(config.retrait.delai_preparation_heures)}`,
    ...pickupSummary(config.retrait.creneaux).map((l) => `- Créneaux : ${l.days}, ${l.slots}`),
    `- Téléphone : ${displayPhone(config.boutique.telephone)}`,
    `- Email : ${pages.settings.email}`,
    "",
    "## Horaires d'ouverture",
    "",
    ...formatOpeningHours(pages.settings.openingHours).map((h) => `- ${h}`),
    "",
    "## Produits",
    "",
    ...catalog.map(
      (p) =>
        `- [${p.name}](${url}/produits/${p.slug}) : ${p.format}, ${euros(p.priceTtcCents)}${p.available ? "" : " (indisponible)"}${p.producer ? `, ${p.producer}` : ""}`,
    ),
    "",
    "## Pages",
    "",
    `- [${pages.story.title}](${url}/epicerie) : ${pages.story.paragraphs[0]}`,
    `- [Contact](${url}/contact)`,
    "",
  ];
  return out.join("\n");
}
