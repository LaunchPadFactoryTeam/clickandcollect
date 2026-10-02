/** Catalogue publié : produits relus, fusionnés avec leur disponibilité (Supabase). */

export type VatRate = 5.5 | 20;

export interface Inco {
  denomination: string;
  ingredients: string;
  allergens?: string[];
  mayContain?: string;
  netQuantity: string;
  storage: string;
  manufacturer: string;
  origin?: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: { name: string; slug: string };
  producer?: string;
  format: string;
  priceTtcCents: number;
  vatRate: VatRate;
  description?: string;
  images?: { url: string; alt?: string }[];
  isAlcohol: boolean;
  abv?: number;
  inco: Inco;
  reviewedAt?: string | null;
  reviewedBy?: string;
}

export type CatalogProduct = Product & { available: boolean };

/**
 * Requête GROQ du catalogue : les brouillons et les produits non relus sont exclus dès Sanity.
 * Le même filtre est réappliqué côté serveur par isPublishable (défense en profondeur).
 */
export const CATALOG_QUERY = `*[_type == "product" && defined(reviewedAt) && !(_id in path("drafts.**"))]
  | order(category->order asc, name asc) {
    "id": _id, "slug": slug.current, name,
    "category": category->{ name, "slug": slug.current },
    producer, format, priceTtcCents, vatRate, description, isAlcohol, abv, inco, reviewedAt, reviewedBy,
    "images": images[]{ "url": asset->url, alt }
  }`;

/** Raisons qui empêchent la publication d'un produit ; tableau vide = publiable. */
export function publicationBlockers(p: Product): string[] {
  const blockers: string[] = [];
  if (!p.reviewedAt) blockers.push("Prix, TVA et allergènes non relus par le commerçant (reviewedAt vide)");
  if (!Number.isInteger(p.priceTtcCents) || p.priceTtcCents <= 0) blockers.push("Prix TTC invalide");
  if (p.vatRate !== 5.5 && p.vatRate !== 20) blockers.push("Taux de TVA invalide (5,5 ou 20)");
  if (p.isAlcohol && p.vatRate !== 20) blockers.push("Une boisson alcoolisée relève du taux normal de 20 %");
  for (const key of ["denomination", "ingredients", "netQuantity", "storage", "manufacturer"] as const) {
    if (!p.inco?.[key]?.trim()) blockers.push(`Mention INCO manquante : ${key}`);
  }
  return blockers;
}

export function isPublishable(p: Product): boolean {
  return publicationBlockers(p).length === 0;
}

/** Points à faire confirmer par le commerçant, sans bloquer la publication. */
export function reviewWarnings(p: Product): string[] {
  const warnings: string[] = [];
  if (p.inco?.ingredients?.trim() && !(p.inco.allergens ?? []).length) {
    warnings.push("Aucun allergène déclaré alors que des ingrédients sont listés : à confirmer");
  }
  if (p.isAlcohol && !(p.abv && p.abv > 0)) warnings.push("Degré d'alcool non renseigné");
  if (!p.images?.length) warnings.push("Aucune photo");
  return warnings;
}

/**
 * Catalogue affiché : produits publiables, avec leur disponibilité. Sans ligne de disponibilité,
 * un produit est disponible ; un produit indisponible reste affiché mais ne peut pas être ajouté au panier.
 */
export function buildCatalog(
  products: readonly Product[],
  availability: ReadonlyArray<{ product_id: string; available: boolean }>,
): CatalogProduct[] {
  const off = new Set(availability.filter((a) => !a.available).map((a) => a.product_id));
  return products.filter(isPublishable).map((p) => ({ ...p, available: !off.has(p.id) }));
}
