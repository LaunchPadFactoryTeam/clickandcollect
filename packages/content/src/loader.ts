import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildCatalog,
  CATALOG_QUERY,
  publicationBlockers,
  reviewWarnings,
  type CatalogProduct,
  type Product,
} from "./catalog.ts";
import { siteContentSchema, type SiteContent } from "./site-content.ts";

/** Contenus figés au build : ce que les pages du site importent. */
export interface ContentSnapshot {
  pages: SiteContent;
  /** Produits publiables, avec leur disponibilité. */
  catalog: CatalogProduct[];
  /** Produits écartés et points de relecture, affichés au build. */
  report: { excluded: { id: string; reasons: string[] }[]; warnings: { id: string; messages: string[] }[] };
}

export class ContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentError";
  }
}

export type Availability = { product_id: string; available: boolean };

function readJson<T>(file: string): T {
  if (!existsSync(file)) throw new ContentError(`Fichier de contenu introuvable : ${file}`);
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch (error) {
    throw new ContentError(`JSON illisible dans ${file} : ${(error as Error).message}`);
  }
}

/** Assemble et vérifie un instantané de contenus ; lève ContentError sur une incohérence bloquante. */
export function buildSnapshot(rawPages: unknown, products: Product[], availability: Availability[]): ContentSnapshot {
  const parsed = siteContentSchema.safeParse(rawPages);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")} : ${i.message}`);
    throw new ContentError(["Contenus éditoriaux invalides :", ...lines].join("\n"));
  }
  const pages = parsed.data;
  const ids = new Set<string>();
  for (const p of products) {
    if (ids.has(p.id)) throw new ContentError(`Identifiant de produit en double : ${p.id}`);
    ids.add(p.id);
  }
  const catalog = buildCatalog(products, availability);
  const published = new Set(catalog.map((p) => p.id));
  const missing = pages.home.featuredProductIds.filter((id) => !published.has(id));
  if (missing.length) {
    throw new ContentError(`Produits mis en avant absents du catalogue publié : ${missing.join(", ")}`);
  }
  return {
    pages,
    catalog,
    report: {
      excluded: products
        .filter((p) => !published.has(p.id))
        .map((p) => ({ id: p.id, reasons: publicationBlockers(p) })),
      warnings: catalog.map((p) => ({ id: p.id, messages: reviewWarnings(p) })).filter((w) => w.messages.length),
    },
  };
}

/** Contenus de départ du repo client : content/pages.json, catalogue.json, availability.json (facultatif). */
export function loadLocalContent(siteDir: string): ContentSnapshot {
  const dir = join(siteDir, "content");
  const availabilityFile = join(dir, "availability.json");
  return buildSnapshot(
    readJson(join(dir, "pages.json")),
    readJson<Product[]>(join(dir, "catalogue.json")),
    existsSync(availabilityFile) ? readJson<Availability[]>(availabilityFile) : [],
  );
}

export interface SanityOptions {
  projectId: string;
  dataset: string;
  /** Jeton de lecture (projet privé). */
  token?: string;
  apiVersion?: string;
}

/** Interroge l'API HTTP de Sanity (CDN), sans dépendre du SDK. */
export async function sanityQuery<T>(opts: SanityOptions, query: string, fetchImpl: typeof fetch = fetch): Promise<T> {
  const version = opts.apiVersion ?? "v2025-02-19";
  const url = new URL(`https://${opts.projectId}.apicdn.sanity.io/${version}/data/query/${opts.dataset}`);
  url.searchParams.set("query", query);
  const res = await fetchImpl(url, { headers: opts.token ? { Authorization: `Bearer ${opts.token}` } : {} });
  if (!res.ok) throw new ContentError(`Sanity a répondu ${res.status} pour ${opts.projectId}/${opts.dataset}`);
  const body = (await res.json()) as { result: T };
  return body.result;
}

export const SITE_CONTENT_QUERY = `*[_type == "siteContent" && !(_id in path("drafts.**"))][0]{ settings, home, shop, story, contact }`;

/** Contenus depuis Sanity ; les disponibilités viennent de Supabase et sont passées par l'appelant. */
export async function fetchSanityContent(
  opts: SanityOptions,
  availability: Availability[],
  fetchImpl: typeof fetch = fetch,
): Promise<ContentSnapshot> {
  const [pages, products] = await Promise.all([
    sanityQuery<unknown>(opts, SITE_CONTENT_QUERY, fetchImpl),
    sanityQuery<Product[]>(opts, CATALOG_QUERY, fetchImpl),
  ]);
  if (!pages) throw new ContentError("Aucun document siteContent publié dans Sanity");
  return buildSnapshot(pages, products ?? [], availability);
}
