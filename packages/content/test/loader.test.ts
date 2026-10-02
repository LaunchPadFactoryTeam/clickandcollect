import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSnapshot,
  CATALOG_QUERY,
  ContentError,
  fetchSanityContent,
  formatDays,
  formatOpeningHours,
  loadLocalContent,
  SITE_CONTENT_QUERY,
  type Product,
} from "../src/index.ts";

const EXAMPLES = join(__dirname, "../../../examples");
const pages = () => JSON.parse(readFileSync(join(EXAMPLES, "maison-ferrand/content/pages.json"), "utf8"));
const products = () =>
  JSON.parse(readFileSync(join(EXAMPLES, "maison-ferrand/content/catalogue.json"), "utf8")) as Product[];

describe("contenus locaux", () => {
  it("les trois exemples se chargent, avec la terrine indisponible", () => {
    for (const site of ["maison-ferrand", "noir-et-sel", "comptoir-saint-roch"]) {
      const snap = loadLocalContent(join(EXAMPLES, site));
      expect(snap.catalog, site).toHaveLength(8);
      expect(snap.catalog.find((p) => p.id === "terrine")!.available).toBe(false);
    }
  });

  it("refuse des contenus éditoriaux incomplets en nommant le champ", () => {
    const p = pages();
    delete p.home.title;
    expect(() => buildSnapshot(p, products(), [])).toThrow(/home\.title/);
  });

  it("refuse un produit mis en avant absent du catalogue publié", () => {
    const p = pages();
    p.home.featuredProductIds = ["miel", "inconnu"];
    expect(() => buildSnapshot(p, products(), [])).toThrow("absents du catalogue publié : inconnu");
  });

  it("refuse un identifiant de produit en double", () => {
    const list = products();
    list.push({ ...list[0]! });
    expect(() => buildSnapshot(pages(), list, [])).toThrow(ContentError);
  });

  it("écarte un produit non relu et l'explique dans le rapport", () => {
    const list = products().map((p) => (p.id === "huile" ? { ...p, reviewedAt: null } : p));
    const p = pages();
    p.home.featuredProductIds = ["miel"];
    const snap = buildSnapshot(p, list, []);
    expect(snap.catalog.map((c) => c.id)).not.toContain("huile");
    expect(snap.report.excluded[0]).toMatchObject({ id: "huile" });
  });

  it("signale un fichier manquant", () => {
    expect(() => loadLocalContent(join(EXAMPLES, "inexistant"))).toThrow("introuvable");
  });
});

describe("Sanity", () => {
  it("interroge l'API HTTP avec les deux requêtes et le jeton de lecture", async () => {
    const calls: { url: URL; auth?: string }[] = [];
    const fakeFetch = (async (url: URL, init?: RequestInit) => {
      calls.push({ url, auth: (init?.headers as Record<string, string>)?.Authorization });
      const query = url.searchParams.get("query");
      const result = query === SITE_CONTENT_QUERY ? pages() : products();
      return new Response(JSON.stringify({ result }), { status: 200 });
    }) as typeof fetch;
    const snap = await fetchSanityContent(
      { projectId: "abc123", dataset: "production", token: "tok" },
      [{ product_id: "miel", available: false }],
      fakeFetch,
    );
    expect(calls).toHaveLength(2);
    expect(calls[0]!.url.host).toBe("abc123.apicdn.sanity.io");
    expect(calls[0]!.url.pathname).toMatch(/\/data\/query\/production$/);
    expect(calls.map((c) => c.url.searchParams.get("query"))).toEqual([SITE_CONTENT_QUERY, CATALOG_QUERY]);
    expect(calls[0]!.auth).toBe("Bearer tok");
    expect(snap.catalog.find((p) => p.id === "miel")!.available).toBe(false);
  });

  it("signale une erreur de l'API", async () => {
    const fakeFetch = (async () => new Response("non", { status: 401 })) as unknown as typeof fetch;
    await expect(fetchSanityContent({ projectId: "abc", dataset: "production" }, [], fakeFetch)).rejects.toThrow(
      "Sanity a répondu 401",
    );
  });
});

describe("horaires", () => {
  it("regroupe les jours consécutifs", () => {
    expect(formatDays(["mardi", "mercredi", "jeudi", "vendredi"])).toBe("Mardi – vendredi");
    expect(formatDays(["samedi"])).toBe("Samedi");
    expect(formatDays(["lundi", "dimanche"])).toBe("Lundi, dimanche");
  });

  it("formate les horaires de la maquette A", () => {
    expect(formatOpeningHours(pages().settings.openingHours)).toEqual([
      "Mardi – vendredi · 9:00 – 13:00, 15:30 – 19:30",
      "Samedi · 9:00 – 19:00",
      "Lundi, dimanche · fermé",
    ]);
  });
});
