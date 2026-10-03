// @vitest-environment jsdom
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "@launchpadfactoryteam/config";
import { buildThemeFromLoaded } from "@launchpadfactoryteam/theme";
import {
  BrevoMailer,
  contactMessageEmail,
  contrast,
  emailPalette,
  FakeMailer,
  MAX_ATTEMPTS,
  merchantNewOrderEmail,
  MIN_CONTRAST,
  orderConfirmationEmail,
  orderReadyEmail,
  passwordResetEmail,
  processOutbox,
  type OrderInfo,
  type OutboxDeps,
  type OutboxRow,
  type ShopInfo,
} from "../src/index.ts";

const NOW = new Date("2026-10-02T08:00:00Z");

function shopFor(example: string): ShopInfo {
  const theme = buildThemeFromLoaded(loadConfig(join(__dirname, `../../../examples/${example}`), { now: NOW }));
  return {
    name: example === "noir-et-sel" ? "Noir & Sel" : "Maison Ferrand",
    domain: "maison-ferrand.fr",
    address: "12 rue des Halles, 34000 Montpellier",
    phone: "04 67 00 00 00",
    openingHours: ["Mardi au vendredi : 09:00–13:00 · 15:30–19:30", "Samedi : 09:00–19:00"],
    mapUrl: "https://www.google.com/maps/search/?api=1&query=12%20rue%20des%20Halles%2034000%20Montpellier",
    palette: emailPalette({ isDark: theme.palette.isDark, variables: theme.variables }),
  };
}

/** La commande des maquettes : 1 tomme, 2 miels, 1 vin, 58,20 €. */
const order: OrderInfo = {
  id: "a0000000-0000-0000-0000-000000000012",
  number: 12,
  slotStart: "2026-10-06T14:00:00Z",
  slotEnd: "2026-10-06T17:00:00Z",
  email: "client@exemple.fr",
  phone: "+33612345678",
  totalCents: 5820,
  vatBreakdown: { "20": 367, "5.5": 189 },
  items: [
    { name: "Tomme du Larzac affinée", format: "Portion 300 g", quantity: 1, unitPriceCents: 1120, vatRate: 5.5 },
    { name: "Miel de châtaignier", format: "Pot 250 g", quantity: 2, unitPriceCents: 1250, vatRate: 5.5 },
    { name: "Vin orange, Domaine Lasserre", format: "Bouteille 75 cl", quantity: 1, unitPriceCents: 2200, vatRate: 20 },
  ],
};

const doc = (html: string) => new DOMParser().parseFromString(html, "text/html");

describe("gabarits", () => {
  it("T6.1 confirmation : numéro, lignes, TVA par taux, total, créneau, adresse et plan", () => {
    const email = orderConfirmationEmail(shopFor("maison-ferrand"), order);
    expect(email.to).toEqual([{ email: "client@exemple.fr" }]);
    expect(email.subject).toBe("Commande n° 12 confirmée · Maison Ferrand");
    const text = doc(email.html).body.textContent!;
    for (const s of [
      "commande n° 12 est confirmée",
      "2 × Miel de châtaignier",
      "25,00\u00a0€",
      "Total payé",
      "58,20\u00a0€",
      "dont TVA 5,5\u00a0%",
      "1,89\u00a0€",
      "dont TVA 20\u00a0%",
      "3,67\u00a0€",
      "mardi 6 octobre, entre 16:00 et 19:00",
      "12 rue des Halles, 34000 Montpellier",
    ]) {
      expect(text, s).toContain(s);
    }
    // TVA du plus petit taux au plus grand, même si la base les range autrement.
    expect(text.indexOf("TVA 5,5")).toBeLessThan(text.indexOf("TVA 20"));
    expect(doc(email.html).querySelector('a[href^="https://www.google.com/maps"]')!.textContent).toBe("Voir le plan");
  });

  it("T6.2 charte Noir & Sel : bandeau et boutons aux couleurs de la boutique, contrastes AA", () => {
    const shop = shopFor("noir-et-sel");
    expect(shop.palette.brand).toBe("#121110");
    expect(shop.palette.onBrand).toBe("#F2F0ED");
    const html = merchantNewOrderEmail(shop, order, "commandes@noiretsel.fr").html;
    expect(html).toContain("background-color:#121110");
    expect(html).toContain("color:#F2F0ED");
    // L'accent de Noir & Sel (#DA6B70) n'est pas lisible sur blanc : les liens prennent la couleur de marque.
    expect(shop.palette.link).toBe("#121110");
    for (const ex of ["maison-ferrand", "noir-et-sel", "comptoir-saint-roch"]) {
      const p = shopFor(ex).palette;
      expect(contrast(p.ink, p.card), ex).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrast(p.muted, p.card), ex).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrast(p.onBrand, p.brand), ex).toBeGreaterThanOrEqual(MIN_CONTRAST);
      expect(contrast(p.link, p.card), ex).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it("T6.7 version texte brut générée : même contenu, liens explicités, sans balises ni aperçu caché", () => {
    const { text } = orderConfirmationEmail(shopFor("maison-ferrand"), order);
    expect(text).not.toMatch(/<[a-z]/i);
    expect(text).toContain("Merci, votre commande n° 12 est confirmée");
    expect(text).toContain("Retrait\nmardi 6 octobre, entre 16:00 et 19:00");
    expect(text).toContain(
      "Voir le plan (https://www.google.com/maps/search/?api=1&query=12%20rue%20des%20Halles%2034000%20Montpellier)",
    );
    expect(text).toContain("2 × Miel de châtaignier · Pot 250 g");
    expect(text).toMatch(/Total payé\s+58,20\u00a0€/);
    expect(text).not.toContain("Commande n° 12 confirmée : retrait"); // texte d'aperçu, invisible dans l'email
  });

  it("lisible images bloquées : aucune image, le nom de la boutique est du texte", () => {
    for (const email of [
      orderConfirmationEmail(shopFor("maison-ferrand"), order),
      orderReadyEmail(shopFor("maison-ferrand"), order),
    ]) {
      expect(doc(email.html).querySelectorAll("img")).toHaveLength(0);
      expect(email.html).toContain("Maison Ferrand");
      expect(email.html).toContain('lang="fr"');
    }
  });

  it("nouvelle commande, commande prête, réinitialisation et contact : destinataires et contenus", () => {
    const shop = shopFor("maison-ferrand");
    const merchant = merchantNewOrderEmail(shop, order, "commandes@maison-ferrand.fr");
    expect(merchant.to).toEqual([{ email: "commandes@maison-ferrand.fr" }]);
    expect(merchant.replyTo).toEqual({ email: "client@exemple.fr" });
    expect(
      doc(merchant.html).querySelector("a[href$='/admin/commandes/a0000000-0000-0000-0000-000000000012']")!.textContent,
    ).toBe("Voir la commande");
    expect(merchant.text).toContain("client@exemple.fr · 06 12 34 56 78");
    const ready = orderReadyEmail(shop, order);
    expect(ready.subject).toBe("Votre commande n° 12 est prête · Maison Ferrand");
    expect(ready.text).toContain("Samedi : 09:00–19:00");
    const reset = passwordResetEmail(
      shop,
      "commandes@maison-ferrand.fr",
      "https://maison-ferrand.fr/admin/reinitialiser?t=abc",
    );
    expect(reset.text).toContain("valable une heure");
    expect(reset.text).toContain("(https://maison-ferrand.fr/admin/reinitialiser?t=abc)");
    const contact = contactMessageEmail(
      shop,
      "bonjour@maison-ferrand.fr",
      { name: "Léa <script>", email: "lea@exemple.fr" },
      "Bonjour,\n\nAvez-vous du comté ?",
    );
    expect(contact.replyTo).toEqual({ email: "lea@exemple.fr", name: "Léa <script>" });
    expect(contact.html).not.toContain("<script>");
    expect(contact.text).toContain("Avez-vous du comté ?");
  });
});

describe("rendu statique", () => {
  it("produit exactement le HTML de react-dom/server pour chaque gabarit", async () => {
    const { renderStaticMarkup } = await import("../src/static-markup.ts");
    const { ContactMessage, MerchantNewOrder, OrderConfirmation, OrderReady, PasswordReset } =
      await import("../src/templates/emails.tsx");
    for (const ex of ["maison-ferrand", "noir-et-sel"]) {
      const shop = shopFor(ex);
      for (const element of [
        createElement(OrderConfirmation, { shop, order }),
        createElement(MerchantNewOrder, { shop, order, adminUrl: "https://x.fr/admin?a=1&b=2" }),
        createElement(OrderReady, { shop, order }),
        createElement(PasswordReset, { shop, resetUrl: "https://x.fr/r?t=<a>" }),
        createElement(ContactMessage, {
          shop,
          from: { name: 'Léa "L" <x>', email: "l@x.fr" },
          message: "A & B\n\nC <script>",
        }),
      ]) {
        expect(renderStaticMarkup(element)).toBe(renderToStaticMarkup(element));
      }
    }
  });
});

describe("client Brevo", () => {
  it("envoie l'email par l'API transactionnelle, avec la clé et l'expéditeur de la boutique", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ messageId: "<abc@smtp-relay.brevo.com>" }), { status: 201 }),
    );
    const mailer = new BrevoMailer({
      apiKey: "xkeysib-test",
      sender: { email: "bonjour@maison-ferrand.fr", name: "Maison Ferrand" },
      fetch: fetchImpl as unknown as typeof fetch,
    });
    const email = orderConfirmationEmail(shopFor("maison-ferrand"), order);
    expect(await mailer.send(email)).toEqual({ messageId: "<abc@smtp-relay.brevo.com>" });
    const [url, init] = fetchImpl.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("xkeysib-test");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      sender: { email: "bonjour@maison-ferrand.fr" },
      to: [{ email: "client@exemple.fr" }],
      tags: ["order_confirmation"],
    });
    expect(body.htmlContent).toBe(email.html);
    expect(body.textContent).toBe(email.text);
  });

  it("une réponse en erreur lève une MailError avec le statut", async () => {
    const mailer = new BrevoMailer({
      apiKey: "k",
      sender: { email: "a@b.fr", name: "A" },
      fetch: (async () =>
        new Response(JSON.stringify({ message: "panne" }), { status: 500 })) as unknown as typeof fetch,
    });
    await expect(mailer.send(orderReadyEmail(shopFor("maison-ferrand"), order))).rejects.toMatchObject({ status: 500 });
  });
});

describe("file d'envoi", () => {
  /** Une file en mémoire qui enregistre chaque écriture. */
  function harness(rows: OutboxRow[], send: OutboxDeps["send"]) {
    const log: string[] = [];
    const deps: OutboxDeps = {
      claim: async () => rows,
      compose: async () => orderConfirmationEmail(shopFor("maison-ferrand"), order),
      send,
      markSent: async (row) => void log.push(`sent ${row.id}`),
      markRetry: async (row, attempts, next) =>
        void log.push(`retry ${row.id} attempts=${attempts} next=${next.toISOString()}`),
      markFailed: async (row, attempts) => void log.push(`failed ${row.id} attempts=${attempts}`),
      logEvent: async (e) => void log.push(`event ${e.kind} ${e.status} ${e.messageId ?? "-"}`),
      alert: vi.fn(async () => {}),
      now: () => NOW,
    };
    return { deps, log };
  }
  const row = (attempts: number): OutboxRow => ({
    id: 7,
    kind: "order_confirmation",
    payload: { order_id: order.id },
    attempts,
  });

  it("T6.6 envoi réussi : marqué envoyé, ligne email_events avec provider_message_id", async () => {
    const mailer = new FakeMailer();
    const { deps, log } = harness([row(0)], (e) => mailer.send(e));
    expect(await processOutbox(deps)).toEqual({ sent: 1, retried: 0, failed: 0 });
    expect(log).toEqual(["sent 7", `event order_confirmation sent ${mailer.sent[0]!.messageId}`]);
  });

  it("T6.3 Brevo répond 500 : attempts + 1, next_attempt_at repoussé de 5 minutes", async () => {
    const { deps, log } = harness([row(1)], async () => Promise.reject(new Error("Brevo a répondu 500")));
    expect(await processOutbox(deps)).toEqual({ sent: 0, retried: 1, failed: 0 });
    expect(log).toEqual(["retry 7 attempts=2 next=2026-10-02T08:05:00.000Z"]);
    expect(deps.alert).not.toHaveBeenCalled();
  });

  it("T6.4 5e échec : statut échoué, journalisé, alerte émise", async () => {
    const { deps, log } = harness([row(MAX_ATTEMPTS - 1)], async () =>
      Promise.reject(new Error("Brevo a répondu 500")),
    );
    expect(await processOutbox(deps)).toEqual({ sent: 0, retried: 0, failed: 1 });
    expect(log).toEqual(["failed 7 attempts=5", "event order_confirmation failed -"]);
    expect(deps.alert).toHaveBeenCalledWith("Email abandonné après 5 essais", expect.objectContaining({ outboxId: 7 }));
  });

  it("un échec n'empêche pas d'envoyer les emails suivants", async () => {
    let calls = 0;
    const { deps } = harness([row(0), { ...row(0), id: 8 }], async () => {
      if (++calls === 1) throw new Error("panne");
      return { messageId: "m2" };
    });
    expect(await processOutbox(deps)).toEqual({ sent: 1, retried: 1, failed: 0 });
  });
});
