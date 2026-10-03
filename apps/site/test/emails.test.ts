import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { ClientConfig } from "@launchpadfactoryteam/config";
import type { SiteContent } from "@launchpadfactoryteam/content";
import { FakeMailer } from "@launchpadfactoryteam/emails";
import { FakeProvider } from "@launchpadfactoryteam/psp";
import contentJson from "../generated/content.json";
import siteJson from "../generated/site.json";
import tokens from "../public/theme/tokens.json";
import { handleContact } from "../lib/contact";
import { composeEmail, shopInfo } from "../lib/emails";
import type { StoredOrder } from "../lib/orders";
import { handleWebhook } from "../lib/webhook";
// @ts-expect-error script JavaScript sans déclaration de types
import { writeWorkerEntry } from "../scripts/worker-entry.mjs";

const config = siteJson as unknown as ClientConfig;
const settings = (contentJson as unknown as { pages: SiteContent }).pages.settings;
const shop = shopInfo(config, settings, {
  isDark: tokens.isDark,
  variables: tokens.variables as Record<string, string>,
});

const stored: StoredOrder = {
  id: "a0000000-0000-0000-0000-000000000012",
  number: 12,
  slot_start: "2026-10-06T14:00:00Z",
  slot_end: "2026-10-06T17:00:00Z",
  email: "client@exemple.fr",
  phone: null,
  total_cents: 2500,
  vat_breakdown: { "5.5": 130 },
  anonymized_at: null,
  order_items: [
    { name: "Miel de châtaignier", format: "Pot 250 g", quantity: 2, unit_price_cents: 1250, vat_rate: 5.5 },
  ],
};

const ctx = (order: StoredOrder | null = stored) => ({
  shop,
  notificationEmail: config.boutique.email_notifications,
  loadOrder: vi.fn(async () => order),
});

describe("composition des emails de la file", () => {
  it("confirmation au client, nouvelle commande au commerçant, commande prête au client", async () => {
    const confirmation = await composeEmail({ kind: "order_confirmation", payload: { order_id: stored.id } }, ctx());
    expect(confirmation).toMatchObject({ to: [{ email: "client@exemple.fr" }], tag: "order_confirmation" });
    const merchant = await composeEmail({ kind: "merchant_new_order", payload: { order_id: stored.id } }, ctx());
    expect(merchant).toMatchObject({ to: [{ email: config.boutique.email_notifications }], tag: "merchant_new_order" });
    const ready = await composeEmail({ kind: "order_ready", payload: { order_id: stored.id } }, ctx());
    expect(ready!.subject).toContain("est prête");
  });

  it("commande anonymisée ou introuvable : plus rien à envoyer ; type inconnu : erreur", async () => {
    expect(
      await composeEmail(
        { kind: "order_ready", payload: { order_id: stored.id } },
        ctx({ ...stored, email: null, anonymized_at: "2027-01-01" }),
      ),
    ).toBeNull();
    expect(await composeEmail({ kind: "order_ready", payload: { order_id: stored.id } }, ctx(null))).toBeNull();
    await expect(composeEmail({ kind: "inconnu", payload: { order_id: stored.id } }, ctx())).rejects.toThrow("inconnu");
  });

  it("charte de la boutique : adresse, téléphone lisible, plan et horaires", () => {
    expect(shop.address).toBe(config.boutique.adresse);
    expect(shop.phone).toMatch(/^0\d( \d\d){4}$/);
    expect(shop.mapUrl).toMatch(/^https:\/\/www\.google\.com\/maps\/search\//);
    expect(shop.openingHours.length).toBeGreaterThan(0);
  });
});

describe("formulaire de contact", () => {
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };
  const valid = { nom: "Léa Martin", email: "lea@exemple.fr", message: "Avez-vous du comté ?", consentement: "oui" };

  it("message valide : envoyé au commerçant, réponse directe au client, journalisé, redirection vers /contact/merci", async () => {
    const mailer = new FakeMailer();
    const log = vi.fn(async () => {});
    const result = await handleContact(form(valid), { shop, to: settings.email, send: (e) => mailer.send(e), log });
    expect(result).toEqual({ status: 303, location: "/contact/merci" });
    expect(mailer.sent[0]).toMatchObject({
      to: [{ email: settings.email }],
      replyTo: { email: "lea@exemple.fr", name: "Léa Martin" },
    });
    expect(log).toHaveBeenCalledWith(mailer.sent[0]!.messageId, "sent");
  });

  it("champ piège rempli : faux succès, aucun envoi", async () => {
    const send = vi.fn();
    expect(
      await handleContact(form({ ...valid, site_web: "http://spam" }), { shop, to: "x@y.fr", send, log: vi.fn() }),
    ).toEqual({
      status: 303,
      location: "/contact/merci",
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("champ manquant, email invalide ou consentement absent : 400", async () => {
    for (const bad of [
      { ...valid, nom: "" },
      { ...valid, email: "pas-un-email" },
      { ...valid, consentement: "" },
    ]) {
      expect((await handleContact(form(bad), { shop, to: "x@y.fr", send: vi.fn(), log: vi.fn() })).status).toBe(400);
    }
  });

  it("sans prestataire : 503 ; prestataire en panne : 502, avec le téléphone de la boutique", async () => {
    expect(await handleContact(form(valid), { shop, to: "x@y.fr", send: null, log: vi.fn() })).toMatchObject({
      status: 503,
    });
    const log = vi.fn(async () => {});
    const failing = await handleContact(form(valid), {
      shop,
      to: "x@y.fr",
      send: async () => Promise.reject(new Error("500")),
      log,
    });
    expect(failing).toMatchObject({ status: 502 });
    expect("message" in failing && failing.message).toContain(shop.phone);
    expect(log).toHaveBeenCalledWith(null, "failed");
  });
});

describe("déclenchement des envois", () => {
  it("une nouvelle commande enregistrée lance l'envoi des emails ; un doublon, non", async () => {
    const provider = new FakeProvider("secret");
    const { sessionId } = await provider.createCheckout({
      lines: [
        {
          productId: "miel",
          name: "Miel",
          format: "",
          unitAmountCents: 1250,
          vatRate: 5.5,
          quantity: 1,
          isAlcohol: false,
        },
      ],
      metadata: {
        shopId: "s1",
        slotId: "x",
        slotStart: "2026-10-06T14:00:00Z",
        slotEnd: "2026-10-06T17:00:00Z",
        slotLabel: "",
        ageDeclared: false,
        marketingAccepted: false,
        consentVersion: "v",
        consentHash: "h",
      },
      returnUrl: "",
      termsUrl: "",
      expiresAt: new Date(),
    });
    const { rawBody, signature } = await provider.paidEvent(sessionId, { email: "c@exemple.fr" });
    const afterRecord = vi.fn();
    let first = true;
    const deps = {
      provider,
      shopId: "s1",
      hashKey: "k",
      record: async () => ({ status: (first ? ((first = false), "created") : "duplicate") as "created" | "duplicate" }),
      alert: async () => {},
      afterRecord,
    };
    await handleWebhook(rawBody, signature, deps);
    await handleWebhook(rawBody, signature, deps);
    expect(afterRecord).toHaveBeenCalledTimes(1);
  });

  it("tâche planifiée du Worker : rejeu de la file par le Worker lui-même, avec le secret", async () => {
    const dir = mkdtempSync(join(tmpdir(), "lp-worker-"));
    writeFileSync(
      join(dir, "worker.js"),
      "export class DOQueueHandler {}\nexport default { fetch: () => new Response('ok') };\n",
    );
    writeWorkerEntry(dir);
    const entry = await import(pathToFileURL(join(dir, "lp-worker.js")).href);
    expect(entry.DOQueueHandler).toBeDefined();
    const fetch = vi.fn(async () => new Response("{}"));
    const pending: Promise<unknown>[] = [];
    await entry.default.scheduled(
      {},
      { WORKER_SELF_REFERENCE: { fetch }, CRON_SECRET: "s".repeat(32) },
      { waitUntil: (p: Promise<unknown>) => pending.push(p) },
    );
    await Promise.all(pending);
    expect(fetch).toHaveBeenCalledWith("https://worker.internal/api/emails/outbox", {
      method: "POST",
      headers: { "x-lp-cron-secret": "s".repeat(32) },
    });
  });
});
