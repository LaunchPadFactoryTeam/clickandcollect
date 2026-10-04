// @vitest-environment jsdom
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AdminShell,
  AvailabilityForm,
  ForgotScreen,
  LoginScreen,
  OrderDetailScreen,
  OrdersScreen,
  ResetScreen,
  type OrderDetailView,
  type OrdersView,
} from "../src/admin/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ORDERS: OrdersView = {
  banner: { count: 3, totalCents: 13680, nextSlotCount: 3 },
  filter: "all",
  groups: [
    {
      title: "Aujourd'hui · 16:00 – 19:00",
      orders: [
        { id: "o1", number: 2471, status: "new", client: "Camille Besson", itemCount: 4, totalCents: 4470 },
        { id: "o2", number: 2470, status: "preparing", client: "Yanis Moreau", itemCount: 3, totalCents: 5040 },
        { id: "o3", number: 2469, status: "ready", client: "Hélène Daviau", itemCount: 4, totalCents: 4170 },
      ],
    },
    {
      title: "Hier · 16:00 – 19:00",
      orders: [
        { id: "o6", number: 2466, status: "collected", client: "Antoine Fabre", itemCount: 1, totalCents: 1800 },
      ],
    },
  ],
};

const DETAIL: OrderDetailView = {
  id: "o3",
  number: 2469,
  status: "ready",
  client: "Hélène Daviau",
  slotLabel: "Aujourd'hui 16:00 – 19:00",
  paidLabel: "1 oct. à 19:03",
  email: "helene.daviau@exemple.fr",
  phone: "06 44 00 00 00",
  lines: [{ name: "Huile d'olive Lucques", format: "Bidon 500 ml", quantity: 1, totalCents: 1800 }],
  vat: [{ rate: 5.5, cents: 217 }],
  totalCents: 4170,
};

const PRODUCTS = [
  { id: "tomme", name: "Tomme du Larzac affinée", format: "Portion 300 g", priceCents: 1120, available: true },
  { id: "miel", name: "Miel de châtaignier", format: "Pot 250 g", priceCents: 1250, available: true },
  { id: "terrine", name: "Terrine de canard aux figues", format: "Bocal 180 g", priceCents: 980, available: false },
];

const shell = (children: React.ReactNode, section: "orders" | "products" = "orders") => (
  <AdminShell shopName="Maison Ferrand" dateLabel="Jeudi 2 octobre" newCount={3} section={section}>
    {children}
  </AdminShell>
);

function dom(element: React.ReactElement): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(element);
  return host;
}

async function violations(root: Element) {
  const result = await axe.run(root, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
  return result.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id);
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  document.documentElement.lang = "fr";
  host = document.createElement("div");
  document.body.replaceChildren(host);
  root = createRoot(host);
});
afterEach(() => act(async () => root.unmount()));

describe("liste des commandes", () => {
  it("cartes : client, numéro et articles, statut, bouton d'avancement libellé selon le statut", () => {
    const page = dom(<OrdersScreen {...ORDERS} />);
    const cards = [...page.querySelectorAll(".bo-card")];
    expect(cards.map((c) => c.querySelector(".bo-card__client")!.textContent)).toEqual([
      "Camille Besson",
      "Yanis Moreau",
      "Hélène Daviau",
      "Antoine Fabre",
    ]);
    expect(cards[0]!.querySelector(".bo-mono")!.textContent).toBe("#2471 · 4 articles");
    expect(cards.map((c) => c.querySelector("button[type=submit]")?.textContent ?? null)).toEqual([
      "Mettre en préparation",
      "Marquer prête",
      "Marquer retirée",
      null,
    ]);
    const advance = cards[1]!.querySelector("form")!;
    expect(advance.getAttribute("action")).toBe("/api/admin/commandes/o2/statut");
    expect((advance.querySelector("input[name=statut]") as HTMLInputElement).value).toBe("ready");
  });

  it("bandeau du jour, filtres en liens, groupes titrés avec leur nombre de commandes", () => {
    const page = dom(<OrdersScreen {...ORDERS} filter="ready" />);
    expect([...page.querySelectorAll(".bo-stat__value")].map((s) => s.textContent)).toEqual(["3", "136,80 €", "3"]);
    const current = page.querySelector(".bo-filter[aria-current=page]")!;
    expect([current.textContent, current.getAttribute("href")]).toEqual(["Prête", "/admin?statut=ready"]);
    expect([...page.querySelectorAll(".bo-group__head")].map((g) => g.textContent)).toEqual([
      "Aujourd'hui · 16:00 – 19:00" + "3 commandes",
      "Hier · 16:00 – 19:00" + "1 commande",
    ]);
  });

  it("cadre : nom de la boutique, compteur de nouvelles commandes, navigation basse Commandes / Produits", () => {
    const page = dom(shell(<OrdersScreen {...ORDERS} />));
    expect(page.querySelector(".bo-pill")!.textContent).toBe("3 nouvelles");
    expect(page.querySelector('.bo-nav [aria-current="page"]')!.textContent).toContain("Commandes");
    expect(page.querySelector("button[aria-label='Se déconnecter']")).not.toBeNull();
  });
});

describe("détail d'une commande", () => {
  it("avancement en 4 étapes : seuls l'étape suivante et le retour d'un cran sont des boutons", () => {
    const page = dom(<OrderDetailScreen {...DETAIL} />);
    const steps = [...page.querySelectorAll(".bo-steps > li")];
    expect(
      steps.map((s) =>
        s.querySelector("button") ? "bouton" : s.querySelector("[aria-current=step]") ? "actuel" : "—",
      ),
    ).toEqual(["—", "bouton", "actuel", "bouton"]);
    const back = steps[1]!.querySelector("form")!;
    expect((back.querySelector("input[name=statut]") as HTMLInputElement).value).toBe("preparing");
    expect(page.querySelector("a[href^='tel:']")!.getAttribute("href")).toBe("tel:0644000000");
    expect(page.textContent).toContain("Les remboursements se font depuis votre tableau de bord Stripe");
  });
});

describe("disponibilité", () => {
  it("T7.9 deux interrupteurs basculés, non enregistrés : « 2 modifications », rien d'envoyé", async () => {
    await act(async () => root.render(<AvailabilityForm products={PRODUCTS} />));
    const switches = [...host.querySelectorAll("[role=switch]")] as HTMLButtonElement[];
    expect(host.querySelector(".bo-savebar")!.hasAttribute("hidden")).toBe(true);
    await act(async () => switches[0]!.click());
    await act(async () => switches[2]!.click());
    expect(host.querySelector(".bo-savebar span")!.textContent).toBe("2 modifications");
    expect(host.querySelector(".bo-savebar")!.hasAttribute("hidden")).toBe(false);
    expect(host.querySelector(".bo-title-row .bo-mono")!.textContent).toBe("2 / 3 en vente");
    // Le formulaire porterait les seuls produits basculés, et ceux d'entre eux remis en vente.
    const data = new FormData(host.querySelector("form")!);
    expect(data.getAll("produit")).toEqual(["tomme", "terrine"]);
    expect(data.getAll("en_vente")).toEqual(["terrine"]);
  });

  it("T7.13 interrupteurs : role=switch, aria-checked cohérent, annoncés « En vente » ou « Coupé », 0 violation axe", async () => {
    await act(async () => root.render(<AvailabilityForm products={PRODUCTS} />));
    const terrine = host.querySelectorAll("[role=switch]")[2] as HTMLButtonElement;
    const name = () =>
      terrine
        .getAttribute("aria-labelledby")!
        .split(" ")
        .map((id) => document.getElementById(id)!.textContent)
        .join(" ");
    expect([terrine.getAttribute("aria-checked"), name()]).toEqual(["false", "Terrine de canard aux figues Coupé"]);
    await act(async () => terrine.click());
    expect([terrine.getAttribute("aria-checked"), name()]).toEqual(["true", "Terrine de canard aux figues En vente"]);
    expect(await violations(host)).toEqual([]);
  });

  it("recherche de produit, sans accents ni casse", async () => {
    await act(async () => root.render(<AvailabilityForm products={PRODUCTS} />));
    const search = host.querySelector("input[type=search]") as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(search, "CHATAIGNIER");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect([...host.querySelectorAll(".bo-product:not([hidden]) .bo-product__name")].map((p) => p.textContent)).toEqual(
      ["Miel de châtaignier"],
    );
  });
});

describe("accessibilité", () => {
  it("connexion, mot de passe oublié, nouveau mot de passe, commandes, détail : 0 violation sérieuse ou critique", async () => {
    for (const element of [
      <LoginScreen key="l" shopName="Maison Ferrand" error="bloque" />,
      <ForgotScreen key="f" shopName="Maison Ferrand" sent />,
      <ResetScreen key="r" shopName="Maison Ferrand" token={"a".repeat(43)} valid error="confirmation" />,
      shell(<OrdersScreen {...ORDERS} />),
      shell(<OrderDetailScreen {...DETAIL} />),
    ]) {
      document.body.innerHTML = renderToStaticMarkup(element);
      expect(await violations(document.body)).toEqual([]);
    }
  });

  it("connexion bloquée : message de blocage temporaire annoncé", () => {
    const page = dom(<LoginScreen shopName="Maison Ferrand" error="bloque" />);
    expect(page.querySelector("[role=alert]")!.textContent).toContain("bloqué pendant 15 minutes");
  });
});
