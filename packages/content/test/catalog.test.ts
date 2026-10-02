import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCatalog,
  CATALOG_QUERY,
  isPublishable,
  product as productSchema,
  publicationBlockers,
  reviewWarnings,
  type Product,
} from "../src/index.ts";

const demo = JSON.parse(
  readFileSync(join(__dirname, "../../../examples/maison-ferrand/content/catalogue.json"), "utf8"),
) as Product[];
const miel = () => structuredClone(demo.find((p) => p.id === "miel")!);
const tomme = () => structuredClone(demo.find((p) => p.id === "tomme")!);

describe("publication du catalogue", () => {
  it("T2.7 un produit non relu est exclu, par la requête comme par le serveur", () => {
    expect(CATALOG_QUERY).toContain("defined(reviewedAt)");
    expect(CATALOG_QUERY).toContain('!(_id in path("drafts.**"))');
    const unreviewed = { ...tomme(), reviewedAt: null };
    expect(isPublishable(unreviewed)).toBe(false);
    expect(publicationBlockers(unreviewed)[0]).toContain("non relus");
    expect(buildCatalog([tomme(), unreviewed], []).map((p) => p.id)).toEqual(["tomme"]);
  });

  it("T2.8 allergènes vides avec des ingrédients : accepté, avec avertissement de relecture", () => {
    const p = { ...tomme(), inco: { ...tomme().inco, allergens: [] } };
    expect(isPublishable(p)).toBe(true);
    expect(reviewWarnings(p)).toContain("Aucun allergène déclaré alors que des ingrédients sont listés : à confirmer");
  });

  it("bloque un produit sans mention INCO obligatoire", () => {
    const p = { ...miel(), inco: { ...miel().inco, manufacturer: " " } };
    expect(publicationBlockers(p)).toEqual(["Mention INCO manquante : manufacturer"]);
  });

  it("bloque un prix nul ou un taux de TVA hors 5,5 et 20", () => {
    expect(publicationBlockers({ ...miel(), priceTtcCents: 0 })).toEqual(["Prix TTC invalide"]);
    expect(publicationBlockers({ ...miel(), vatRate: 10 as never })).toEqual(["Taux de TVA invalide (5,5 ou 20)"]);
  });

  it("bloque une boisson alcoolisée au taux réduit", () => {
    const vin = structuredClone(demo.find((p) => p.id === "vin")!);
    expect(publicationBlockers({ ...vin, vatRate: 5.5 })).toEqual([
      "Une boisson alcoolisée relève du taux normal de 20 %",
    ]);
  });

  it("fusionne les disponibilités : sans ligne, disponible ; coupé, affiché mais indisponible", () => {
    const catalog = buildCatalog(demo, [
      { product_id: "terrine", available: false },
      { product_id: "miel", available: true },
    ]);
    expect(catalog).toHaveLength(8);
    expect(catalog.find((p) => p.id === "terrine")!.available).toBe(false);
    expect(catalog.find((p) => p.id === "miel")!.available).toBe(true);
    expect(catalog.find((p) => p.id === "huile")!.available).toBe(true);
  });

  it("le catalogue de démonstration de la maquette A est entièrement publiable", () => {
    for (const p of demo) expect(publicationBlockers(p), p.id).toEqual([]);
    expect(demo.find((p) => p.id === "biscuit")!.inco.allergens).toEqual(["gluten", "fruits à coque", "œufs"]);
  });

  it("le schéma produit exige le bloc INCO et prévoit la date de relecture", () => {
    const names = productSchema.fields.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(["inco", "reviewedAt", "vatRate", "isAlcohol"]));
    const inco = productSchema.fields.find((f) => f.name === "inco") as unknown as {
      fields: readonly { name: string }[];
    };
    expect(inco.fields.map((f) => f.name)).toEqual([
      "denomination",
      "ingredients",
      "allergens",
      "mayContain",
      "netQuantity",
      "storage",
      "manufacturer",
      "origin",
    ]);
  });
});
