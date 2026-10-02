import { llmsTxt } from "@launchpadfactoryteam/seo";
import { config, getContent } from "../../lib/site";

export const dynamic = "force-static";

/** Résumé factuel pour les assistants ; absent si la boutique refuse les robots d'IA. */
export async function GET() {
  if (!config.seo.robots_ia) return new Response("Not Found", { status: 404 });
  return new Response(llmsTxt(config, await getContent()), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
