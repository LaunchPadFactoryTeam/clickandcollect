import { expect, test } from "@playwright/test";

test("l'accueil affiche la boutique de la configuration avec son thème", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Maison Ferrand");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Maison Ferrand");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe("rgb(250, 248, 244)"); // --c-bg #FAF8F4
});

test("la page de contrôle du thème est publiée", async ({ page }) => {
  const response = await page.goto("/theme/preview.html");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Contrôles de contraste" })).toBeVisible();
});

test("aucun cookie n'est déposé sur l'accueil", async ({ page, context }) => {
  await page.goto("/");
  expect(await context.cookies()).toEqual([]);
});
