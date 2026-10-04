import { safeReturn } from "../../../../lib/admin/handlers";
import { actionSession, logoutCookies, toResponse } from "../../../../lib/admin/session";

export const dynamic = "force-dynamic";

/** Jeton d'accès expiré : rafraîchi ici (une page ne peut pas écrire de cookie), puis retour à la page demandée. */
export async function GET(request: Request) {
  const back = safeReturn(new URL(request.url).searchParams.get("retour"));
  const session = await actionSession();
  if (!session) return toResponse({ status: 303, location: "/admin/connexion", cookies: logoutCookies() });
  return toResponse({ status: 303, location: back }, session.cookies);
}
