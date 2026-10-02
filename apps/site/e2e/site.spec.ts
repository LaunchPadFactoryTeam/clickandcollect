import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const json = (file: string) => JSON.parse(readFileSync(new URL(`../generated/${file}`, import.meta.url), "utf8"));
const content = json("content.json") as {
  pages: { home: { title: string } };
  catalog: {
    slug: string;
    name: string;
    available: boolean;
    isAlcohol: boolean;
    category: { slug: string; name: string };
    inco: { netQuantity: string };
  }[];
};
const site = json("site.json") as {
  boutique: { nom: string; domaine: string };
  design: { variantes: { accueil: string } };
};

const product = content.catalog.find((p) => p.available && !p.isAlcohol)!;
const offProduct = content.catalog.find((p) => !p.available);
const category = product.category.slug;
const PAGES = ["/", "/boutique", `/boutique/${category}`, `/produits/${product.slug}`, "/epicerie", "/contact"];

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.nodes.length}) : ${v.nodes[0]?.html}`);
}

for (const path of PAGES) {
  test(`${path} : aucune violation d'accessibilité sérieuse ou critique (axe)`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    expect(await seriousViolations(page)).toEqual([]);
  });
}

test("l'accueil affiche le titre des contenus, dans la variante configurée", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(content.pages.home.title);
  await expect(page.locator(".site")).toHaveAttribute("data-variant", site.design.variantes.accueil);
  await expect(page).toHaveTitle(new RegExp(site.boutique.nom));
});

test("le lien d'évitement mène au contenu principal", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Aller au contenu" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page.locator("main#contenu")).toBeFocused();
});

test("le filtre de catégorie est un lien vers une page statique de la catégorie", async ({ page }) => {
  await page.goto("/boutique");
  await page.getByRole("navigation", { name: "Filtrer par catégorie" }).getByRole("link", { name: product.category.name }).click();
  await expect(page).toHaveURL(new RegExp(`/boutique/${category}$`));
  const names = await page.locator(".card__name").allTextContents();
  const expected = content.catalog.filter((p) => p.category.slug === category).map((p) => p.name);
  expect(names).toEqual(expected);
});

test("la fiche produit porte le JSON-LD Product et le bloc INCO", async ({ page }) => {
  await page.goto(`/produits/${product.slug}`);
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const types = blocks.map((b) => JSON.parse(b)["@type"]);
  expect(types).toEqual(expect.arrayContaining(["GroceryStore", "Product"]));
  const ld = blocks.map((b) => JSON.parse(b)).find((b) => b["@type"] === "Product");
  expect(ld.offers.priceCurrency).toBe("EUR");
  await expect(page.getByRole("heading", { name: "Informations réglementaires" })).toBeVisible();
  await expect(page.getByText(product.inco.netQuantity, { exact: true })).toBeVisible();
});

test("un produit indisponible reste affiché, avec un bouton désactivé", async ({ page }) => {
  test.skip(!offProduct, "aucun produit indisponible dans ce jeu de données");
  await page.goto(`/produits/${offProduct!.slug}`);
  await expect(page.getByRole("button", { name: `${offProduct!.name} indisponible` })).toBeDisabled();
});

test("une fiche inconnue répond 404", async ({ page }) => {
  const res = await page.goto("/produits/n-existe-pas");
  expect(res?.status()).toBe(404);
});

test("robots.txt, llms.txt et sitemap.xml sont publiés", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain(`Sitemap: https://${site.boutique.domaine}/sitemap.xml`);
  const llms = await request.get("/llms.txt");
  expect(llms.status()).toBe(200);
  expect(await llms.text()).toContain(`# ${site.boutique.nom}`);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`/produits/${product.slug}</loc>`);
});

test("la revalidation refuse un appel sans secret", async ({ request }) => {
  expect((await request.post("/api/revalidate")).status()).toBe(401);
});

test("aucun cookie n'est déposé sur les pages vitrine", async ({ page, context }) => {
  for (const path of PAGES) await page.goto(path);
  expect(await context.cookies()).toEqual([]);
});
