import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Jeton de site : JWT HS256 signé avec le secret JWT du projet Supabase, rôle Postgres `lp_site`,
 * revendication `shop_id`. Les politiques RLS limitent son porteur à sa boutique ; il remplace la clé
 * service_role, qui n'est jamais déployée sur un site. Généré une fois par LaunchPad à la création du site
 * et stocké dans le secret SUPABASE_SHOP_JWT du Worker.
 */

export const SITE_ROLE = "lp_site";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface SiteTokenClaims {
  role: typeof SITE_ROLE;
  shop_id: string;
  iss: "launchpad";
  iat: number;
  exp: number;
}

export interface SignSiteTokenInput {
  shopId: string;
  /** Secret JWT du projet Supabase (au moins 32 caractères). */
  jwtSecret: string;
  /** Durée de validité, 365 jours par défaut ; le jeton est renouvelé à chaque montée de version. */
  expiresInDays?: number;
  now?: Date;
}

const b64url = (data: Buffer | string) => Buffer.from(data).toString("base64url");

function hmac(secret: string, data: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

export function signSiteToken({
  shopId,
  jwtSecret,
  expiresInDays = 365,
  now = new Date(),
}: SignSiteTokenInput): string {
  if (!UUID.test(shopId)) throw new Error(`shop_id invalide : ${shopId}`);
  if (jwtSecret.length < 32) throw new Error("Le secret JWT doit faire au moins 32 caractères");
  if (!(expiresInDays > 0)) throw new Error("La durée de validité doit être positive");
  const iat = Math.floor(now.getTime() / 1000);
  const claims: SiteTokenClaims = {
    role: SITE_ROLE,
    shop_id: shopId.toLowerCase(),
    iss: "launchpad",
    iat,
    exp: iat + Math.round(expiresInDays * 86400),
  };
  const head = `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(claims))}`;
  return `${head}.${b64url(hmac(jwtSecret, head))}`;
}

/** Vérifie signature, rôle et expiration ; renvoie les revendications. Sert aux tests et au diagnostic. */
export function verifySiteToken(token: string, jwtSecret: string, now = new Date()): SiteTokenClaims {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Jeton mal formé");
  const [header, payload, signature] = parts as [string, string, string];
  const expected = hmac(jwtSecret, `${header}.${payload}`);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new Error("Signature invalide");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SiteTokenClaims;
  if (claims.role !== SITE_ROLE) throw new Error(`Rôle inattendu : ${claims.role}`);
  if (claims.exp <= Math.floor(now.getTime() / 1000)) throw new Error("Jeton expiré");
  return claims;
}
