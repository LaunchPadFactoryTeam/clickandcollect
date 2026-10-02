/**
 * Schémas Sanity, un projet par client. Objets au format des schémas Sanity (defineType n'est qu'une identité) :
 * le Studio les importe tels quels, sans que le core dépende du paquet sanity.
 * Seul LaunchPad édite ces contenus ; la disponibilité d'un produit vit dans Supabase, pas ici.
 */

const required = (rule: { required: () => unknown }) => rule.required();

export const ALLERGENS = [
  "gluten",
  "crustacés",
  "œufs",
  "poissons",
  "arachides",
  "soja",
  "lait",
  "fruits à coque",
  "céleri",
  "moutarde",
  "sésame",
  "sulfites",
  "lupin",
  "mollusques",
] as const;

export const category = {
  name: "category",
  title: "Catégorie",
  type: "document",
  fields: [
    { name: "name", title: "Nom", type: "string", validation: required },
    { name: "slug", title: "Identifiant d'URL", type: "slug", options: { source: "name" }, validation: required },
    { name: "order", title: "Ordre d'affichage", type: "number", initialValue: 0 },
  ],
} as const;

export const product = {
  name: "product",
  title: "Produit",
  type: "document",
  fields: [
    { name: "name", title: "Nom", type: "string", validation: required },
    { name: "slug", title: "Identifiant d'URL", type: "slug", options: { source: "name" }, validation: required },
    { name: "category", title: "Catégorie", type: "reference", to: [{ type: "category" }], validation: required },
    { name: "producer", title: "Producteur", type: "string" },
    { name: "format", title: "Format affiché", type: "string", description: "Ex. « Pot 250 g »", validation: required },
    { name: "priceTtcCents", title: "Prix TTC (centimes)", type: "number", validation: required },
    {
      name: "vatRate",
      title: "Taux de TVA",
      type: "number",
      options: { list: [5.5, 20] },
      validation: required,
    },
    { name: "description", title: "Description", type: "text" },
    {
      name: "images",
      title: "Photos (4:5)",
      type: "array",
      of: [{ type: "image", fields: [{ name: "alt", type: "string" }] }],
    },
    { name: "isAlcohol", title: "Boisson alcoolisée", type: "boolean", initialValue: false },
    {
      name: "abv",
      title: "Degré d'alcool (% vol.)",
      type: "number",
      hidden: ({ document }: any) => !document?.isAlcohol,
    },
    {
      name: "inco",
      title: "Informations réglementaires (INCO)",
      type: "object",
      validation: required,
      fields: [
        { name: "denomination", title: "Dénomination", type: "string", validation: required },
        { name: "ingredients", title: "Ingrédients", type: "text", validation: required },
        {
          name: "allergens",
          title: "Allergènes (mis en évidence)",
          type: "array",
          of: [{ type: "string" }],
          options: { list: [...ALLERGENS] },
        },
        { name: "mayContain", title: "Traces éventuelles", type: "string" },
        { name: "netQuantity", title: "Quantité nette", type: "string", validation: required },
        { name: "storage", title: "Conservation", type: "string", validation: required },
        {
          name: "manufacturer",
          title: "Fabricant ou importateur (nom et adresse)",
          type: "string",
          validation: required,
        },
        { name: "origin", title: "Origine (si obligatoire)", type: "string" },
      ],
    },
    {
      name: "reviewedAt",
      title: "Relu et validé le",
      type: "datetime",
      description:
        "Prix, TVA et allergènes relus et validés par le commerçant. Sans cette date, le produit n'est pas publié.",
    },
    { name: "reviewedBy", title: "Validé par", type: "string" },
  ],
} as const;

const field = (name: string, title: string, type = "string", extra: Record<string, unknown> = {}) => ({
  name,
  title,
  type,
  ...extra,
});
const figures = (name: string, title: string) =>
  field(name, title, "array", {
    of: [{ type: "object", fields: [field("value", "Valeur"), field("label", "Libellé")] }],
  });

/**
 * Contenus éditoriaux : un document unique par site, de même forme que content/pages.json
 * (voir siteContentSchema). Les trois templates lisent exactement ces champs.
 */
export const siteContent = {
  name: "siteContent",
  title: "Contenus du site",
  type: "document",
  fields: [
    field("settings", "Réglages", "object", {
      fields: [
        field("tagline", "Accroche sous le nom"),
        field("email", "Email de contact"),
        field("openingHours", "Horaires d'ouverture", "array", {
          of: [
            {
              type: "object",
              fields: [
                field("jours", "Jours", "array", { of: [{ type: "string" }] }),
                field("plages", "Plages (HH:MM-HH:MM)", "array", { of: [{ type: "string" }] }),
              ],
            },
          ],
        }),
        field("googleBusinessUrl", "Fiche Google Business", "url"),
        field("marketingConsentText", "Texte de la case marketing", "text"),
        field("marketingConsentVersion", "Version du texte marketing"),
      ],
    }),
    field("home", "Accueil", "object", {
      fields: [
        field("eyebrow", "Surtitre"),
        field("title", "Titre"),
        field("lead", "Chapô", "text"),
        field("ctaShop", "Bouton vers la boutique"),
        field("ctaStory", "Bouton vers l'histoire"),
        field("featuredTitle", "Titre de la sélection"),
        field("featuredProductIds", "Produits mis en avant", "array", { of: [{ type: "string" }] }),
        figures("highlights", "Chiffres d'accroche (template C)"),
        field("story", "Extrait de l'histoire", "object", {
          fields: [
            field("eyebrow", "Surtitre"),
            field("quote", "Citation", "text"),
            field("author", "Auteur"),
            field("text", "Texte", "text"),
            field("cta", "Bouton"),
          ],
        }),
        field("pickupTitle", "Titre du bloc retrait"),
      ],
    }),
    field("shop", "Boutique", "object", { fields: [field("title", "Titre"), field("lead", "Chapô", "text")] }),
    field("story", "Notre histoire", "object", {
      fields: [
        field("eyebrow", "Surtitre"),
        field("title", "Titre"),
        field("paragraphs", "Paragraphes", "array", { of: [{ type: "text" }] }),
        field("caption", "Légende de la photo"),
        field("quote", "Citation", "object", { fields: [field("text", "Texte", "text"), field("author", "Auteur")] }),
        figures("figures", "Chiffres clés"),
      ],
    }),
    field("contact", "Contact", "object", { fields: [field("title", "Titre"), field("lead", "Chapô", "text")] }),
  ],
} as const;

export const schemaTypes = [category, product, siteContent];
