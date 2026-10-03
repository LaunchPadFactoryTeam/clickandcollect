import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import { content, site } from "./helpers";

/**
 * Emails transactionnels, avec la base Supabase locale, le faux fournisseur de paiement et le faux prestataire
 * d'emails (E2E_TUNNEL=1, .dev.vars de tools/scripts/dev-vars.mjs).
 */
test.skip(!process.env.E2E_TUNNEL, "emails : E2E_TUNNEL=1, Supabase local, LP_PSP=fake et LP_EMAIL=fake requis");

const DB_URL = process.env.E2E_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const CRON_SECRET = "secret-local-de-la-tache-planifiee-des-emails";
const KEY = `lp:panier:${site.boutique.domaine}`;
const first = content.catalog.find((p) => p.available && !p.isAlcohol)!;

async function sql<T extends pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, values)).rows;
  } finally {
    await client.end();
  }
}

/** Paie une commande de bout en bout et renvoie son identifiant de session. */
async function payOrder(page: Page): Promise<string> {
  await page.goto("/");
  await page.evaluate(
    ([k, v]) => localStorage.setItem(k!, v!),
    [KEY, JSON.stringify([{ productId: first.id, quantity: 1 }])],
  );
  await page.goto("/panier");
  await page.getByRole("button", { name: "Passer au paiement" }).click();
  await page.getByLabel("Email").fill("emails.e2e@exemple.fr");
  await page.getByRole("checkbox", { name: /conditions générales/ }).check();
  await page.getByRole("button", { name: /^Payer/ }).click();
  await expect(page.getByText(/est confirmée/)).toBeVisible();
  return new URL(page.url()).searchParams.get("session_id")!;
}

const emailsOf = (sessionId: string) =>
  sql<{ kind: string; status: string; provider_message_id: string | null }>(
    `select e.kind, e.status, e.provider_message_id from email_events e join orders o on o.id = e.order_id
     where o.stripe_session_id = $1 order by e.kind`,
    [sessionId],
  );

test("une commande payée produit l'email client et l'email commerçant en moins d'une minute", async ({ page }) => {
  const sessionId = await payOrder(page);
  await expect
    .poll(async () => (await emailsOf(sessionId)).map((e) => `${e.kind}:${e.status}`), { timeout: 60_000 })
    .toEqual(["merchant_new_order:sent", "order_confirmation:sent"]);
  const events = await emailsOf(sessionId);
  expect(events.every((e) => e.provider_message_id?.startsWith("<fake-"))).toBe(true);
  const outbox = await sql<{ pending: number }>(
    `select count(*)::int as pending from email_outbox x join orders o on o.id = (x.payload ->> 'order_id')::uuid
     where o.stripe_session_id = $1 and x.sent_at is null`,
    [sessionId],
  );
  expect(outbox[0]!.pending).toBe(0);
});

test("« commande prête » : un seul email, même après un retour arrière puis un nouveau passage", async ({
  page,
  request,
}) => {
  const sessionId = await payOrder(page);
  for (const status of ["ready", "preparing", "ready"]) {
    await sql("update orders set status = $1 where stripe_session_id = $2", [status, sessionId]);
  }
  const res = await request.post("/api/emails/outbox", { headers: { "x-lp-cron-secret": CRON_SECRET } });
  expect(res.ok()).toBe(true);
  await expect
    .poll(async () => (await emailsOf(sessionId)).filter((e) => e.kind === "order_ready").length, { timeout: 30_000 })
    .toBe(1);
  await request.post("/api/emails/outbox", { headers: { "x-lp-cron-secret": CRON_SECRET } });
  expect((await emailsOf(sessionId)).filter((e) => e.kind === "order_ready")).toHaveLength(1);
});

test("rejeu de la file : refusé sans le secret de la tâche planifiée", async ({ request }) => {
  expect((await request.post("/api/emails/outbox")).status()).toBe(401);
  expect((await request.post("/api/emails/outbox", { headers: { "x-lp-cron-secret": "mauvais" } })).status()).toBe(401);
});

test("formulaire de contact : message envoyé au commerçant, page de remerciement", async ({ page }) => {
  await page.goto("/contact");
  await page.locator("form.contact-form input[name=nom]").fill("Léa Martin");
  await page.locator("form.contact-form input[name=email]").fill("lea.e2e@exemple.fr");
  await page.locator("form.contact-form textarea[name=message]").fill("Avez-vous du comté affiné 24 mois ?");
  await page.locator("form.contact-form input[name=consentement]").check();
  await page.locator("form.contact-form button[type=submit]").click();
  await expect(page).toHaveURL(/\/contact\/merci$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Message envoyé");
  const logged = await sql<{ n: number }>(
    "select count(*)::int as n from email_events where kind = 'contact_message' and created_at > now() - interval '1 minute'",
  );
  expect(logged[0]!.n).toBeGreaterThan(0);
});
