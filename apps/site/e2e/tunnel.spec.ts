import { expect, test, type Page } from "@playwright/test";
import { computeSlots } from "@launchpadfactoryteam/commerce";
import { content, seriousViolations, site } from "./helpers";

/**
 * Tunnel complet avec le faux fournisseur de paiement et la base Supabase locale (E2E_TUNNEL=1) :
 * .dev.vars écrit par tools/scripts/dev-vars.mjs, base démarrée par `supabase start`.
 */
test.skip(!process.env.E2E_TUNNEL, "tunnel de paiement : E2E_TUNNEL=1, Supabase local et LP_PSP=fake requis");

const KEY = `lp:panier:${site.boutique.domaine}`;
const sellable = content.catalog.filter((p) => p.available);
const first = sellable.find((p) => !p.isAlcohol)!;
const wine = sellable.find((p) => p.isAlcohol);
const off = content.catalog.find((p) => !p.available);

async function fillCart(page: Page, cart: { productId: string; quantity: number }[]) {
  await page.goto("/");
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [KEY, JSON.stringify(cart)]);
}

/** Étape 1 : choisit le premier créneau, coche ce qui est demandé, passe au paiement. */
async function toPayment(page: Page, { marketing = false } = {}) {
  await page.goto("/panier");
  const age = page.getByRole("checkbox", { name: /18 ans ou plus/ });
  if (await age.count()) await age.check();
  if (marketing) await page.getByRole("checkbox", { name: content.pages.settings.marketingConsentText }).check();
  await page.getByRole("button", { name: "Passer au paiement" }).click();
  await expect(page).toHaveURL(/\/paiement$/);
}

async function pay(page: Page, email: string) {
  await page.getByLabel("Nom sur la carte").fill("Camille Besson");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("checkbox", { name: /conditions générales/ }).check();
  await page.getByRole("button", { name: /^Payer/ }).click();
  await expect(page).toHaveURL(/\/confirmation\?session_id=cs_fake_/);
}

test("paiement : la commande « nouvelle » est créée avec le bon créneau, le panier est vidé", async ({ page }) => {
  await fillCart(page, [{ productId: first.id, quantity: 2 }, ...(wine ? [{ productId: wine.id, quantity: 1 }] : [])]);
  await toPayment(page, { marketing: true });
  const slot = (await page.locator(".cart__chosen").textContent())!.replace("Retrait : ", "");
  expect(await seriousViolations(page)).toEqual([]);
  await pay(page, "client.e2e@exemple.fr");
  await expect(page.getByText(/Votre commande n° \d+ est confirmée/)).toBeVisible();
  expect(slot).toMatch(/\d\d:\d\d – \d\d:\d\d$/);
  await expect(page.locator(".confirm__facts")).toContainText(
    slot.split(" · ")[1]!.replace(" – ", " et ").split(" et ")[0]!,
  );
  await expect(page.locator(".hdr__cart")).toHaveText(/Panier.*0/);
  expect(await seriousViolations(page)).toEqual([]);
});

test("le même événement de paiement reçu deux fois ne crée qu'une commande", async ({ page, request }) => {
  await fillCart(page, [{ productId: first.id, quantity: 1 }]);
  await toPayment(page);
  const created = await page.waitForResponse((r) => r.url().endsWith("/api/checkout"));
  const { sessionId } = await created.json();
  const once = await request.post("/api/paiement-test", { data: { sessionId, email: "rejeu@exemple.fr" } });
  const twice = await request.post("/api/paiement-test", { data: { sessionId, email: "rejeu@exemple.fr" } });
  expect((await once.json()).status).toBe("created");
  expect((await twice.json()).status).toBe("duplicate");
  // Onglet fermé juste après le paiement : la commande existe quand même.
  const order = await request.get(`/api/commande?session_id=${sessionId}`);
  expect((await order.json()).status).toBe("paid");
});

test("un produit coupé entre l'ajout et le paiement est signalé avant le formulaire", async ({ page }) => {
  test.skip(!off, "aucun produit indisponible dans cet exemple");
  await fillCart(page, [{ productId: first.id, quantity: 1 }]);
  await page.goto("/panier");
  await page.getByRole("button", { name: "Passer au paiement" }).click();
  await expect(page).toHaveURL(/\/paiement$/);
  // Le produit est coupé après le passage à l'étape 2 : le serveur le refuse.
  await page.evaluate(
    ([k, id]) => localStorage.setItem(k!, JSON.stringify([{ productId: id, quantity: 1 }])),
    [KEY, off!.id],
  );
  await page.reload();
  // (Next.js annonce aussi les changements de page dans une région role=alert : on cible le bloc d'erreur.)
  const error = page.locator(".pay__error");
  await expect(error).toContainText("n'est plus disponible");
  await expect(error).toContainText(off!.name);
  await expect(page.getByLabel("Email")).toHaveCount(0);
});

test("alcool sans déclaration de majorité : le serveur refuse la session", async ({ request }) => {
  test.skip(!site.features.alcool || !wine, "option alcool inactive dans cet exemple");
  const slotId = computeSlots(site.retrait, new Date())[0]!.id;
  const res = await request.post("/api/checkout", {
    data: { cart: [{ productId: wine!.id, quantity: 1 }], slotId, ageDeclared: false },
  });
  expect(res.status()).toBe(409);
  expect((await res.json()).code).toBe("AGE_REQUIRED");
});

test("webhook à la signature invalide : 400, aucune commande", async ({ request }) => {
  const res = await request.post("/api/webhooks/stripe", {
    data: '{"id":"evt_x","type":"checkout.session.completed"}',
    headers: { "stripe-signature": "t=1,v1=00", "content-type": "application/json" },
  });
  expect(res.status()).toBe(400);
});
