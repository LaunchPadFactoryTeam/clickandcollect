import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";
import { payOrder, sql } from "./db";

/** Données personnelles avec la base Supabase locale (E2E_TUNNEL=1, .dev.vars de tools/scripts/dev-vars.mjs). */
test.skip(!process.env.E2E_TUNNEL, "RGPD : E2E_TUNNEL=1 et Supabase local requis");

const CRON_SECRET = "secret-local-de-la-tache-planifiee-des-emails";
const HASH_KEY = "cle-de-hachage-locale-de-la-boutique-de-demo";

test("empreinte client : HMAC de l'email normalisé avec la clé de la boutique", async ({ page }) => {
  const sessionId = await payOrder(page, { name: "Paul Martin", email: "  Paul.Martin.E2E@Exemple.FR" });
  const [order] = await sql<{ email: string; customer_hash: string }>(
    "select email, customer_hash from orders where stripe_session_id = $1",
    [sessionId],
  );
  expect(order!.customer_hash).toBe(createHmac("sha256", HASH_KEY).update("paul.martin.e2e@exemple.fr").digest("hex"));
});

test("tâche mensuelle de conservation : protégée par le secret, rapport des lignes traitées", async ({ request }) => {
  expect((await request.post("/api/rgpd/conservation")).status()).toBe(401);
  const res = await request.post("/api/rgpd/conservation", { headers: { "x-lp-cron-secret": CRON_SECRET } });
  expect(res.status()).toBe(200);
  expect(Object.keys(await res.json()).sort()).toEqual([
    "anonymized_orders",
    "archived_consents",
    "deleted_consents",
    "deleted_orders",
  ]);
});
