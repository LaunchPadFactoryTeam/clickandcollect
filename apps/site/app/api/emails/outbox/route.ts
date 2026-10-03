import { processPendingEmails } from "../../../../lib/emails";
import { env } from "../../../../lib/env";
import { isAuthorized } from "../../../../lib/revalidate";
import { config, getContent, themeTokens } from "../../../../lib/site";

export const dynamic = "force-dynamic";

/**
 * Rejeu de la file d'envoi, appelé toutes les 5 minutes par la tâche planifiée du Worker (en-tête x-lp-cron-secret).
 */
export async function POST(request: Request) {
  const e = env();
  if (!isAuthorized(request.headers.get("x-lp-cron-secret"), e.CRON_SECRET)) {
    return Response.json({ error: "Non autorisé" }, { status: 401 });
  }
  const content = await getContent();
  const report = await processPendingEmails(e, { config, settings: content.pages.settings, tokens: themeTokens });
  return Response.json(report ?? { skipped: "emails non configurés" }, { headers: { "Cache-Control": "no-store" } });
}
