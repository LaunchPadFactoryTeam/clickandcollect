import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { PickupConfig } from "@launchpadfactoryteam/commerce";
import { readFileSync } from "node:fs";

/** Configuration et contenus figés du site construit : les tests suivent l'exemple testé (A, B ou C). */
const json = (file: string) => JSON.parse(readFileSync(new URL(`../generated/${file}`, import.meta.url), "utf8"));

export const content = json("content.json") as {
  pages: { home: { title: string }; settings: { marketingConsentText: string } };
  catalog: {
    id: string;
    slug: string;
    name: string;
    available: boolean;
    isAlcohol: boolean;
    priceTtcCents: number;
    category: { slug: string; name: string };
    inco: { netQuantity: string };
  }[];
};

export const site = json("site.json") as {
  boutique: { nom: string; domaine: string };
  design: { variantes: { accueil: string } };
  features: { alcool: boolean };
  retrait: PickupConfig;
};

export async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.nodes.length}) : ${v.nodes[0]?.html}`);
}
