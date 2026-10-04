import { goTrue } from "../../../../lib/admin/auth";
import { AdminApi } from "../../../../lib/admin/data";
import { handleLogin } from "../../../../lib/admin/handlers";
import { adminEnv, FORBIDDEN, sameOrigin, toResponse } from "../../../../lib/admin/session";
import { loginLimiter } from "../../../../lib/admin/site-rpc";

export const dynamic = "force-dynamic";

/** Connexion du commerçant (formulaire de /admin/connexion). */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return FORBIDDEN();
  const configured = adminEnv();
  if (!configured) return toResponse({ status: 303, location: "/admin/connexion?erreur=configuration" });
  const { e, shopId } = configured;
  const result = await handleLogin(await request.formData().catch(() => new FormData()), {
    auth: goTrue(e),
    limiter: loginLimiter(e),
    isMerchant: (accessToken) => new AdminApi(e, accessToken, shopId).isMerchant(),
  });
  return toResponse(result);
}
