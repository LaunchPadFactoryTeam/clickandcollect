import { expect, type Page } from "@playwright/test";
import pg from "pg";
import { content, site } from "./helpers";

/** Base Supabase locale et paiement factice, pour les tests E2E_TUNNEL=1. */
export const DB_URL = process.env.E2E_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export async function sql<T extends pg.QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return (await client.query<T>(text, values)).rows;
  } finally {
    await client.end();
  }
}

const KEY = `lp:panier:${site.boutique.domaine}`;

/** Paie une commande de bout en bout (faux fournisseur) et renvoie son identifiant de session. */
export async function payOrder(page: Page, customer = { name: "Camille Besson", email: "emails.e2e@exemple.fr" }) {
  const first = content.catalog.find((p) => p.available && !p.isAlcohol)!;
  await page.goto("/");
  await page.evaluate(
    ([k, v]) => localStorage.setItem(k!, v!),
    [KEY, JSON.stringify([{ productId: first.id, quantity: 1 }])],
  );
  await page.goto("/panier");
  await page.getByRole("button", { name: "Passer au paiement" }).click();
  await page.getByLabel("Nom sur la carte").fill(customer.name);
  await page.getByLabel("Email").fill(customer.email);
  await page.getByRole("checkbox", { name: /conditions générales/ }).check();
  await page.getByRole("button", { name: /^Payer/ }).click();
  await expect(page.getByText(/est confirmée/)).toBeVisible();
  return new URL(page.url()).searchParams.get("session_id")!;
}
