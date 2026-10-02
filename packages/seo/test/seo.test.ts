import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "@launchpadfactoryteam/config";
import { loadLocalContent } from "@launchpadfactoryteam/content";
import {
  displayPhone,
  groceryStoreJsonLd,
  jsonLdScript,
  llmsTxt,
  pageTitle,
  pickupSummary,
  productJsonLd,
  productTitle,
  robotsTxt,
  sitemapPaths,
  splitAddress,
} from "../src/index.ts";

const NOW = new Date("2026-10-02T08:00:00Z");
const site = (name: string) => join(__dirname, "../../../examples", name);
const { config } = loadConfig(site("maison-ferrand"), { now: NOW });
const content = loadLocalContent(site("maison-ferrand"));
const product = (id: string) => content.catalog.find((p) => p.id === id)!;

describe("faits de la boutique", () => {
  it("découpe l'adresse en rue, code postal et ville", () => {
    expect(splitAddress("12 rue des Halles, 34000 Montpellier")).toEqual({
      street: "12 rue des Halles",
      postalCode: "34000",
      city: "Montpellier",
    });
  });

  it("affiche le téléphone E.164 au format français", () => {
    expect(displayPhone("+33467000000")).toBe("04 67 00 00 00");
  });

  it("regroupe les créneaux de retrait par jours consécutifs identiques", () => {
    expect(pickupSummary(config.retrait.creneaux)).toEqual([
      { days: "Mardi au vendredi", slots: "10:00–12:00 · 16:00–19:00" },
      { days: "Samedi", slots: "09:00–13:00 · 15:00–19:00" },
    ]);
    expect(pickupSummary({ mardi: ["10:00-12:00"], jeudi: ["10:00-12:00"] })).toEqual([
      { days: "Mardi", slots: "10:00–12:00" },
      { days: "Jeudi", slots: "10:00–12:00" },
    ]);
  });
});

describe("titres", () => {
  it("T3.9 fiche : dénomination, catégorie, ville", () => {
    expect(productTitle(product("miel"), config)).toBe("Miel de châtaignier — Miels & confitures — Montpellier");
  });

  it("pages : titre de la page puis la boutique ; accueil centré sur le local", () => {
    expect(pageTitle("Contact", config)).toBe("Contact — Maison Ferrand");
    expect(pageTitle(null, config)).toBe("Maison Ferrand — épicerie fine à Montpellier, retrait en boutique");
  });
});

describe("données structurées", () => {
  it("T3.7 un produit indisponible est OutOfStock, un disponible InStock", () => {
    expect(productJsonLd(product("terrine"), config).offers.availability).toBe("https://schema.org/OutOfStock");
    expect(productJsonLd(product("miel"), config).offers.availability).toBe("https://schema.org/InStock");
  });

  it("Product : prix, devise, retrait en boutique, allergènes", () => {
    const ld = productJsonLd(product("tomme"), config);
    expect(ld.offers).toMatchObject({
      price: "11.20",
      priceCurrency: "EUR",
      availableDeliveryMethod: "http://purl.org/goodrelations/v1#DeliveryModePickUp",
      url: "https://maison-ferrand.fr/produits/tomme-du-larzac-affinee",
    });
    expect(ld.additionalProperty).toContainEqual({ "@type": "PropertyValue", name: "Allergènes", value: "lait" });
  });

  it("T3.8 GroceryStore : adresse, téléphone E.164, horaires", () => {
    const ld = groceryStoreJsonLd(config, content);
    expect(ld.telephone).toBe("+33467000000");
    expect(ld.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "12 rue des Halles",
      postalCode: "34000",
      addressLocality: "Montpellier",
      addressCountry: "FR",
    });
    expect(ld.openingHoursSpecification).toHaveLength(3);
    expect(ld.openingHoursSpecification[0]).toEqual({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "https://schema.org/Tuesday",
        "https://schema.org/Wednesday",
        "https://schema.org/Thursday",
        "https://schema.org/Friday",
      ],
      opens: "09:00",
      closes: "13:00",
    });
    expect(ld.description).toContain("Créneaux : Mardi au vendredi, 10:00–12:00 · 16:00–19:00.");
  });

  it("le JSON-LD ne peut pas fermer sa balise script", () => {
    expect(jsonLdScript({ name: "</script><script>alert(1)</script>" })).not.toContain("</script>");
  });
});

describe("robots, llms.txt, sitemap", () => {
  it("autorise les robots d'IA quand seo.robots_ia est vrai, les refuse sinon", () => {
    expect(robotsTxt(config)).toContain("User-agent: ClaudeBot\nAllow: /");
    expect(robotsTxt(config)).toContain("Sitemap: https://maison-ferrand.fr/sitemap.xml");
    const closed = { ...config, seo: { robots_ia: false } };
    expect(robotsTxt(closed)).toContain("User-agent: GPTBot\nDisallow: /");
    expect(robotsTxt(closed)).toMatch(/User-agent: \*\nAllow: \//);
  });

  it("llms.txt répond où, quand, combien, comment retirer", () => {
    const txt = llmsTxt(config, content);
    expect(txt).toContain("# Maison Ferrand");
    expect(txt).toContain("- Adresse : 12 rue des Halles, 34000 Montpellier");
    expect(txt).toContain("- Préparation : 2 heures minimum");
    expect(txt).toContain("[Miel de châtaignier](https://maison-ferrand.fr/produits/miel-de-chataignier) : Pot 250 g, 12,50 €");
    expect(txt).toContain("Terrine de canard aux figues](https://maison-ferrand.fr/produits/terrine-de-canard-aux-figues) : Bocal 180 g, 9,80 € (indisponible)");
  });

  it("le sitemap liste les pages, les catégories et les fiches", () => {
    const paths = sitemapPaths(content);
    expect(paths.slice(0, 4)).toEqual(["/", "/boutique", "/epicerie", "/contact"]);
    expect(paths).toContain("/boutique/fromages");
    expect(paths).toContain("/produits/miel-de-chataignier");
    expect(paths).toHaveLength(4 + 6 + 8);
  });
});
