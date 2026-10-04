/**
 * Empreinte client (section 1.10) : HMAC-SHA256(clé de la boutique, email normalisé). La clé, 32 octets aléatoires par
 * boutique, est un secret du Worker : un même client a une empreinte différente sur chaque boutique.
 */

const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

/** « ␣␣Paul.Martin@Exemple.FR » → « paul.martin@exemple.fr » : espaces retirés, minuscules. */
export const normalizeEmail = (email: string) => email.replace(/\s+/g, "").toLowerCase();

export async function sha256Hex(text: string): Promise<string> {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

export async function hmacSha256Hex(key: string, text: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(text)));
}

/** Empreinte du client sur une boutique. */
export const customerHash = (shopKey: string, email: string) => hmacSha256Hex(shopKey, normalizeEmail(email));
