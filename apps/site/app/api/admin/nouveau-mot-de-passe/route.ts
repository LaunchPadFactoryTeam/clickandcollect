import { handleReset } from "../../../../lib/admin/handlers";
import { adminEnv, FORBIDDEN, sameOrigin, sha256Hex, toResponse } from "../../../../lib/admin/session";
import { passwordResets } from "../../../../lib/admin/site-rpc";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return FORBIDDEN();
  const configured = adminEnv();
  if (!configured) return toResponse({ status: 303, location: "/admin/connexion?erreur=configuration" });
  const result = await handleReset(await request.formData().catch(() => new FormData()), {
    resets: passwordResets(configured.e),
    hash: sha256Hex,
  });
  return toResponse(result);
}
