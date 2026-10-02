// Captures de référence pour la revue visuelle (non bloquante) : 5 pages, mobile 390 px et bureau 1280 px.
// Usage : node scripts/captures.mjs <url-du-site> <dossier-de-sortie>
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [, , base = "http://localhost:3100", out = "captures"] = process.argv;
const content = JSON.parse(readFileSync(new URL("../generated/content.json", import.meta.url), "utf8"));
const site = JSON.parse(readFileSync(new URL("../generated/site.json", import.meta.url), "utf8"));
const product = content.catalog.find((p) => p.isAlcohol) ?? content.catalog[0];
const pages = {
  accueil: "/",
  boutique: "/boutique",
  fiche: `/produits/${product.slug}`,
  epicerie: "/epicerie",
  contact: "/contact",
};

mkdirSync(out, { recursive: true });
const browser = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
for (const width of [390, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  for (const [name, path] of Object.entries(pages)) {
    await page.goto(`${base}${path}`, { waitUntil: "networkidle" });
    const variant = site.design.variantes[name === "fiche" ? "fiche_produit" : name];
    await page.screenshot({
      path: join(out, `${site.boutique.domaine}-${name}-${variant}-${width}.png`),
      fullPage: true,
    });
  }
  await page.close();
}
await browser.close();
console.log(`Captures écrites dans ${out}`);
