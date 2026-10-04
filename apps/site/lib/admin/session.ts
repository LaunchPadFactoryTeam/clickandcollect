import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env, shopIdFromToken, type SiteEnv } from "../env";
import {
  ACCESS_COOKIE,
  clearedCookies,
  goTrue,
  hasAuth,
  isExpired,
  readAccessToken,
  REFRESH_COOKIE,
  serializeCookie,
  sessionCookies,
  type AccessClaims,
  type CookieSpec,
} from "./auth";
import { AdminApi } from "./data";
import type { AdminResult } from "./handlers";

export interface AdminContext {
  e: SiteEnv;
  api: AdminApi;
  claims: AccessClaims;
}

/** Back-office configuré : base, clé publique de Supabase Auth et jeton de site. */
export function adminEnv(): { e: SiteEnv; shopId: string } | null {
  const e = env();
  const shopId = shopIdFromToken(e.SUPABASE_SHOP_JWT);
  return hasAuth(e) && shopId ? { e, shopId } : null;
}

/**
 * Pages du back-office : session valable ou redirection. Un jeton d'accès expiré passe par /api/admin/session, qui le
 * rafraîchit (seule une route peut écrire des cookies) puis revient sur la page.
 */
export async function requireAdmin(path: string): Promise<AdminContext> {
  const configured = adminEnv();
  if (!configured) redirect("/admin/connexion?erreur=configuration");
  const jar = await cookies();
  const claims = readAccessToken(jar.get(ACCESS_COOKIE)?.value);
  if (!claims || isExpired(claims, new Date())) {
    if (jar.get(REFRESH_COOKIE)?.value) redirect(`/api/admin/session?retour=${encodeURIComponent(path)}`);
    redirect("/admin/connexion");
  }
  return { e: configured.e, claims, api: new AdminApi(configured.e, jar.get(ACCESS_COOKIE)!.value, configured.shopId) };
}

/**
 * Actions : session du cookie, rafraîchie au besoin. Renvoie null sans session valable (réponse 401) ; les cookies
 * renouvelés sont à poser sur la réponse.
 */
export async function actionSession(): Promise<{ api: AdminApi; accessToken: string; cookies: CookieSpec[] } | null> {
  const configured = adminEnv();
  if (!configured) return null;
  const jar = await cookies();
  let accessToken = jar.get(ACCESS_COOKIE)?.value;
  const claims = readAccessToken(accessToken);
  let renewed: CookieSpec[] = [];
  if (!claims || isExpired(claims, new Date())) {
    const refreshToken = jar.get(REFRESH_COOKIE)?.value;
    const tokens = refreshToken ? await goTrue(configured.e).refresh(refreshToken) : null;
    if (!tokens) return null;
    accessToken = tokens.access_token;
    renewed = sessionCookies(tokens);
  }
  return {
    api: new AdminApi(configured.e, accessToken!, configured.shopId),
    accessToken: accessToken!,
    cookies: renewed,
  };
}

/** Réponse HTTP d'une action. */
export function toResponse(result: AdminResult, extraCookies: CookieSpec[] = []): Response {
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const c of [...extraCookies, ...(result.cookies ?? [])]) headers.append("Set-Cookie", serializeCookie(c));
  if (result.location) headers.set("Location", result.location);
  if (result.message) headers.set("Content-Type", "text/plain; charset=utf-8");
  return new Response(result.message ?? null, { status: result.status, headers });
}

/** Les formulaires du back-office ne sont acceptés que depuis le site lui-même. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

export const FORBIDDEN = (): Response => new Response("Origine refusée.", { status: 403 });

export const logoutCookies = clearedCookies;

/** Jeton aléatoire de 32 octets (base64url) et son empreinte SHA-256 en hexadécimal. */
export async function newResetToken(): Promise<{ token: string; hash: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  return { token, hash: await sha256Hex(token) };
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
