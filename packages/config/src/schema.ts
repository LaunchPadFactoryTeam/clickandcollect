import { z } from "zod";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";

z.config(z.locales.fr());

export const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;
export type Jour = (typeof JOURS)[number];

export const VARIANTES = ["A", "B", "C"] as const;
export const ARRONDIS = ["net", "doux", "rond"] as const;

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SLOT = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const HOSTNAME = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(?:\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

/** "#abc" -> "#AABBCC" */
export function normalizeHex(value: string): string {
  const hex = value.slice(1);
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  return `#${full.toUpperCase()}`;
}

/** Retourne le numéro au format E.164, ou null s'il n'est pas convertible. */
export function toE164(value: string, defaultCountry = "FR" as const): string | null {
  const parsed = parsePhoneNumberFromString(value, defaultCountry);
  return parsed && parsed.isValid() ? parsed.number : null;
}

/** "10:00-12:00" -> [600, 720] en minutes depuis minuit. */
export function parseSlot(slot: string): [number, number] {
  const m = SLOT.exec(slot);
  if (!m) throw new Error(`Créneau invalide : ${slot}`);
  const [, h1, m1, h2, m2] = m.map(Number) as [number, number, number, number, number];
  return [h1 * 60 + m1, h2 * 60 + m2];
}

const couleur = z.string().regex(HEX, { error: "Couleur hexadécimale attendue (#RRGGBB)" }).transform(normalizeHex);

const police = z.union([
  z
    .string()
    .min(1)
    .transform((famille) => ({ famille, graisses: [400, 600] })),
  z.strictObject({
    famille: z.string().min(1),
    graisses: z
      .array(z.number().int().min(100).max(900).multipleOf(100))
      .min(1)
      .max(2, { error: "Deux graisses maximum par famille" }),
    categorie: z.enum(["serif", "sans-serif"]).optional(),
  }),
]);

const creneau = z
  .string()
  .regex(SLOT, { error: "Format attendu HH:MM-HH:MM" })
  .refine(
    (s) => {
      const [debut, fin] = parseSlot(s);
      return debut < fin;
    },
    { error: "Le début du créneau doit précéder sa fin" },
  );

const joursCreneaux = z.array(creneau).superRefine((slots, ctx) => {
  const ranges = slots
    .filter((s) => SLOT.test(s))
    .map(parseSlot)
    .sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i]![0] < ranges[i - 1]![1]) {
      ctx.addIssue({ code: "custom", message: "Deux créneaux du même jour se chevauchent" });
    }
  }
});

export const configSchema = z.strictObject({
  boutique: z.strictObject({
    nom: z.string().min(1),
    domaine: z.string().regex(HOSTNAME, { error: "Nom de domaine invalide (ex. maison-exemple.fr)" }),
    adresse: z.string().min(1),
    telephone: z.string().transform((value, ctx) => {
      const e164 = toE164(value);
      if (!e164) {
        ctx.addIssue({ code: "custom", message: "Téléphone non convertible au format E.164" });
        return z.NEVER;
      }
      return e164;
    }),
    email_notifications: z.email(),
  }),
  design: z.strictObject({
    couleurs: z.strictObject({ primaire: couleur, secondaire: couleur, fond: couleur }),
    typographies: z.strictObject({ titres: police, texte: police }),
    arrondis: z.enum(ARRONDIS),
    logo: z.string().regex(/\.svg$/i, { error: "Le logo doit être un fichier SVG" }),
    variantes: z.strictObject({
      accueil: z.enum(VARIANTES),
      boutique: z.enum(VARIANTES),
      fiche_produit: z.enum(VARIANTES),
      epicerie: z.enum(VARIANTES),
      contact: z.enum(VARIANTES),
      // Facultatif : à défaut, le panier prend la variante de la boutique.
      panier: z.enum(VARIANTES).optional(),
    }),
  }),
  retrait: z.strictObject({
    delai_preparation_heures: z.number().int().min(0).max(72),
    creneaux: z.partialRecord(z.enum(JOURS), joursCreneaux),
    fermetures: z.array(z.string().regex(DATE, { error: "Date attendue au format AAAA-MM-JJ" })).default([]),
  }),
  paiement: z.strictObject({
    psp: z.literal("stripe"),
    stripe_compte_connecte: z
      .string()
      .regex(/^acct_\w+$/)
      .optional(),
  }),
  features: z
    .strictObject({
      alcool: z.boolean().default(false),
      codes_promo: z.boolean().default(false),
      message_cadeau: z.boolean().default(false),
      precommandes: z.boolean().default(false),
    })
    .default({ alcool: false, codes_promo: false, message_cadeau: false, precommandes: false }),
  seo: z
    .strictObject({
      // Autorise les robots d'IA (GPTBot, ClaudeBot…) dans robots.txt et publie llms.txt. Choix client par client.
      robots_ia: z.boolean().default(true),
    })
    .default({ robots_ia: true }),
  audience: z
    .strictObject({
      // Mesure d'audience sans cookies (Umami) : identifiant du site Umami de la boutique.
      umami_website_id: z.uuid().optional(),
      umami_src: z.url().default("https://cloud.umami.is/script.js"),
    })
    .default({ umami_src: "https://cloud.umami.is/script.js" }),
  core_version: z.string().regex(SEMVER, { error: "Version sémantique attendue (ex. 1.0.0)" }),
});

export type ClientConfigInput = z.input<typeof configSchema>;
export type ClientConfig = z.output<typeof configSchema>;
export type Police = ClientConfig["design"]["typographies"]["titres"];
