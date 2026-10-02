import { FakeProvider } from "@launchpadfactoryteam/psp";
import { alert } from "../../../lib/alert";
import { env, shopIdFromToken } from "../../../lib/env";
import { recordPaidCheckout } from "../../../lib/orders";
import { getProvider } from "../../../lib/payments";
import { handleWebhook } from "../../../lib/webhook";

export const dynamic = "force-dynamic";

/**
 * Faux fournisseur uniquement (LP_PSP=fake) : simule le paiement puis l'appel du webhook, signé comme Stripe.
 * N'existe pas quand un vrai fournisseur est configuré.
 */
export async function POST(request: Request) {
  const e = env();
  const provider = getProvider(e);
  const shopId = shopIdFromToken(e.SUPABASE_SHOP_JWT);
  if (!(provider instanceof FakeProvider) || !shopId || !e.SHOP_HASH_KEY) return new Response(null, { status: 404 });
  const { sessionId, email, phone } = (await request.json().catch(() => ({}))) as Record<string, string>;
  if (!sessionId || !email) return Response.json({ error: "sessionId et email attendus" }, { status: 400 });
  const { rawBody, signature } = await provider.paidEvent(sessionId, { email, phone });
  const { status, body } = await handleWebhook(rawBody, signature, {
    provider,
    shopId,
    hashKey: e.SHOP_HASH_KEY,
    record: (order) => recordPaidCheckout(e, order),
    alert: (message, details) => alert(e.ALERT_WEBHOOK_URL, message, details),
  });
  return Response.json(body, { status });
}
