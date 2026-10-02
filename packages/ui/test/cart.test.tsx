// @vitest-environment jsdom
import { join } from "node:path";
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cartStorageKey } from "@launchpadfactoryteam/commerce";
import { loadConfig, type ClientConfig } from "@launchpadfactoryteam/config";
import { loadLocalContent } from "@launchpadfactoryteam/content";
import { splitAddress } from "@launchpadfactoryteam/seo";
import { CartPage, ProductCard, variantOf, type Site, type Variant } from "../src/index.ts";

// React exige ce drapeau pour act() hors d'un moteur de test dédié.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dir = join(__dirname, "../../../examples/maison-ferrand");
const base: Site = {
  config: loadConfig(dir, { now: new Date("2026-10-02T08:00:00Z") }).config,
  content: loadLocalContent(dir),
};
const shop = base.config.boutique.domaine;
const key = cartStorageKey(shop);

function withVariant(variant: Variant, features: Partial<ClientConfig["features"]> = {}): Site {
  const config = structuredClone(base.config);
  config.design.variantes.boutique = variant;
  config.features = { ...config.features, ...features };
  return { ...base, config };
}

let host: HTMLDivElement;
let root: Root;

async function render(element: React.ReactElement) {
  await act(async () => root.render(element));
  return host;
}

const click = (el: Element) => act(async () => (el as HTMLElement).click());
// Espaces ordinaires seulement : les espaces insécables des prix font partie de ce qu'on vérifie.
const text = (el: Element | null) => el?.textContent?.replace(/[ \t\n\r]+/g, " ").trim();
/** Libellé et valeur d'une ligne de montant, séparés : « Total | 58,20 € ». */
const pair = (el: Element | null) => [...(el?.children ?? [])].map(text).join(" | ");

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = "fr";
  host = document.createElement("div");
  document.body.replaceChildren(host);
  root = createRoot(host);
});
afterEach(() => act(async () => root.unmount()));

/** Le panier des maquettes : 1 tomme, 2 miels, 1 vin. */
const mockupCart = [
  { productId: "tomme", quantity: 1 },
  { productId: "miel", quantity: 2 },
  { productId: "vin", quantity: 1 },
];

describe("page panier", () => {
  it("récapitulatif du panier des maquettes : 58,20 €, dont TVA 5,5 % 1,89 € et TVA 20 % 3,67 €", async () => {
    localStorage.setItem(key, JSON.stringify(mockupCart));
    const page = await render(<CartPage site={base} />);
    const amounts = [...page.querySelectorAll(".cart__amounts > div")].map(pair);
    expect(amounts).toEqual([
      "Sous-total | 58,20\u00a0€",
      "Dont TVA 5,5\u00a0% | 1,89\u00a0€",
      "Dont TVA 20\u00a0% | 3,67\u00a0€",
      "Retrait en boutique | Gratuit",
    ]);
    expect(pair(page.querySelector(".cart__grand"))).toBe("Total | 58,20\u00a0€");
    expect(text(page.querySelector(".hdr__cart"))).toBe("Panier · 4");
  });

  it("boutons − et + : la quantité reste entre 1 et 20, les montants suivent", async () => {
    localStorage.setItem(key, JSON.stringify([{ productId: "miel", quantity: 1 }]));
    const page = await render(<CartPage site={base} />);
    const [minus, plus] = page.querySelectorAll<HTMLButtonElement>(".cart__step");
    expect(minus!.disabled).toBe(true);
    await click(plus!);
    expect(text(page.querySelector(".cart__count"))).toBe("2");
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([{ productId: "miel", quantity: 2 }]);
    expect(pair(page.querySelector(".cart__grand"))).toBe("Total | 25,00\u00a0€");
    await click(page.querySelector(".cart__remove")!);
    expect(text(page.querySelector(".cart__empty p"))).toBe("Votre panier est vide.");
    expect(localStorage.getItem(key)).toBeNull();
  });

  it("créneau : groupe de boutons radio avec légende, le premier créneau proposé est présélectionné", async () => {
    localStorage.setItem(key, JSON.stringify(mockupCart));
    const page = await render(<CartPage site={base} />);
    const fieldset = page.querySelector("fieldset")!;
    expect(text(fieldset.querySelector("legend"))).toBe("Créneau de retrait");
    const a = splitAddress(base.config.boutique.adresse);
    expect(text(fieldset.querySelector(".cart__where"))).toBe(
      `${a.street}, ${a.postalCode} ${a.city}. Préparation en 2 heures minimum.`,
    );
    const radios = [...fieldset.querySelectorAll<HTMLInputElement>("input[type=radio]")];
    expect(radios.length).toBeGreaterThan(0);
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
    expect(radios[0]!.checked).toBe(true);
    await click(radios[1]!);
    expect(text(page.querySelector(".cart__chosen"))).toContain(
      text(radios[1]!.parentElement!.querySelector(".cart__slot-label")),
    );
  });

  it("case de majorité : présente, obligatoire et décochée si le panier contient du vin ; absente sinon", async () => {
    localStorage.setItem(key, JSON.stringify(mockupCart));
    let page = await render(<CartPage site={base} />);
    const age = page.querySelector<HTMLInputElement>("input[name=majorite]")!;
    expect(age.required).toBe(true);
    expect(age.checked).toBe(false);
    const marketing = page.querySelector<HTMLInputElement>("input[name=marketing]")!;
    expect(marketing.required).toBe(false);
    expect(marketing.checked).toBe(false);
    expect(text(marketing.parentElement)).toBe(base.content.pages.settings.marketingConsentText);

    localStorage.setItem(key, JSON.stringify([{ productId: "miel", quantity: 1 }]));
    page = await render(<CartPage site={{ ...base }} />);
    expect(page.querySelector("input[name=majorite]")).toBeNull();
    page = await render(<CartPage site={withVariant("A", { alcool: false })} />);
    expect(page.querySelector("input[name=majorite]")).toBeNull();
  });

  it("un produit coupé depuis l'ajout est signalé, exclu des montants et bloque le paiement", async () => {
    localStorage.setItem(
      key,
      JSON.stringify([
        { productId: "terrine", quantity: 1 },
        { productId: "miel", quantity: 1 },
      ]),
    );
    const page = await render(<CartPage site={base} />);
    expect(text(page.querySelector(".cart__line--off .cart__off"))).toMatch(/^Indisponible/);
    expect(pair(page.querySelector(".cart__grand"))).toBe("Total | 12,50\u00a0€");
    expect(page.querySelector<HTMLButtonElement>(".cart__pay")!.disabled).toBe(true);
    expect(text(page.querySelector("[role=alert]"))).toBe("Retirez les produits indisponibles pour continuer.");
  });

  it("T4.4 un produit retiré du catalogue disparaît du panier stocké au chargement", async () => {
    localStorage.setItem(
      key,
      JSON.stringify([
        { productId: "ancien", quantity: 1 },
        { productId: "miel", quantity: 1 },
      ]),
    );
    await render(<CartPage site={base} />);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([{ productId: "miel", quantity: 1 }]);
  });

  it("aucune violation axe sérieuse sur la page panier des trois templates", async () => {
    for (const v of ["A", "B", "C"] as const) {
      localStorage.setItem(key, JSON.stringify(mockupCart));
      await render(<CartPage site={withVariant(v)} />);
      const result = await axe.run(document.body, {
        rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
      });
      const serious = result.violations.filter((x) => x.impact === "serious" || x.impact === "critical");
      expect(
        serious.map((x) => `${x.id}: ${x.nodes[0]?.html}`),
        v,
      ).toEqual([]);
    }
    // Trois rendus passés à axe : plus que les 5 s par défaut quand toute la suite tourne en parallèle.
  }, 30_000);
});

describe("variante du panier", () => {
  it("suit celle de la boutique, sauf si design.variantes.panier la précise", async () => {
    const site = withVariant("B");
    expect(variantOf(site.config, "panier")).toBe("B");
    site.config.design.variantes.panier = "C";
    expect(variantOf(site.config, "panier")).toBe("C");
    const page = await render(<CartPage site={site} />);
    expect(page.querySelector(".site")!.getAttribute("data-variant")).toBe("C");
  });
});

describe("ajout au panier", () => {
  it("ajouter deux fois le même produit depuis la carte : une ligne, quantité 2, annoncé aux lecteurs d'écran", async () => {
    const miel = base.content.catalog.find((p) => p.id === "miel")!;
    const card = await render(<ProductCard product={miel} site={base} variant="A" />);
    const button = card.querySelector<HTMLButtonElement>("[data-add-to-cart]")!;
    await click(button);
    await click(button);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual([{ productId: "miel", quantity: 2 }]);
    expect(text(button)).toBe("Ajouté ✓");
    expect(text(card.querySelector("[role=status]"))).toBe("Miel de châtaignier ajouté au panier.");
  });

  it("un produit indisponible ne peut pas être ajouté", async () => {
    const terrine = base.content.catalog.find((p) => p.id === "terrine")!;
    const card = await render(<ProductCard product={terrine} site={base} variant="A" />);
    const button = card.querySelector<HTMLButtonElement>("[data-add-to-cart]")!;
    expect(button.disabled).toBe(true);
    await click(button);
    expect(localStorage.getItem(key)).toBeNull();
  });
});
