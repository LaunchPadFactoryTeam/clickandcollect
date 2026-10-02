import { describe, expect, it } from "vitest";
import {
  addToCart,
  cartCount,
  cartStorageKey,
  computeSlots,
  computeTotals,
  findSlot,
  parisToUtc,
  parseCart,
  removeFromCart,
  requiresAgeDeclaration,
  resolveCart,
  setQuantity,
  vatFromTtc,
  type PickupConfig,
} from "../src/index.ts";

/** Les produits du panier des maquettes, prix et taux de la démo. */
const catalog = [
  { id: "tomme", priceTtcCents: 1120, vatRate: 5.5, available: true },
  { id: "miel", priceTtcCents: 1250, vatRate: 5.5, available: true },
  { id: "vin", priceTtcCents: 2200, vatRate: 20, available: true, isAlcohol: true },
  { id: "terrine", priceTtcCents: 980, vatRate: 5.5, available: false },
];

const pickup: PickupConfig = {
  delai_preparation_heures: 2,
  creneaux: {
    mardi: ["10:00-12:00", "16:00-19:00"],
    mercredi: ["10:00-12:00", "16:00-19:00"],
    samedi: ["09:00-13:00"],
  },
  fermetures: [],
};
const paris = (date: string, time: string) => parisToUtc(date, time);

describe("panier", () => {
  it("T4.1 ajouter deux fois le même produit : une ligne, quantité 2", () => {
    const cart = addToCart(addToCart([], "miel"), "miel");
    expect(cart).toEqual([{ productId: "miel", quantity: 2 }]);
    expect(cartCount(addToCart(cart, "vin"))).toBe(3);
  });

  it("T4.2 bouton − sur une quantité de 1 : la quantité reste 1", () => {
    const cart = setQuantity([{ productId: "miel", quantity: 1 }], "miel", 0);
    expect(cart).toEqual([{ productId: "miel", quantity: 1 }]);
    expect(removeFromCart(cart, "miel")).toEqual([]);
  });

  it("T4.3 quantité 21 : plafonnée à 20", () => {
    expect(setQuantity([{ productId: "miel", quantity: 3 }], "miel", 21)[0]!.quantity).toBe(20);
    expect(addToCart([{ productId: "miel", quantity: 19 }], "miel", 5)[0]!.quantity).toBe(20);
  });

  it("T4.4 produit absent du catalogue courant : ligne retirée au chargement", () => {
    const stored = JSON.stringify([
      { productId: "miel", quantity: 2 },
      { productId: "retire-du-catalogue", quantity: 1 },
    ]);
    expect(parseCart(stored, new Set(catalog.map((p) => p.id)))).toEqual([{ productId: "miel", quantity: 2 }]);
  });

  it("relit un stockage abîmé sans erreur : JSON invalide, lignes malformées, doublons", () => {
    expect(parseCart("{pas du json")).toEqual([]);
    expect(parseCart('{"productId":"miel"}')).toEqual([]);
    const messy = [{ productId: "miel", quantity: 2 }, { productId: "miel", quantity: 30 }, { quantity: 1 }, "x", null];
    expect(parseCart(JSON.stringify(messy))).toEqual([{ productId: "miel", quantity: 20 }]);
  });

  it("la clé de stockage est propre à chaque boutique", () => {
    expect(cartStorageKey("maison-ferrand.fr")).not.toBe(cartStorageKey("noiretsel.fr"));
  });
});

describe("montants et TVA", () => {
  it("T4.5 3 620 centimes à 5,5 % : 189 centimes de TVA", () => {
    expect(vatFromTtc(3620, 5.5)).toBe(189);
  });

  it("T4.6 2 200 centimes à 20 % : 367 centimes de TVA", () => {
    expect(vatFromTtc(2200, 20)).toBe(367);
  });

  it("T4.7 panier des maquettes (1 tomme, 2 miels, 1 vin) : 5 820 centimes, ventilation { 5.5: 189, 20: 367 }", () => {
    const cart = [
      { productId: "tomme", quantity: 1 },
      { productId: "miel", quantity: 2 },
      { productId: "vin", quantity: 1 },
    ];
    const { totals } = resolveCart(cart, catalog);
    expect(totals).toMatchObject({ subtotalCents: 5820, totalCents: 5820, vatByRate: { "5.5": 189, "20": 367 } });
    expect(totals.vatLines).toEqual([
      { rate: 5.5, cents: 189 },
      { rate: 20, cents: 367 },
    ]);
  });

  it("la TVA se calcule par taux sur le total du taux, pas ligne à ligne", () => {
    // 3 × 1,05 € à 5,5 % : ligne à ligne 3 × 5 = 15 centimes ; sur le total 315 → 16 centimes.
    expect(computeTotals([{ priceTtcCents: 105, vatRate: 5.5, quantity: 3 }]).vatByRate).toEqual({ "5.5": 16 });
  });

  it("un produit coupé reste visible mais sort des montants ; l'alcool déclenche la case de majorité", () => {
    const resolved = resolveCart(
      [
        { productId: "terrine", quantity: 1 },
        { productId: "vin", quantity: 1 },
      ],
      catalog,
    );
    expect(resolved.unavailable.map((l) => l.product.id)).toEqual(["terrine"]);
    expect(resolved.totals.totalCents).toBe(2200);
    expect(requiresAgeDeclaration(true, resolved)).toBe(true);
    expect(requiresAgeDeclaration(false, resolved)).toBe(false);
    expect(requiresAgeDeclaration(true, resolveCart([{ productId: "miel", quantity: 1 }], catalog))).toBe(false);
  });
});

describe("créneaux", () => {
  it("T4.8 mardi 15:30, délai 2 h : le créneau 16:00-19:00 est proposé « à partir de 17:30 »", () => {
    const slots = computeSlots(pickup, paris("2026-10-06", "15:30"));
    expect(slots[0]).toMatchObject({
      id: "2026-10-06T16:00",
      label: "Aujourd'hui · 16:00 – 19:00",
      note: "à partir de 17:30",
    });
  });

  it("l'heure « à partir de » est arrondie au quart d'heure supérieur", () => {
    expect(computeSlots(pickup, paris("2026-10-06", "15:37"))[0]!.note).toBe("à partir de 17:45");
  });

  it("T4.9 mardi 18:00, délai 2 h : le créneau 16:00-19:00 du jour est exclu", () => {
    const slots = computeSlots(pickup, paris("2026-10-06", "18:00"));
    expect(slots.some((s) => s.date === "2026-10-06")).toBe(false);
    expect(slots[0]).toMatchObject({ id: "2026-10-07T10:00", dayLabel: "Demain" });
  });

  it("T4.10 date de fermeture : aucun créneau ce jour", () => {
    const slots = computeSlots({ ...pickup, fermetures: ["2026-10-07"] }, paris("2026-10-06", "08:00"));
    expect(slots.some((s) => s.date === "2026-10-07")).toBe(false);
    expect(slots.some((s) => s.date === "2026-10-13")).toBe(true);
  });

  it("T4.11 mardi 31 mars 2026 10:00 à Paris (heure d'été) : début à 08:00 UTC", () => {
    const slot = computeSlots(pickup, paris("2026-03-30", "12:00")).find((s) => s.id === "2026-03-31T10:00")!;
    expect(slot.startsAt).toBe("2026-03-31T08:00:00.000Z");
  });

  it("T4.12 mardi 24 mars 2026 10:00 à Paris (heure d'hiver) : début à 09:00 UTC", () => {
    const slot = computeSlots(pickup, paris("2026-03-23", "12:00")).find((s) => s.id === "2026-03-24T10:00")!;
    expect(slot.startsAt).toBe("2026-03-24T09:00:00.000Z");
  });

  it("T4.13 libellés : « Aujourd'hui », « Demain », puis le jour et la date", () => {
    const slots = computeSlots(pickup, paris("2026-10-06", "08:00"));
    expect(slots.map((s) => s.dayLabel).slice(0, 5)).toEqual([
      "Aujourd'hui",
      "Aujourd'hui",
      "Demain",
      "Demain",
      "Samedi 10 octobre",
    ]);
  });

  it("T4.14 horizon : aucun créneau au-delà de 14 jours", () => {
    const now = paris("2026-10-06", "08:00");
    const slots = computeSlots(pickup, now);
    expect(slots.at(-1)!.date).toBe("2026-10-17");
    expect(slots.every((s) => s.date < "2026-10-20")).toBe(true);
  });

  it("le serveur retrouve un créneau encore proposé, et refuse un créneau passé", () => {
    const now = paris("2026-10-06", "15:30");
    expect(findSlot(pickup, "2026-10-06T16:00", now)).toBeDefined();
    expect(findSlot(pickup, "2026-10-06T10:00", now)).toBeUndefined();
  });
});
