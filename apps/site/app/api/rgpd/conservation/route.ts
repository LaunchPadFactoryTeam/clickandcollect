import { env } from "../../../../lib/env";
import { hasDatabase } from "../../../../lib/orders";
import { isAuthorized } from "../../../../lib/revalidate";
import { applyRetention } from "../../../../lib/rgpd";

export const dynamic = "force-dynamic";

/**
 * Durées de conservation (lot 8), appliquées à la boutique du site le 1er de chaque mois par la tâche planifiée du
 * Worker (en-tête x-lp-cron-secret) : anonymisation, archivage des consentements, suppression des ventes de 10 ans.
 */
export async function POST(request: Request) {
  const e = env();
  if (!isAuthorized(request.headers.get("x-lp-cron-secret"), e.CRON_SECRET)) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (!hasDatabase(e)) return Response.json({ skipped: "base non configurée" });
  const report = await applyRetention(e);
  console.log(JSON.stringify({ level: "info", message: "Conservation appliquée", ...report }));
  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}
