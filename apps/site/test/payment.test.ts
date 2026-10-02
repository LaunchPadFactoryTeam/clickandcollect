import { describe, expect, it, vi } from "vitest";
import { parisToUtc } from "@launchpadfactoryteam/commerce";
import type { ClientConfig } from "@launchpadfactoryteam/config";
import type { CatalogProduct, SiteContent } from "@launchpadfactoryteam/content";
import { FakeProvider, sha256Hex, signPayload, type CheckoutInput } from "@launchpadfactoryteam/psp";
import contentJson from "../generated/content.json";
import siteJson from "../generated/site.json";
import { handleCheckout } from "../lib/checkout";
import type { OrderRecord, RecordResult } from "../lib/orders";
import { customerHash, handleWebhook } from "../lib/webhook";

const SECRET = "secret-de-test-du-faux-fournisseur";
const SHOP = "f0000000-0000-4000-8000-000000000001";
const config = siteJson as unknown as ClientConfig;
const catalog = (contentJson as unknown as { catalog: CatalogProduct[] }).catalog;
const settings = (contentJson as unknown as { pages: SiteContent }).pages.settings;

/** Un mardi matin : les créneaux de l'après-midi sont ouverts. */
const now = parisToUtc("2026-10-06", "09:00");
const slotId = "2026-10-06T16:00";
const sellable = catalog.filter((p) => p.available);
const first = sellable.find((p) => !p.isAlcohol)!;

function checkoutDeps(provider = new FakeProvider(SECRET)) {
  return { provider, config, catalog, settings, shopId: SHOP, origin: "https://boutique.test", now };
}

/** Une session payée, telle que le faux fournisseur la produit. */
async function paidSession(overrides: Partial<CheckoutInput["metadata"]> = {}) {
  const provider = new FakeProvider(SECRET);
  const { body } = await handleCheckout(
    { cart: [{ productId: first.id, quantity: 2 }], slotId, ageDeclared: false, marketing: true },
    checkoutDeps(provider),
  );
  const sessionId = String(body.sessionId);
  if (Object.keys(overrides).length) {
    // Réécrit les métadonnées de la session factice (session d'une autre boutique, par exemple).
    const raw = JSON.parse(atob(sessionId.slice("cs_fake_".length).replaceAll("-", "+").replaceAll("_", "/")));
    const meta = { ...raw.metadata, ...(overrides.shopId ? { shop_id: overrides.shopId } : {}) };
    const recoded = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({ ...raw, metadata: meta }))))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/, "");
    return { provider, sessionId: `cs_fake_${recoded}` };
  }
  return { provider, sessionId };
}

/** Base factice : idempotente sur event_id, comme public.record_paid_checkout. */
function memoryDb() {
  const events = new Set<string>();
  const orders: OrderRecord[] = [];
  const record = vi.fn(async (order: OrderRecord): Promise<RecordResult> => {
    if (events.has(order.event_id)) return { status: "duplicate" };
    events.add(order.event_id);
    orders.push(order);
    return { status: "created", number: orders.length };
  });
  return { orders, record };
}

function webhookDeps(provider: FakeProvider, db = memoryDb()) {
  const alert = vi.fn(async () => {});
  return {
    deps: { provider, shopId: SHOP, hashKey: "cle-de-hachage-de-la-boutique", record: db.record, alert },
    db,
    alert,
  };
}

describe("POST /api/checkout", () => {
  it("T5.1 prix falsifiés ignorés : session au prix du catalogue, total recalculé", async () => {
    const { status, body } = await handleCheckout(
      { cart: [{ productId: first.id, quantity: 2, priceTtcCents: 1 }], slotId, ageDeclared: false, marketing: false },
      checkoutDeps(),
    );
    expect(status).toBe(200);
    expect(body.totalCents).toBe(first.priceTtcCents * 2);
    expect(body.provider).toBe("fake");
  });

  it("T5.2 produit indisponible : 409 UNAVAILABLE avec son nom, avant tout paiement", async () => {
    const off = catalog.find((p) => !p.available)!;
    const provider = new FakeProvider(SECRET);
    const spy = vi.spyOn(provider, "createCheckout");
    const { status, body } = await handleCheckout(
      { cart: [{ productId: off.id, quantity: 1 }], slotId, ageDeclared: false },
      checkoutDeps(provider),
    );
    expect(status).toBe(409);
    expect(body).toEqual({ code: "UNAVAILABLE", products: [{ id: off.id, name: off.name }] });
    expect(spy).not.toHaveBeenCalled();
  });

  it("T5.5 métadonnées : boutique, créneau, cases ; texte et version du consentement pris côté serveur", async () => {
    const provider = new FakeProvider(SECRET);
    const spy = vi.spyOn(provider, "createCheckout");
    await handleCheckout(
      { cart: [{ productId: first.id, quantity: 1 }], slotId, ageDeclared: false, marketing: true },
      checkoutDeps(provider),
    );
    const input = spy.mock.calls[0]![0];
    expect(input.metadata).toMatchObject({
      shopId: SHOP,
      slotId,
      slotStart: "2026-10-06T14:00:00.000Z",
      marketingAccepted: true,
      ageDeclared: false,
      consentVersion: settings.marketingConsentVersion,
      consentHash: await sha256Hex(settings.marketingConsentText),
    });
    expect(input.returnUrl).toBe("https://boutique.test/confirmation?session_id={CHECKOUT_SESSION_ID}");
    expect(input.expiresAt.getTime() - now.getTime()).toBe(30 * 60_000);
  });
});

describe("POST /api/webhooks/stripe", () => {
  it("T5.7 signature invalide : 400, aucune écriture", async () => {
    const { provider, sessionId } = await paidSession();
    const { rawBody } = await provider.paidEvent(sessionId, { email: "c@exemple.fr" });
    const { deps, db } = webhookDeps(provider);
    const result = await handleWebhook(rawBody, await signPayload(rawBody, "mauvais-secret"), deps);
    expect(result.status).toBe(400);
    expect(db.record).not.toHaveBeenCalled();
  });

  it("T5.8 event.account d'une autre boutique : 200, ignoré, aucune écriture", async () => {
    const { provider, sessionId } = await paidSession();
    const { rawBody, signature } = await provider.paidEvent(sessionId, { email: "c@exemple.fr" }, "acct_autre");
    const { deps, db } = webhookDeps(provider);
    const result = await handleWebhook(rawBody, signature, deps);
    expect(result).toEqual({ status: 200, body: { received: true, ignored: "autre compte connecté" } });
    expect(db.record).not.toHaveBeenCalled();
  });

  it("session dont les métadonnées désignent une autre boutique : ignorée", async () => {
    const { provider, sessionId } = await paidSession({ shopId: "aaaaaaaa-0000-0000-0000-000000000000" });
    const { rawBody, signature } = await provider.paidEvent(sessionId, { email: "c@exemple.fr" });
    const { deps, db } = webhookDeps(provider);
    expect((await handleWebhook(rawBody, signature, deps)).body).toMatchObject({ ignored: "autre boutique" });
    expect(db.record).not.toHaveBeenCalled();
  });

  it("T5.9 même event_id reçu deux fois : une commande", async () => {
    const { provider, sessionId } = await paidSession();
    const { rawBody, signature } = await provider.paidEvent(sessionId, { email: "c@exemple.fr" });
    const { deps, db } = webhookDeps(provider);
    expect((await handleWebhook(rawBody, signature, deps)).body).toMatchObject({ status: "created" });
    expect((await handleWebhook(rawBody, signature, deps)).body).toMatchObject({ status: "duplicate" });
    expect(db.orders).toHaveLength(1);
  });

  it("T5.10 erreur de base pendant la transaction : 500 pour que Stripe rejoue, alerte envoyée", async () => {
    const { provider, sessionId } = await paidSession();
    const { rawBody, signature } = await provider.paidEvent(sessionId, { email: "c@exemple.fr" });
    const failing = { orders: [], record: vi.fn(async () => Promise.reject(new Error("connexion perdue"))) };
    const { deps, alert } = webhookDeps(provider, failing);
    const result = await handleWebhook(rawBody, signature, deps);
    expect(result.status).toBe(500);
    expect(alert).toHaveBeenCalledWith(
      "Paiement reçu mais commande non enregistrée",
      expect.objectContaining({ sessionId }),
    );
  });

  it("T5.11 session payée, case marketing cochée : commande avec lignes, empreinte client et consentement", async () => {
    const { provider, sessionId } = await paidSession();
    const { rawBody, signature } = await provider.paidEvent(sessionId, {
      email: " Client@Exemple.fr ",
      phone: "+33612345678",
    });
    const { deps, db } = webhookDeps(provider);
    await handleWebhook(rawBody, signature, deps);
    const order = db.orders[0]!;
    expect(order).toMatchObject({
      shop_id: SHOP,
      session_id: sessionId,
      slot_start: "2026-10-06T14:00:00.000Z",
      email: "Client@Exemple.fr",
      phone: "+33612345678",
      total_cents: first.priceTtcCents * 2,
      items: [{ product_id: first.id, quantity: 2, unit_price_cents: first.priceTtcCents }],
      consent: { version: settings.marketingConsentVersion, hash: await sha256Hex(settings.marketingConsentText) },
    });
    // Même empreinte quelle que soit la casse ou les espaces de l'email.
    expect(order.customer_hash).toBe(await customerHash(deps.hashKey, "client@exemple.fr"));
    expect(order.customer_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("T5.12 type d'événement non géré : 200, ignoré", async () => {
    const provider = new FakeProvider(SECRET);
    const raw = JSON.stringify({
      id: "evt_x",
      type: "charge.refunded",
      account: provider.accountId,
      data: { object: { id: "ch_1" } },
    });
    const { deps, db } = webhookDeps(provider);
    expect(await handleWebhook(raw, await signPayload(raw, SECRET), deps)).toEqual({
      status: 200,
      body: { received: true, ignored: "charge.refunded" },
    });
    expect(db.record).not.toHaveBeenCalled();
  });
});
