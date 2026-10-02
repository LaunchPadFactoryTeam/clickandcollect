import { handleCheckout } from "../../../lib/checkout";
import { env, shopIdFromToken } from "../../../lib/env";
import { getProvider } from "../../../lib/payments";
import { config, getContent } from "../../../lib/site";

export const dynamic = "force-dynamic";

/** Étape 2 du tunnel : revérifie le panier côté serveur et ouvre la session de paiement. */
export async function POST(request: Request) {
  const e = env();
  const provider = getProvider(e);
  const shopId = shopIdFromToken(e.SUPABASE_SHOP_JWT);
  if (!provider || !shopId) {
    return Response.json({ code: "PAYMENT_UNAVAILABLE" }, { status: 503, headers: { "Retry-After": "3600" } });
  }
  const body = await request.json().catch(() => null);
  const content = await getContent();
  const { status, body: payload } = await handleCheckout(body, {
    provider,
    config,
    catalog: content.catalog,
    settings: content.pages.settings,
    shopId,
    origin: new URL(request.url).origin,
    now: new Date(),
  });
  return Response.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}
