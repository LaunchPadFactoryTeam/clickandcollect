import type { SiteEnv } from "../env";

/**
 * Connexion du commerçant avec Supabase Auth (API HTTP de GoTrue, sans SDK pour garder le Worker léger).
 * Le jeton d'accès (rôle authenticated) et le jeton de rafraîchissement vivent dans deux cookies httpOnly.
 */

export const ACCESS_COOKIE = "lp_admin_at";
export const REFRESH_COOKIE = "lp_admin_rt";
/** Le jeton de rafraîchissement garde la session ouverte 30 jours au comptoir. */
const REFRESH_MAX_AGE = 30 * 24 * 3600;

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface AuthClient {
  /** Jetons de session, ou null si l'email ou le mot de passe est faux. */
  password(email: string, password: string): Promise<Tokens | null>;
  refresh(refreshToken: string): Promise<Tokens | null>;
  logout(accessToken: string): Promise<void>;
}

export class AuthUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthUnavailableError";
  }
}

export function hasAuth(e: SiteEnv): boolean {
  return Boolean(e.SUPABASE_URL && e.SUPABASE_ANON_KEY && e.SUPABASE_SHOP_JWT);
}

export function goTrue(e: SiteEnv): AuthClient {
  const base = `${e.SUPABASE_URL}/auth/v1`;
  const headers = { apikey: e.SUPABASE_ANON_KEY!, "Content-Type": "application/json" };
  async function token(grant: string, body: Record<string, string>): Promise<Tokens | null> {
    const res = await fetch(`${base}/token?grant_type=${grant}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (res.status === 400 || res.status === 401 || res.status === 403) return null;
    if (!res.ok) throw new AuthUnavailableError(`Supabase Auth a répondu ${res.status}`);
    return (await res.json()) as Tokens;
  }
  return {
    password: (email, password) => token("password", { email, password }),
    refresh: (refreshToken) => token("refresh_token", { refresh_token: refreshToken }),
    async logout(accessToken) {
      await fetch(`${base}/logout?scope=local`, {
        method: "POST",
        headers: { ...headers, Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }).catch(() => undefined);
    },
  };
}

export interface AccessClaims {
  sub: string;
  email: string;
  /** Expiration, en secondes depuis l'époque Unix. */
  exp: number;
}

/**
 * Revendications du jeton d'accès, lues sans vérifier la signature : elles ne servent qu'à l'affichage et à savoir
 * s'il faut rafraîchir. Chaque lecture ou écriture passe par PostgREST, qui vérifie le jeton.
 */
export function readAccessToken(token: string | undefined): AccessClaims | null {
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(atob(payload.replaceAll("-", "+").replaceAll("_", "/"))) as Partial<AccessClaims>;
    if (typeof claims.sub !== "string" || typeof claims.exp !== "number") return null;
    return { sub: claims.sub, email: claims.email ?? "", exp: claims.exp };
  } catch {
    return null;
  }
}

/** Le jeton expire dans moins de 30 secondes : il faut le rafraîchir avant de s'en servir. */
export const isExpired = (claims: AccessClaims, now: Date) => claims.exp * 1000 - now.getTime() < 30_000;

export interface CookieSpec {
  name: string;
  value: string;
  maxAge: number;
}

export function sessionCookies(tokens: Tokens): CookieSpec[] {
  return [
    { name: ACCESS_COOKIE, value: tokens.access_token, maxAge: tokens.expires_in },
    { name: REFRESH_COOKIE, value: tokens.refresh_token, maxAge: REFRESH_MAX_AGE },
  ];
}

export const clearedCookies = (): CookieSpec[] => [
  { name: ACCESS_COOKIE, value: "", maxAge: 0 },
  { name: REFRESH_COOKIE, value: "", maxAge: 0 },
];

/** En-tête Set-Cookie : httpOnly, Secure, SameSite=Lax (un formulaire d'un autre site n'emporte pas la session). */
export function serializeCookie(c: CookieSpec): string {
  return `${c.name}=${encodeURIComponent(c.value)}; Path=/; Max-Age=${c.maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
