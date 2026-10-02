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

export const page = {
  name: "page",
  title: "Page éditoriale",
  type: "document",
  fields: [
    {
      name: "key",
      title: "Page",
      type: "string",
      options: { list: ["accueil", "epicerie", "contact"] },
      validation: required,
    },
    { name: "title", title: "Titre", type: "string", validation: required },
    { name: "lead", title: "Chapô", type: "text" },
    { name: "body", title: "Texte", type: "array", of: [{ type: "block" }] },
    {
      name: "quote",
      title: "Citation",
      type: "object",
      fields: [
        { name: "text", type: "text" },
        { name: "author", type: "string" },
      ],
    },
    {
      name: "figures",
      title: "Chiffres clés",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "value", type: "string" },
            { name: "label", type: "string" },
          ],
        },
      ],
    },
    {
      name: "images",
      title: "Images",
      type: "array",
      of: [{ type: "image", fields: [{ name: "alt", type: "string" }] }],
    },
  ],
} as const;

export const settings = {
  name: "settings",
  title: "Réglages de la boutique",
  type: "document",
  fields: [
    {
      name: "openingHours",
      title: "Horaires d'ouverture",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            { name: "days", type: "string" },
            { name: "hours", type: "string" },
          ],
        },
      ],
    },
    { name: "googleBusinessUrl", title: "Fiche Google Business", type: "url" },
    { name: "legalName", title: "Raison sociale", type: "string" },
    { name: "siret", title: "SIRET", type: "string" },
    { name: "marketingConsentText", title: "Texte de la case marketing", type: "text", validation: required },
    { name: "marketingConsentVersion", title: "Version du texte marketing", type: "string", validation: required },
  ],
} as const;

export const schemaTypes = [category, product, page, settings];
