import { cookies } from "next/headers";
import { ACCESS_COOKIE, goTrue } from "../../../../lib/admin/auth";
import { handleLogout } from "../../../../lib/admin/handlers";
import { adminEnv, FORBIDDEN, logoutCookies, sameOrigin, toResponse } from "../../../../lib/admin/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return FORBIDDEN();
  const configured = adminEnv();
  if (!configured) return toResponse({ status: 303, location: "/admin/connexion", cookies: logoutCookies() });
  const accessToken = (await cookies()).get(ACCESS_COOKIE)?.value;
  return toResponse(await handleLogout(accessToken, goTrue(configured.e)));
}
