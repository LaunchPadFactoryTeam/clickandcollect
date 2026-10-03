import { alert } from "../../../../lib/alert";
import { inBackground } from "../../../../lib/background";
import { processPendingEmails } from "../../../../lib/emails";
import { env, shopIdFromToken } from "../../../../lib/env";
import { hasDatabase, recordPaidCheckout } from "../../../../lib/orders";
import { getProvider } from "../../../../lib/payments";
import { config, getContent, themeTokens } from "../../../../lib/site";
import { handleWebhook } from "../../../../lib/webhook";

export const dynamic = "force-dynamic";

/** Webhook Stripe : le corps brut est lu tel quel, la signature porte dessus. */
export async function POST(request: Request) {
  const e = env();
  const provider = getProvider(e);
  const shopId = shopIdFromToken(e.SUPABASE_SHOP_JWT);
  if (!provider || !shopId || !hasDatabase(e) || !e.SHOP_HASH_KEY) {
    await alert(e.ALERT_WEBHOOK_URL, "Webhook de paiement reçu sur un site non configuré");
    return Response.json({ error: "Paiement non configuré" }, { status: 503 });
  }
  const { status, body } = await handleWebhook(await request.text(), request.headers.get("stripe-signature"), {
    provider,
    shopId,
    hashKey: e.SHOP_HASH_KEY,
    record: (order) => recordPaidCheckout(e, order),
    alert: (message, details) => alert(e.ALERT_WEBHOOK_URL, message, details),
    afterRecord: () =>
      inBackground(async () => {
        const content = await getContent();
        return processPendingEmails(e, { config, settings: content.pages.settings, tokens: themeTokens });
      }),
  });
  return Response.json(body, { status });
}
