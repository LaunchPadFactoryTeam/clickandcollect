// @vitest-environment jsdom
import { join } from "node:path";
import axe from "axe-core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { loadConfig, type ClientConfig } from "@launchpadfactoryteam/config";
import { loadLocalContent } from "@launchpadfactoryteam/content";
import {
  CategoryFilter,
  ContactPage,
  formatPrice,
  HomePage,
  IncoBlock,
  PAGES,
  ProductCard,
  ProductPage,
  ShopPage,
  StoryPage,
  type Site,
  type Variant,
} from "../src/index.ts";

const NOW = new Date("2026-10-02T08:00:00Z");
const dir = join(__dirname, "../../../examples/maison-ferrand");
const base: Site = { config: loadConfig(dir, { now: NOW }).config, content: loadLocalContent(dir) };
const product = (id: string) => base.content.catalog.find((p) => p.id === id)!;

/** Site avec toutes les pages dans la variante donnée. */
function withVariant(variant: Variant, patch: Partial<ClientConfig["features"]> = {}): Site {
  const config = structuredClone(base.config);
  for (const k of Object.keys(config.design.variantes) as (keyof ClientConfig["design"]["variantes"])[]) {
    config.design.variantes[k] = variant;
  }
  config.features = { ...config.features, ...patch };
  return { ...base, config };
}

function dom(element: React.ReactElement): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(element);
  return host;
}

async function axeViolations(element: React.ReactElement) {
  document.body.innerHTML = renderToStaticMarkup(element);
  document.documentElement.lang = "fr";
  const result = await axe.run(document.body, {
    // Le contraste dépend du rendu réel (polices, CSS) : contrôlé dans les tests de bout en bout.
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

describe("composants", () => {
  it("T3.1 format de prix : 1250 → « 12,50 € » en chiffres tabulaires", () => {
    expect(formatPrice(1250)).toBe("12,50\u00a0€");
    const card = dom(<ProductCard product={product("miel")} site={base} variant="A" />);
    expect(card.querySelector(".price")!.textContent).toBe("12,50 €");
  });

  it("T3.2 produit indisponible : badge, bouton désactivé libellé « Indisponible »", () => {
    for (const v of ["A", "B", "C"] as const) {
      const card = dom(<ProductCard product={product("terrine")} site={base} variant={v} />);
      expect(card.querySelector(".card__badge")!.textContent, v).toBe("Indisponible");
      const button = card.querySelector("button")!;
      expect(button.disabled, v).toBe(true);
      expect(button.textContent, v).toBe("Indisponible");
    }
  });

  it("T3.3 produit alcoolisé : badge « Alcool · 18 ans » ; aucun badge si l'option est coupée", () => {
    expect(
      dom(<ProductCard product={product("vin")} site={base} variant="A" />).querySelector(".card__badge")!.textContent,
    ).toBe("Alcool · 18 ans");
    const off = withVariant("A", { alcool: false });
    expect(
      dom(<ProductCard product={product("vin")} site={off} variant="A" />).querySelector(".card__badge"),
    ).toBeNull();
  });

  it("T3.4 aucune carte n'affiche d'allergène", () => {
    for (const p of base.content.catalog) {
      for (const v of ["A", "B", "C"] as const) {
        const text = dom(<ProductCard product={p} site={base} variant={v} />).textContent!;
        expect(text, `${p.id} ${v}`).not.toMatch(/allerg|contient/i);
      }
    }
  });

  it("T3.5 bloc INCO : allergènes en strong, origine, quantité nette", () => {
    const inco = dom(<IncoBlock product={product("tomme")} />);
    expect(inco.querySelector("strong")!.textContent).toBe("Allergènes : lait.");
    const terms = [...inco.querySelectorAll("dt")].map((d) => d.textContent);
    expect(terms).toEqual(["Dénomination", "Ingrédients", "Quantité nette", "Conservation", "Fabricant", "Origine"]);
    const biscuit = dom(<IncoBlock product={product("biscuit")} />).textContent!;
    expect(biscuit).toContain("Peut contenir des traces de noisettes.");
  });

  it("T3.12 filtre catégorie : liens, catégorie active marquée aria-current", () => {
    const nav = dom(<CategoryFilter products={base.content.catalog} active="fromages" />);
    const links = [...nav.querySelectorAll("a")];
    expect(links[0]).toMatchObject({ textContent: "Tout" });
    expect(links[0]!.getAttribute("href")).toBe("/boutique");
    const active = links.filter((a) => a.getAttribute("aria-current") === "page");
    expect(active.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([["Fromages", "/boutique/fromages"]]);
    const page = dom(<ShopPage site={base} category="fromages" />);
    expect([...page.querySelectorAll(".card__name")].map((h) => h.textContent)).toEqual(["Tomme du Larzac affinée"]);
  });
});

describe("variantes et pages", () => {
  it("T3.6 le sélecteur rend la variante configurée", () => {
    for (const v of ["A", "B", "C"] as const) {
      const page = dom(<HomePage site={withVariant(v)} />);
      expect(page.querySelector(".site")!.getAttribute("data-variant")).toBe(v);
    }
    expect(Object.keys(PAGES)).toEqual(["accueil", "boutique", "fiche_produit", "epicerie", "contact"]);
  });

  it("changer de variante change la mise en page, pas le texte (critère de sortie de la phase 0)", () => {
    const { home } = base.content.pages;
    const html = (["A", "B", "C"] as const).map((v) => dom(<HomePage site={withVariant(v)} />));
    for (const root of html) {
      const main = root.querySelector("main")!;
      expect(main.querySelector("h1")!.textContent).toBe(home.title);
      for (const text of [home.lead, home.featuredTitle, home.pickupTitle, `« ${home.story.quote} »`]) {
        expect(main.textContent).toContain(text);
      }
    }
    expect(html[0]!.innerHTML).not.toBe(html[2]!.innerHTML);
  });

  it("T3.10 mention Évin : sur la fiche d'un vin, pas sur celle d'un miel", () => {
    expect(dom(<ProductPage site={base} product={product("vin")} />).querySelector(".notice-evin")).not.toBeNull();
    expect(dom(<ProductPage site={base} product={product("miel")} />).querySelector(".notice-evin")).toBeNull();
    const off = withVariant("A", { alcool: false });
    expect(dom(<ProductPage site={off} product={product("vin")} />).querySelector(".notice-evin")).toBeNull();
  });

  it("chaque page a un seul h1, une hiérarchie de titres sans saut et un lien d'évitement ciblant main", () => {
    for (const v of ["A", "B", "C"] as const) {
      const s = withVariant(v);
      const pages = [
        <HomePage key="h" site={s} />,
        <ShopPage key="s" site={s} />,
        <ProductPage key="p" site={s} product={product("tomme")} />,
        <StoryPage key="e" site={s} />,
        <ContactPage key="c" site={s} />,
      ];
      for (const page of pages) {
        const root = dom(page);
        expect(root.querySelectorAll("h1"), v).toHaveLength(1);
        const levels = [...root.querySelectorAll("h1,h2,h3,h4")].map((h) => Number(h.tagName[1]));
        levels.forEach((l, i) => i > 0 && expect(l - levels[i - 1]!, `${v} ${levels}`).toBeLessThanOrEqual(1));
        expect(root.querySelector("main#contenu"), v).not.toBeNull();
      }
    }
  });

  it("la fiche affiche toutes les mentions INCO et la DLC au retrait", () => {
    const text = dom(<ProductPage site={base} product={product("tomme")} />).textContent!;
    for (const s of [
      "Tomme de brebis au lait cru",
      "Allergènes : lait.",
      "300 g",
      "Entre 4 et 8 °C",
      "Bergerie du Caylar",
      "France",
      "communiquée au moment du retrait",
    ]) {
      expect(text).toContain(s);
    }
  });

  it("le formulaire de contact : champs étiquetés et obligatoires, consentement non coché", () => {
    const form = dom(<ContactPage site={base} />).querySelector("form")!;
    for (const input of form.querySelectorAll("input:not([type=checkbox]), textarea")) {
      expect(form.querySelector(`label[for="${input.id}"]`), input.id).not.toBeNull();
      expect((input as HTMLInputElement).required).toBe(true);
    }
    const consent = form.querySelector<HTMLInputElement>("input[type=checkbox]")!;
    expect(consent.checked).toBe(false);
    expect(consent.required).toBe(true);
  });
});

describe("accessibilité (axe)", () => {
  it("T3.11 aucune violation sérieuse ou critique sur les 5 pages des 3 variantes", async () => {
    for (const v of ["A", "B", "C"] as const) {
      const s = withVariant(v);
      for (const [name, page] of [
        ["accueil", <HomePage key="h" site={s} />],
        ["boutique", <ShopPage key="s" site={s} />],
        ["fiche", <ProductPage key="p" site={s} product={product("terrine")} />],
        ["épicerie", <StoryPage key="e" site={s} />],
        ["contact", <ContactPage key="c" site={s} />],
      ] as const) {
        const violations = await axeViolations(page);
        expect(
          violations.map((x) => `${x.id}: ${x.nodes[0]?.html}`),
          `${v} ${name}`,
        ).toEqual([]);
      }
    }
  });
});
