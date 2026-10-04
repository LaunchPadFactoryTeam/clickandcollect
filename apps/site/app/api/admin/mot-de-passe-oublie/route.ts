import { passwordResetEmail } from "@launchpadfactoryteam/emails";
import { handleForgot } from "../../../../lib/admin/handlers";
import { adminEnv, FORBIDDEN, newResetToken, sameOrigin, toResponse } from "../../../../lib/admin/session";
import { passwordResets } from "../../../../lib/admin/site-rpc";
import { inBackground } from "../../../../lib/background";
import { getMailer, shopInfo } from "../../../../lib/emails";
import { logEmailEvent } from "../../../../lib/orders";
import { config, getContent, themeTokens } from "../../../../lib/site";

export const dynamic = "force-dynamic";

/** Mot de passe oublié : même réponse que le compte existe ou non ; le lien part en arrière-plan. */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return FORBIDDEN();
  const configured = adminEnv();
  if (!configured) return toResponse({ status: 303, location: "/admin/connexion?erreur=configuration" });
  const { e, shopId } = configured;
  const result = handleForgot(await request.formData().catch(() => new FormData()), {
    resets: passwordResets(e),
    newToken: newResetToken,
    origin: new URL(request.url).origin,
    background: inBackground,
    async sendLink(to, url) {
      const { settings } = (await getContent()).pages;
      const mailer = getMailer(e, config, settings);
      if (!mailer) throw new Error("Aucun prestataire d'emails : lien de réinitialisation non envoyé");
      const status = await mailer.send(passwordResetEmail(shopInfo(config, settings, themeTokens), to, url)).then(
        (sent) => ({ id: sent.messageId, status: "sent" as const }),
        () => ({ id: null, status: "failed" as const }),
      );
      await logEmailEvent(e, {
        shop_id: shopId,
        kind: "password_reset",
        order_id: null,
        provider_message_id: status.id,
        status: status.status,
      });
    },
  });
  return toResponse(result);
}
