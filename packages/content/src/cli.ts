/**
 * lp-content snapshot <dossier-du-site> --out <fichier.json>
 * Fige les contenus du site pour le build : Sanity si SANITY_PROJECT_ID et SANITY_DATASET sont définis,
 * sinon le dossier content/ du repo client. Disponibilités : Supabase si SUPABASE_URL et SUPABASE_SHOP_JWT
 * sont définis, sinon content/availability.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ContentError, fetchSanityContent, loadLocalContent, type Availability, type ContentSnapshot } from "./loader.ts";

async function supabaseAvailability(url: string, token: string, anonKey?: string): Promise<Availability[]> {
  const res = await fetch(`${url}/rest/v1/product_availability?select=product_id,available`, {
    headers: { apikey: anonKey ?? token, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new ContentError(`Supabase a répondu ${res.status} pour les disponibilités`);
  return (await res.json()) as Availability[];
}

async function main(argv: string[]): Promise<number> {
  const [command, target, ...rest] = argv;
  const outFlag = rest.indexOf("--out");
  if (command !== "snapshot" || !target || outFlag < 0 || !rest[outFlag + 1]) {
    console.error("Usage : lp-content snapshot <dossier-du-site> --out <fichier.json>");
    return 2;
  }
  const out = resolve(rest[outFlag + 1]!);
  const env = process.env;
  try {
    let snapshot: ContentSnapshot;
    if (env.SANITY_PROJECT_ID && env.SANITY_DATASET) {
      const availability =
        env.SUPABASE_URL && env.SUPABASE_SHOP_JWT
          ? await supabaseAvailability(env.SUPABASE_URL, env.SUPABASE_SHOP_JWT, env.SUPABASE_ANON_KEY)
          : [];
      snapshot = await fetchSanityContent(
        { projectId: env.SANITY_PROJECT_ID, dataset: env.SANITY_DATASET, token: env.SANITY_READ_TOKEN },
        availability,
      );
    } else {
      snapshot = loadLocalContent(resolve(target));
    }
    for (const e of snapshot.report.excluded) console.warn(`Produit non publié ${e.id} : ${e.reasons.join(" ; ")}`);
    for (const w of snapshot.report.warnings) console.warn(`À relire ${w.id} : ${w.messages.join(" ; ")}`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(snapshot, null, 2));
    console.log(`Contenus figés : ${snapshot.catalog.length} produits publiés → ${out}`);
    return 0;
  } catch (error) {
    if (error instanceof ContentError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }
}

process.exitCode = await main(process.argv.slice(2));
