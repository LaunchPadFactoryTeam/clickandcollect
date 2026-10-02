import { WebhookSignatureError } from "./types.ts";

/**
 * Signature des webhooks au format Stripe : en-tête « t=<horodatage>,v1=<hmac> », HMAC-SHA256 de
 * « <horodatage>.<corps brut> » avec le secret du point de terminaison. WebCrypto : fonctionne dans le Worker.
 */

export const SIGNATURE_TOLERANCE_SECONDS = 300;

const encoder = new TextEncoder();

async function hmacHex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparaison en temps constant de deux chaînes hexadécimales. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signPayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  return `t=${timestamp},v1=${await hmacHex(secret, `${timestamp}.${payload}`)}`;
}

/** Lève WebhookSignatureError si l'en-tête manque, est mal formé, trop ancien ou ne correspond pas. */
export async function verifySignature(
  payload: string,
  header: string | null,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): Promise<void> {
  if (!header) throw new WebhookSignatureError("En-tête de signature absent");
  const parts = header.split(",").map((p) => p.trim().split("=") as [string, string]);
  const timestamp = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!Number.isInteger(timestamp) || signatures.length === 0)
    throw new WebhookSignatureError("En-tête de signature mal formé");
  if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_SECONDS) throw new WebhookSignatureError("Signature expirée");
  const expected = await hmacHex(secret, `${timestamp}.${payload}`);
  if (!signatures.some((s) => safeEqual(s, expected))) throw new WebhookSignatureError("Signature invalide");
}

/** Empreinte SHA-256 en hexadécimal (texte de consentement, par exemple). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** HMAC-SHA256 en hexadécimal : empreinte client à partir de l'email et de la clé de la boutique. */
export async function hmacSha256Hex(key: string, text: string): Promise<string> {
  return hmacHex(key, text);
}
