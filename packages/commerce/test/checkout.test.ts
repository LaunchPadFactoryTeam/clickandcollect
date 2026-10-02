import { describe, expect, it } from "vitest";
import { buildCheckout, parisToUtc, type PickupConfig } from "../src/index.ts";

const catalog = [
  { id: "tomme", priceTtcCents: 1120, vatRate: 5.5, available: true },
  { id: "miel", priceTtcCents: 1250, vatRate: 5.5, available: true },
  { id: "vin", priceTtcCents: 2200, vatRate: 20, available: true, isAlcohol: true },
  { id: "terrine", priceTtcCents: 980, vatRate: 5.5, available: false },
];
const pickup: PickupConfig = { delai_preparation_heures: 2, creneaux: { mardi: ["16:00-19:00"] }, fermetures: [] };
const now = parisToUtc("2026-10-06", "10:00");
const ctx = { catalog, pickup, alcoholFeature: true, now };
const slotId = "2026-10-06T16:00";

describe("construction de la session (serveur)", () => {
  it("T5.1 panier avec prix falsifié : montants issus du catalogue serveur", () => {
    const result = buildCheckout(
      { cart: [{ productId: "miel", quantity: 2, priceTtcCents: 1, unitAmountCents: 1 }], slotId, ageDeclared: false },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.lines.map((l) => [l.product.id, l.product.priceTtcCents, l.quantity])).toEqual([["miel", 1250, 2]]);
    expect(result.totals.totalCents).toBe(2500);
  });

  it("T5.2 ligne indisponible : erreur UNAVAILABLE listant le produit (et un produit retiré du catalogue)", () => {
    expect(
      buildCheckout(
        {
          cart: [
            { productId: "terrine", quantity: 1 },
            { productId: "miel", quantity: 1 },
            { productId: "retire", quantity: 1 },
          ],
          slotId,
          ageDeclared: false,
        },
        ctx,
      ),
    ).toEqual({ ok: false, code: "UNAVAILABLE", productIds: ["terrine", "retire"] });
  });

  it("T5.3 créneau expiré, inconnu ou absent : erreur SLOT_EXPIRED", () => {
    const cart = [{ productId: "miel", quantity: 1 }];
    const late = parisToUtc("2026-10-06", "18:00");
    expect(buildCheckout({ cart, slotId, ageDeclared: false }, { ...ctx, now: late })).toEqual({
      ok: false,
      code: "SLOT_EXPIRED",
    });
    expect(buildCheckout({ cart, slotId: "2026-10-06T09:00", ageDeclared: false }, ctx)).toMatchObject({
      code: "SLOT_EXPIRED",
    });
    expect(buildCheckout({ cart, slotId: undefined, ageDeclared: false }, ctx)).toMatchObject({ code: "SLOT_EXPIRED" });
  });

  it("T5.4 alcool sans déclaration de majorité : erreur AGE_REQUIRED ; sans l'option alcool, pas d'exigence", () => {
    const cart = [{ productId: "vin", quantity: 1 }];
    expect(buildCheckout({ cart, slotId, ageDeclared: false }, ctx)).toEqual({ ok: false, code: "AGE_REQUIRED" });
    expect(buildCheckout({ cart, slotId, ageDeclared: "true" }, ctx)).toMatchObject({ code: "AGE_REQUIRED" });
    expect(buildCheckout({ cart, slotId, ageDeclared: true }, ctx).ok).toBe(true);
    expect(buildCheckout({ cart, slotId, ageDeclared: false }, { ...ctx, alcoholFeature: false }).ok).toBe(true);
  });

  it("T5.5 panier valide : lignes, créneau en UTC, TVA par taux", () => {
    const result = buildCheckout(
      {
        cart: [
          { productId: "tomme", quantity: 1 },
          { productId: "miel", quantity: 2 },
          { productId: "vin", quantity: 1 },
        ],
        slotId,
        ageDeclared: true,
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slot).toMatchObject({ startsAt: "2026-10-06T14:00:00.000Z", endsAt: "2026-10-06T17:00:00.000Z" });
    expect(result.totals.vatByRate).toEqual({ "5.5": 189, "20": 367 });
    expect(result.hasAlcohol).toBe(true);
  });

  it("panier vide ou illisible : erreur EMPTY", () => {
    expect(buildCheckout({ cart: "n'importe quoi", slotId, ageDeclared: false }, ctx)).toEqual({
      ok: false,
      code: "EMPTY",
    });
    expect(buildCheckout({ cart: [], slotId, ageDeclared: false }, ctx)).toEqual({ ok: false, code: "EMPTY" });
  });
});
