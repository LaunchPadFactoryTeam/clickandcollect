import { z } from "zod";

/**
 * Contenus éditoriaux d'un site, communs aux trois templates : changer de variante ne change jamais
 * ce qui est dit, seulement comment c'est montré (principe 2 du design system).
 * Source : Sanity (documents page et settings) ou, à défaut, le dossier content/ du repo client.
 */

const JOUR = z.enum(["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]);
const PLAGE = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/, { error: "Format HH:MM-HH:MM" });
const text = z.string().trim().min(1);

const figure = z.strictObject({ value: text, label: text });

export const siteContentSchema = z.strictObject({
  settings: z.strictObject({
    /** Sous le nom dans l'en-tête, ex. « Épicerie fine ». */
    tagline: text,
    email: z.email(),
    /** Horaires d'ouverture de la boutique (distincts des créneaux de retrait). */
    openingHours: z.array(z.strictObject({ jours: z.array(JOUR).min(1), plages: z.array(PLAGE) })).min(1),
    googleBusinessUrl: z.url().optional(),
    marketingConsentText: text,
    marketingConsentVersion: text,
  }),
  home: z.strictObject({
    eyebrow: text,
    title: text,
    lead: text,
    ctaShop: text,
    ctaStory: text,
    featuredTitle: text,
    featuredProductIds: z.array(text).min(1).max(6),
    highlights: z.array(figure).max(4).optional(),
    story: z.strictObject({ eyebrow: text, quote: text, author: text, text: text.optional(), cta: text }),
    pickupTitle: text,
  }),
  shop: z.strictObject({ title: text, lead: text }),
  story: z.strictObject({
    eyebrow: text,
    title: text,
    paragraphs: z.array(text).min(1),
    caption: text.optional(),
    quote: z.strictObject({ text: text, author: text }).optional(),
    figures: z.array(figure).max(4),
  }),
  contact: z.strictObject({ title: text, lead: text }),
});

export type SiteContent = z.output<typeof siteContentSchema>;
export type Figure = SiteContent["story"]["figures"][number];
export type OpeningHours = SiteContent["settings"]["openingHours"][number];

const DAYS = JOUR.options;
const label = (j: string) => j.charAt(0).toUpperCase() + j.slice(1);

/** « mardi, mercredi, jeudi » consécutifs → « Mardi – jeudi » ; un seul jour → « Samedi ». */
export function formatDays(jours: readonly string[]): string {
  const idx = [...jours].map((j) => DAYS.indexOf(j as never)).sort((a, b) => a - b);
  const consecutive = idx.every((d, i) => i === 0 || d === idx[i - 1]! + 1);
  if (idx.length === 1) return label(DAYS[idx[0]!]!);
  if (consecutive) return `${label(DAYS[idx[0]!]!)} – ${DAYS[idx.at(-1)!]}`;
  return idx.map((d, i) => (i === 0 ? label(DAYS[d]!) : DAYS[d])).join(", ");
}

/** « 09:00-13:00 » → « 9:00 – 13:00 ». */
export function formatRange(plage: string): string {
  const [a, b] = plage.split("-") as [string, string];
  return `${a.replace(/^0/, "")} – ${b.replace(/^0/, "")}`;
}

/** Lignes d'horaires affichées, ex. « Mardi – vendredi · 9:00 – 13:00, 15:30 – 19:30 », « Lundi · fermé ». */
export function formatOpeningHours(hours: readonly OpeningHours[]): string[] {
  return hours.map(
    (h) => `${formatDays(h.jours)} · ${h.plages.length ? h.plages.map(formatRange).join(", ") : "fermé"}`,
  );
}
