import { expect, test, type Page } from "@playwright/test";
import { content, seriousViolations, site } from "./helpers";

const KEY = `lp:panier:${site.boutique.domaine}`;
const sellable = content.catalog.filter((p) => p.available);
const first = sellable.find((p) => !p.isAlcohol)!;
const second = sellable.find((p) => !p.isAlcohol && p.id !== first.id)!;
const wine = sellable.find((p) => p.isAlcohol);
const off = content.catalog.find((p) => !p.available);
const euros = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")}\u00a0€`;

async function seedCart(page: Page, cart: { productId: string; quantity: number }[]) {
  await page.addInitScript(
    ([key, value]) => {
      if (!sessionStorage.getItem("seeded")) {
        localStorage.setItem(key!, value!);
        sessionStorage.setItem("seeded", "1");
      }
    },
    [KEY, JSON.stringify(cart)],
  );
}

const cartLink = (page: Page) => page.locator(".hdr__cart");

test("ajouter depuis une carte : le compteur suit, une seule ligne par produit", async ({ page }) => {
  await page.goto("/boutique");
  await expect(cartLink(page)).toHaveText(/Panier.*0/);
  const add = page.locator(`[data-add-to-cart="${first.id}"]`);
  await add.click();
  await add.click();
  await expect(cartLink(page)).toHaveText(/Panier.*2/);
  await expect(page.getByRole("status").filter({ hasText: "ajouté au panier" })).toHaveText(
    `${first.name} ajouté au panier.`,
  );
  expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY))!)).toEqual([
    { productId: first.id, quantity: 2 },
  ]);
});

test("le panier survit à un rechargement et reste propre à chaque boutique", async ({ page }) => {
  await page.goto(`/produits/${first.slug}`);
  await page.locator(`[data-add-to-cart="${first.id}"]`).click();
  await page.evaluate(() => localStorage.setItem("lp:panier:autre-boutique.fr", '[{"productId":"x","quantity":5}]'));
  await page.reload();
  await expect(cartLink(page)).toHaveText(/Panier.*1/);
  await page.goto("/panier");
  await expect(page.locator(".cart__line")).toHaveCount(1);
});

test("un produit indisponible ne peut pas être ajouté, ni depuis la carte ni depuis la fiche", async ({ page }) => {
  test.skip(!off, "aucun produit indisponible dans cet exemple");
  await page.goto("/boutique");
  await expect(page.locator(`[data-add-to-cart="${off!.id}"]`)).toBeDisabled();
  await page.goto(`/produits/${off!.slug}`);
  const button = page.locator(`[data-add-to-cart="${off!.id}"]`);
  await expect(button).toBeDisabled();
  await expect(button).toHaveText("Indisponible");
});

test("panier vide : un message et un lien vers les produits", async ({ page }) => {
  await page.goto("/panier");
  await expect(page.getByText("Votre panier est vide.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Voir les produits" })).toHaveAttribute("href", "/boutique");
});

test("récapitulatif : sous-total, TVA par taux, total", async ({ page }) => {
  await seedCart(page, [
    { productId: first.id, quantity: 2 },
    { productId: second.id, quantity: 1 },
  ]);
  await page.goto("/panier");
  const total = first.priceTtcCents * 2 + second.priceTtcCents;
  await expect(page.locator(".cart__grand .price")).toHaveText(euros(total));
  await expect(page.locator(".cart__amounts dt", { hasText: "Dont TVA" }).first()).toBeVisible();
});

test("le panier et le créneau se pilotent entièrement au clavier", async ({ page }) => {
  await seedCart(page, [{ productId: first.id, quantity: 1 }]);
  await page.goto("/panier");
  const plus = page.getByRole("button", { name: `Ajouter une unité de ${first.name}` });
  await plus.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await expect(page.locator(".cart__count")).toHaveText("3");

  const group = page.getByRole("group", { name: /Créneau de retrait|Quand passez-vous/ });
  const radios = group.getByRole("radio");
  await expect(radios.first()).toBeChecked();
  await radios.first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(radios.nth(1)).toBeChecked();
  const label = await page.locator(".cart__slot").nth(1).locator(".cart__slot-label").textContent();
  await expect(page.locator(".cart__chosen")).toHaveText(`Créneau retenu : ${label}`);
});

test("case de majorité : due dès qu'une boisson alcoolisée est au panier, sinon le paiement est bloqué", async ({
  page,
}) => {
  test.skip(!site.features.alcool || !wine, "option alcool inactive dans cet exemple");
  await seedCart(page, [{ productId: wine!.id, quantity: 1 }]);
  await page.goto("/panier");
  const age = page.getByRole("checkbox", { name: /18 ans ou plus/ });
  await expect(age).not.toBeChecked();
  await page.getByRole("button", { name: "Passer au paiement" }).click();
  expect(await age.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
  await expect(page).toHaveURL(/\/panier$/);
  await age.check();
  await page.getByRole("button", { name: "Passer au paiement" }).click();
  await expect(page).toHaveURL(/\/paiement$/);
});

test("étape 2 sans paiement configuré : message clair et retour au panier", async ({ page }) => {
  test.skip(!!process.env.E2E_TUNNEL, "paiement configuré dans ce mode");
  await seedCart(page, [{ productId: first.id, quantity: 1 }]);
  await page.goto("/panier");
  await page.getByRole("button", { name: "Passer au paiement" }).click();
  await expect(page.locator(".pay__error")).toContainText("Le paiement en ligne n'est pas encore ouvert");
  await expect(page.getByRole("link", { name: "Revenir au panier" })).toHaveAttribute("href", "/panier");
});

test("case marketing : facultative, décochée, avec le texte versionné de la boutique", async ({ page }) => {
  await seedCart(page, [{ productId: first.id, quantity: 1 }]);
  await page.goto("/panier");
  const marketing = page.getByRole("checkbox", { name: content.pages.settings.marketingConsentText });
  await expect(marketing).not.toBeChecked();
  expect(await marketing.evaluate((el: HTMLInputElement) => el.required)).toBe(false);
});

test("/panier : aucune violation d'accessibilité sérieuse ou critique (axe)", async ({ page }) => {
  await seedCart(page, [
    { productId: first.id, quantity: 1 },
    ...(wine ? [{ productId: wine.id, quantity: 1 }] : []),
    ...(off ? [{ productId: off.id, quantity: 1 }] : []),
  ]);
  await page.goto("/panier");
  await expect(page.locator(".cart__line").first()).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test("l'ajout au panier répond en moins de 200 ms (INP) sur un processeur ralenti ×4", async ({ page }) => {
  await page.goto("/boutique");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => {
    const w = window as unknown as { __durations: number[] };
    w.__durations = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__durations.push(entry.duration);
    }).observe({ type: "event", durationThreshold: 16, buffered: true } as PerformanceObserverInit);
  });
  const add = page.locator(`[data-add-to-cart="${first.id}"]`);
  for (let i = 0; i < 3; i++) await add.click();
  await expect(cartLink(page)).toHaveText(/Panier.*3/);
  await page.waitForTimeout(300);
  const durations = await page.evaluate(() => (window as unknown as { __durations: number[] }).__durations);
  test.info().annotations.push({
    type: "INP",
    description: `${durations.length} évènements ≥ 16 ms : ${durations.join(", ")} ms`,
  });
  expect(Math.max(0, ...durations)).toBeLessThanOrEqual(200);
});
