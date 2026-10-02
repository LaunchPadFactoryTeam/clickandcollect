import { describe, expect, it, vi } from "vitest";
import {
  FakeProvider,
  signPayload,
  StripeProvider,
  toForm,
  verifySignature,
  WebhookSignatureError,
  type CheckoutInput,
} from "../src/index.ts";

const SECRET = "whsec_test_secret";

const input: CheckoutInput = {
  lines: [
    {
      productId: "miel",
      name: "Miel de châtaignier",
      format: "Pot 250 g",
      unitAmountCents: 1250,
      vatRate: 5.5,
      quantity: 2,
      isAlcohol: false,
    },
    {
      productId: "vin",
      name: "Vin orange",
      format: "Bouteille 75 cl",
      unitAmountCents: 2200,
      vatRate: 20,
      quantity: 1,
      isAlcohol: true,
    },
  ],
  metadata: {
    shopId: "f0000000-0000-4000-8000-000000000001",
    slotId: "2026-10-06T16:00",
    slotStart: "2026-10-06T14:00:00.000Z",
    slotEnd: "2026-10-06T17:00:00.000Z",
    slotLabel: "Mardi 6 octobre · 16:00 – 19:00",
    ageDeclared: true,
    marketingAccepted: false,
    consentVersion: "2026-10-02",
    consentHash: "a".repeat(64),
  },
  returnUrl: "https://maison-ferrand.fr/confirmation?session_id={CHECKOUT_SESSION_ID}",
  termsUrl: "https://maison-ferrand.fr/cgv",
  expiresAt: new Date("2026-10-06T12:30:00Z"),
};

/** Faux Stripe : enregistre les appels et répond selon le chemin. */
function stripeMock(routes: Record<string, unknown>) {
  const calls: { method: string; url: string; headers: Record<string, string>; body?: string }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({
      method: init?.method ?? "GET",
      url: u,
      headers: init?.headers as Record<string, string>,
      body: init?.body as string,
    });
    const key = Object.keys(routes).find((k) => {
      const [m, p] = k.split(" ");
      return m === (init?.method ?? "GET") && u.includes(p!);
    });
    if (!key) return new Response(JSON.stringify({ error: { message: `route inattendue ${u}` } }), { status: 404 });
    return new Response(JSON.stringify(routes[key]), { status: 200 });
  });
  const provider = new StripeProvider({
    secretKey: "sk_test_x",
    webhookSecret: SECRET,
    accountId: "acct_boutique",
    publishableKey: "pk_test_x",
    fetch: fetchImpl as unknown as typeof fetch,
  });
  return { provider, calls };
}

const taxRates = {
  data: [
    { id: "txr_55", percentage: 5.5, inclusive: true, active: true },
    { id: "txr_20", percentage: 20, inclusive: true, active: true },
  ],
};
const formOf = (body?: string) => new URLSearchParams(body ?? "");

describe("encodage des paramètres Stripe", () => {
  it("objets et tableaux imbriqués en clés entre crochets", () => {
    expect(toForm({ a: 1, b: { c: "x y", d: [1, { e: true }] }, skip: undefined })).toBe(
      "a=1&b%5Bc%5D=x%20y&b%5Bd%5D%5B0%5D=1&b%5Bd%5D%5B1%5D%5Be%5D=true",
    );
  });
});

describe("signature des webhooks", () => {
  it("accepte une signature valide, refuse une signature fausse, absente, mal formée ou trop ancienne", async () => {
    const body = '{"id":"evt_1"}';
    const now = 1_790_000_000;
    const header = await signPayload(body, SECRET, now);
    await expect(verifySignature(body, header, SECRET, now)).resolves.toBeUndefined();
    await expect(verifySignature(body + " ", header, SECRET, now)).rejects.toThrow("Signature invalide");
    await expect(verifySignature(body, header, "autre_secret", now)).rejects.toThrow(WebhookSignatureError);
    await expect(verifySignature(body, null, SECRET, now)).rejects.toThrow("absent");
    await expect(verifySignature(body, "v1=abc", SECRET, now)).rejects.toThrow("mal formé");
    await expect(verifySignature(body, header, SECRET, now + 301)).rejects.toThrow("expirée");
  });

  it("accepte l'en-tête si l'une des signatures v1 correspond (rotation du secret)", async () => {
    const body = "{}";
    const good = await signPayload(body, SECRET, 100);
    await expect(verifySignature(body, `${good},v1=${"0".repeat(64)}`, SECRET, 100)).resolves.toBeUndefined();
  });
});

describe("session Stripe", () => {
  it("T5.5 métadonnées shop_id, créneau, consentement ; en-tête Stripe-Account sur chaque appel", async () => {
    const { provider, calls } = stripeMock({
      "GET /v1/tax_rates": taxRates,
      "POST /v1/checkout/sessions": { id: "cs_test_1", client_secret: "cs_test_1_secret" },
    });
    const created = await provider.createCheckout(input);
    expect(created).toEqual({
      provider: "stripe",
      sessionId: "cs_test_1",
      clientSecret: "cs_test_1_secret",
      publishableKey: "pk_test_x",
      accountId: "acct_boutique",
    });
    expect(calls.every((c) => c.headers["Stripe-Account"] === "acct_boutique")).toBe(true);
    const post = calls.find((c) => c.method === "POST")!;
    expect(post.headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    const form = formOf(post.body);
    expect(form.get("metadata[shop_id]")).toBe(input.metadata.shopId);
    expect(form.get("metadata[slot_start]")).toBe("2026-10-06T14:00:00.000Z");
    expect(form.get("metadata[slot_end]")).toBe("2026-10-06T17:00:00.000Z");
    expect(form.get("metadata[consent_version]")).toBe("2026-10-02");
    expect(form.get("metadata[age_declared]")).toBe("true");
    expect(form.get("metadata[marketing]")).toBe("false");
    expect(form.get("payment_intent_data[metadata][shop_id]")).toBe(input.metadata.shopId);
  });

  it("T5.6 vin à 20 % : prix TTC, taux inclusif 20 % rattaché ; le miel porte le taux 5,5 %", async () => {
    const { provider } = stripeMock({ "GET /v1/tax_rates": taxRates });
    const form = formOf(toForm(await provider.sessionParams(input)));
    expect(form.get("line_items[1][price_data][unit_amount]")).toBe("2200");
    expect(form.get("line_items[1][price_data][tax_behavior]")).toBe("inclusive");
    expect(form.get("line_items[1][tax_rates][0]")).toBe("txr_20");
    expect(form.get("line_items[1][price_data][product_data][metadata][product_id]")).toBe("vin");
    expect(form.get("line_items[0][tax_rates][0]")).toBe("txr_55");
    expect(form.get("line_items[0][quantity]")).toBe("2");
  });

  it("T5.14 Checkout intégré : case CGV exigée avec le rappel de rétractation, téléphone demandé, expiration à 30 min", async () => {
    const { provider } = stripeMock({ "GET /v1/tax_rates": taxRates });
    const form = formOf(toForm(await provider.sessionParams(input)));
    expect(form.get("ui_mode")).toBe("embedded");
    expect(form.get("consent_collection[terms_of_service]")).toBe("required");
    expect(form.get("custom_text[terms_of_service_acceptance][message]")).toContain("droit de rétractation");
    expect(form.get("custom_text[terms_of_service_acceptance][message]")).toContain("(https://maison-ferrand.fr/cgv)");
    expect(form.get("phone_number_collection[enabled]")).toBe("true");
    expect(form.get("expires_at")).toBe(String(Date.parse("2026-10-06T12:30:00Z") / 1000));
    expect(form.get("return_url")).toContain("{CHECKOUT_SESSION_ID}");
  });

  it("crée les taux de TVA manquants sur le compte connecté, une seule fois", async () => {
    const { provider, calls } = stripeMock({
      "GET /v1/tax_rates": { data: [] },
      "POST /v1/tax_rates": { id: "txr_new" },
    });
    await provider.ensureTaxRates();
    await provider.ensureTaxRates();
    const created = calls.filter((c) => c.method === "POST").map((c) => formOf(c.body));
    expect(created.map((f) => [f.get("percentage"), f.get("inclusive"), f.get("country")])).toEqual([
      ["5.5", "true", "FR"],
      ["20", "true", "FR"],
    ]);
  });
});

describe("webhooks Stripe", () => {
  const paidSession = {
    id: "cs_test_1",
    payment_intent: "pi_1",
    amount_total: 4700,
    customer_details: { email: "client@exemple.fr", phone: "+33612345678" },
    metadata: {
      shop_id: input.metadata.shopId,
      slot_id: "x",
      slot_start: "a",
      slot_end: "b",
      marketing: "true",
      consent_version: "v1",
    },
  };
  const lineItems = {
    data: [
      {
        description: "Miel de châtaignier",
        quantity: 2,
        price: {
          unit_amount: 1250,
          product: { metadata: { product_id: "miel", format: "Pot 250 g", vat_rate: "5.5", is_alcohol: "false" } },
        },
      },
    ],
  };

  async function event(provider: StripeProvider, body: object) {
    const raw = JSON.stringify(body);
    return provider.verifyWebhook(raw, await signPayload(raw, SECRET));
  }

  it("session payée : relit la session et ses lignes chez Stripe, sur le compte connecté", async () => {
    const { provider, calls } = stripeMock({
      "GET /line_items": lineItems,
      "GET /v1/checkout/sessions/cs_test_1": paidSession,
    });
    const result = await event(provider, {
      id: "evt_1",
      type: "checkout.session.completed",
      account: "acct_boutique",
      data: { object: { id: "cs_test_1", payment_status: "paid" } },
    });
    expect(result.kind).toBe("checkout.paid");
    if (result.kind !== "checkout.paid") return;
    expect(result.checkout).toMatchObject({
      sessionId: "cs_test_1",
      paymentIntentId: "pi_1",
      email: "client@exemple.fr",
      amountTotalCents: 4700,
      lines: [{ productId: "miel", unitAmountCents: 1250, vatRate: 5.5, quantity: 2, format: "Pot 250 g" }],
      metadata: { shopId: input.metadata.shopId, marketingAccepted: true, consentVersion: "v1" },
    });
    expect(calls.every((c) => c.headers["Stripe-Account"] === "acct_boutique")).toBe(true);
  });

  it("T5.8 événement d'un autre compte connecté : ignoré, rien n'est relu chez Stripe", async () => {
    const { provider, calls } = stripeMock({});
    const result = await event(provider, {
      id: "evt_2",
      type: "checkout.session.completed",
      account: "acct_autre_boutique",
      data: { object: { id: "cs_x", payment_status: "paid" } },
    });
    expect(result).toEqual({
      kind: "ignored",
      eventId: "evt_2",
      type: "checkout.session.completed",
      account: "acct_autre_boutique",
    });
    expect(calls).toHaveLength(0);
  });

  it("T5.12 type non géré et paiement différé non encore réglé : ignorés", async () => {
    const { provider } = stripeMock({});
    for (const body of [
      { id: "e1", type: "charge.refunded", account: "acct_boutique", data: { object: { id: "ch_1" } } },
      {
        id: "e2",
        type: "checkout.session.completed",
        account: "acct_boutique",
        data: { object: { id: "cs", payment_status: "unpaid" } },
      },
    ]) {
      expect((await event(provider, body)).kind).toBe("ignored");
    }
  });

  it("T5.7 signature invalide : erreur de signature, aucun appel à Stripe", async () => {
    const { provider, calls } = stripeMock({});
    await expect(provider.verifyWebhook('{"id":"evt"}', "t=1,v1=00")).rejects.toThrow(WebhookSignatureError);
    expect(calls).toHaveLength(0);
  });
});

describe("domaine Apple Pay", () => {
  it("enregistre le domaine de la boutique sur le compte connecté", async () => {
    const { provider, calls } = stripeMock({ "POST /v1/payment_method_domains": { id: "pmd_1" } });
    await provider.registerPaymentDomain("maison-ferrand.fr");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.headers["Stripe-Account"]).toBe("acct_boutique");
    expect(formOf(calls[0]!.body).get("domain_name")).toBe("maison-ferrand.fr");
  });

  it("la commande refuse un domaine invalide ou des clés absentes", async () => {
    const { main } = await import("../src/cli.ts");
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await main(["enregistrer-domaine", "pas un domaine"], {})).toBe(2);
    expect(await main(["enregistrer-domaine", "maison-ferrand.fr"], {})).toBe(2);
    err.mockRestore();
  });
});

describe("faux fournisseur", () => {
  it("T5.15 le tunnel fonctionne sans Stripe : session, événement signé, commande payée", async () => {
    const fake = new FakeProvider(SECRET);
    const created = await fake.createCheckout(input);
    expect(created.provider).toBe("fake");
    const { rawBody, signature } = await fake.paidEvent(created.sessionId, { email: "client@exemple.fr" });
    const result = await fake.verifyWebhook(rawBody, signature);
    expect(result.kind).toBe("checkout.paid");
    if (result.kind !== "checkout.paid") return;
    expect(result.checkout.lines).toEqual(input.lines);
    expect(result.checkout.metadata).toEqual(input.metadata);
    expect(result.checkout.amountTotalCents).toBe(4700);
    await expect(
      fake.verifyWebhook(rawBody, (await fake.paidEvent("cs_fake_x", { email: "a@b.fr" })).signature),
    ).rejects.toThrow(WebhookSignatureError);
  });

  it("le même identifiant d'événement pour un même paiement (rejeu)", async () => {
    const fake = new FakeProvider(SECRET);
    const { sessionId } = await fake.createCheckout(input);
    const a = await fake.paidEvent(sessionId, { email: "x@y.fr" });
    const b = await fake.paidEvent(sessionId, { email: "x@y.fr" });
    expect(JSON.parse(a.rawBody).id).toBe(JSON.parse(b.rawBody).id);
    // Deux sessions pour un même panier : deux sessions et deux événements distincts.
    const other = await fake.createCheckout(input);
    expect(other.sessionId).not.toBe(sessionId);
    const c = await fake.paidEvent(other.sessionId, { email: "x@y.fr" });
    expect(JSON.parse(c.rawBody).id).not.toBe(JSON.parse(a.rawBody).id);
  });
});
