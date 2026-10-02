import { timingSafeEqual } from "node:crypto";

/** Vérifie le secret partagé envoyé par le webhook Sanity ou le back-office (en-tête x-lp-revalidate-secret). */
export function isAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
