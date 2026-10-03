import { handleContact } from "../../../lib/contact";
import { getMailer, shopInfo } from "../../../lib/emails";
import { env, shopIdFromToken } from "../../../lib/env";
import { hasDatabase, logEmailEvent } from "../../../lib/orders";
import { config, getContent, themeTokens } from "../../../lib/site";

export const dynamic = "force-dynamic";

/** Formulaire de contact : envoi immédiat au commerçant par l'API Brevo (lot 6). */
export async function POST(request: Request) {
  const e = env();
  const { settings } = (await getContent()).pages;
  const mailer = getMailer(e, config, settings);
  const shopId = shopIdFromToken(e.SUPABASE_SHOP_JWT);
  const form = await request.formData().catch(() => new FormData());
  const result = await handleContact(form, {
    shop: shopInfo(config, settings, themeTokens),
    to: settings.email,
    send: mailer ? (email) => mailer.send(email) : null,
    log: async (messageId, status) => {
      if (shopId && hasDatabase(e)) {
        await logEmailEvent(e, {
          shop_id: shopId,
          kind: "contact_message",
          order_id: null,
          provider_message_id: messageId,
          status,
        });
      }
    },
  });
  if (result.status === 303) return new Response(null, { status: 303, headers: { Location: result.location } });
  return new Response(result.message, {
    status: result.status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...(result.status === 503 ? { "Retry-After": "86400" } : {}),
    },
  });
}
