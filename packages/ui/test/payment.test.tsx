// @vitest-environment jsdom
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cartStorageKey } from "@launchpadfactoryteam/commerce";
import { loadConfig } from "@launchpadfactoryteam/config";
import { loadLocalContent } from "@launchpadfactoryteam/content";
import { ConfirmationPage, PaymentPage, slotText, type Site } from "../src/index.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const dir = join(__dirname, "../../../examples/maison-ferrand");
const site: Site = {
  config: loadConfig(dir, { now: new Date("2026-10-02T08:00:00Z") }).config,
  content: loadLocalContent(dir),
};
const shop = site.config.boutique.domaine;

let host: HTMLDivElement;
let root: Root;
const text = (el: Element | null) => el?.textContent?.replace(/[ \t\n\r]+/g, " ").trim();
/** Laisse s'écouler les promesses (fetch simulé) et les rendus qui en découlent. */
const flush = () => act(async () => new Promise((r) => setTimeout(r, 0)));

function mockFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const { status, body } = handler(String(url), init);
    return new Response(JSON.stringify(body), { status });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  host = document.createElement("div");
  document.body.replaceChildren(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("page paiement", () => {
  it("sans créneau choisi : renvoie au panier, aucune session ouverte", async () => {
    localStorage.setItem(cartStorageKey(shop), JSON.stringify([{ productId: "miel", quantity: 1 }]));
    const fetch = mockFetch(() => ({ status: 200, body: {} }));
    await act(async () => root.render(<PaymentPage site={site} />));
    await flush();
    expect(text(host.querySelector(".pay__error"))).toContain("Choisissez d'abord votre créneau de retrait.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("envoie le panier et le choix de l'étape 1 ; produit coupé entre-temps : signalé avec son nom", async () => {
    localStorage.setItem(cartStorageKey(shop), JSON.stringify([{ productId: "miel", quantity: 2 }]));
    sessionStorage.setItem(
      `lp:commande:${shop}`,
      JSON.stringify({ slotId: "2026-10-06T16:00", ageDeclared: false, marketing: true }),
    );
    const fetch = mockFetch(() => ({
      status: 409,
      body: { code: "UNAVAILABLE", products: [{ id: "miel", name: "Miel de châtaignier" }] },
    }));
    await act(async () => root.render(<PaymentPage site={site} />));
    await flush();
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
      cart: [{ productId: "miel", quantity: 2 }],
      slotId: "2026-10-06T16:00",
      ageDeclared: false,
      marketing: true,
    });
    const error = host.querySelector(".pay__error")!;
    expect(text(error)).toContain("n'est plus disponible");
    expect(text(error)).toContain("Miel de châtaignier");
    expect(host.querySelector("input[type=email]")).toBeNull();
  });

  it("faux fournisseur : formulaire de test avec email requis, case CGV exigée et montant du serveur", async () => {
    localStorage.setItem(cartStorageKey(shop), JSON.stringify([{ productId: "miel", quantity: 1 }]));
    sessionStorage.setItem(
      `lp:commande:${shop}`,
      JSON.stringify({ slotId: "x", ageDeclared: false, marketing: false }),
    );
    mockFetch(() => ({
      status: 200,
      body: {
        provider: "fake",
        sessionId: "cs_fake_1",
        clientSecret: "cs_fake_1",
        totalCents: 1250,
        slotLabel: "Demain · 10:00 – 12:00",
      },
    }));
    await act(async () => root.render(<PaymentPage site={site} />));
    await flush();
    expect(host.querySelector<HTMLInputElement>("input[type=email]")!.required).toBe(true);
    const cgv = host.querySelector<HTMLInputElement>("input[name=cgv]")!;
    expect(cgv.required).toBe(true);
    expect(cgv.checked).toBe(false);
    expect(text(host.querySelector(".cart__pay"))).toBe("Payer 12,50 €");
    expect(text(host.querySelector(".cart__chosen"))).toBe("Retrait : Demain · 10:00 – 12:00");
  });
});

describe("page confirmation", () => {
  it("attend le webhook, puis affiche la commande et vide le panier", async () => {
    localStorage.setItem(cartStorageKey(shop), JSON.stringify([{ productId: "miel", quantity: 1 }]));
    window.history.replaceState(null, "", "/confirmation?session_id=cs_test_1");
    let calls = 0;
    mockFetch(() =>
      ++calls < 2
        ? { status: 200, body: { status: "pending" } }
        : {
            status: 200,
            body: {
              status: "paid",
              number: 12,
              slotStart: "2026-10-06T14:00:00Z",
              slotEnd: "2026-10-06T17:00:00Z",
              totalCents: 5820,
            },
          },
    );
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await act(async () => root.render(<ConfirmationPage site={site} />));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(text(host.querySelector("[role=status]"))).toContain("Paiement en cours de confirmation");
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(text(host.querySelector(".confirm__lead"))).toBe("Merci ! Votre commande n° 12 est confirmée.");
    expect(text(host.querySelector(".confirm__facts"))).toContain("mardi 6 octobre, entre 16:00 et 19:00");
    expect(localStorage.getItem(cartStorageKey(shop))).toBeNull();
  });

  it("créneau affiché à l'heure de Paris", () => {
    expect(slotText("2026-03-31T08:00:00Z", "2026-03-31T10:00:00Z")).toBe("mardi 31 mars, entre 10:00 et 12:00");
  });
});
