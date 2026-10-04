import type { SiteEnv } from "../env";

/**
 * Fonctions de la base appelées avec le jeton de site (rôle lp_site) : limitation des essais de connexion et
 * réinitialisation du mot de passe, pour la seule boutique du site.
 */

async function rpc<T>(e: SiteEnv, fn: string, args: Record<string, string>): Promise<T> {
  const res = await fetch(`${e.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: e.SUPABASE_ANON_KEY ?? e.SUPABASE_SHOP_JWT!,
      Authorization: `Bearer ${e.SUPABASE_SHOP_JWT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Base : ${fn} a répondu ${res.status} : ${text}`);
  // Fonction sans valeur de retour : 204, sans corps.
  return (text ? JSON.parse(text) : null) as T;
}

export interface LoginLimiter {
  /** Fin du blocage du compte, ou null s'il peut essayer. */
  blockedUntil(email: string): Promise<Date | null>;
  fail(email: string): Promise<void>;
  clear(email: string): Promise<void>;
}

export const loginLimiter = (e: SiteEnv): LoginLimiter => ({
  async blockedUntil(email) {
    const until = await rpc<string | null>(e, "login_blocked_until", { p_email: email });
    return until ? new Date(until) : null;
  },
  fail: (email) => rpc(e, "record_login_failure", { p_email: email }),
  clear: (email) => rpc(e, "clear_login_failures", { p_email: email }),
});

export interface PasswordResets {
  /** Enregistre le lien si l'email est celui d'un commerçant de la boutique ; renvoie l'adresse à laquelle écrire. */
  request(email: string, tokenHash: string): Promise<string | null>;
  isValid(tokenHash: string): Promise<boolean>;
  complete(tokenHash: string, password: string): Promise<boolean>;
}

export const passwordResets = (e: SiteEnv): PasswordResets => ({
  request: (email, tokenHash) => rpc(e, "request_password_reset", { p_email: email, p_token_hash: tokenHash }),
  isValid: (tokenHash) => rpc(e, "password_reset_valid", { p_token_hash: tokenHash }),
  complete: (tokenHash, password) =>
    rpc(e, "complete_password_reset", { p_token_hash: tokenHash, p_password: password }),
});
