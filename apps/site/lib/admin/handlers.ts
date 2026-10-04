import { canTransition, isOrderStatus, type OrderStatus } from "@launchpadfactoryteam/commerce";
import { clearedCookies, sessionCookies, type AuthClient, type CookieSpec } from "./auth";
import type { LoginLimiter, PasswordResets } from "./site-rpc";

/**
 * Actions du back-office, sans dépendance à Next.js : les routes /api/admin/* les appellent avec les vrais services,
 * les tests avec des doublures. Formulaires HTML classiques : réponse 303 vers la page à afficher.
 */

export interface AdminResult {
  status: number;
  location?: string;
  cookies?: CookieSpec[];
  /** Corps texte des réponses 401, 403 et 404. */
  message?: string;
}

const see = (location: string, cookies?: CookieSpec[]): AdminResult => ({ status: 303, location, cookies });
const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
export const UNAUTHENTICATED: AdminResult = { status: 401, message: "Session absente ou expirée : reconnectez-vous." };

/** Page de retour après une action : toujours une page du back-office (jamais une adresse externe). */
export function safeReturn(value: unknown, fallback = "/admin"): string {
  const s = typeof value === "string" ? value : "";
  return /^\/admin(?:[/?#]|$)/.test(s) && !s.startsWith("//") ? s : fallback;
}

// ---------------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------------

export interface LoginDeps {
  auth: AuthClient;
  limiter: LoginLimiter;
  /** Le compte est-il commerçant de la boutique de ce site ? */
  isMerchant(accessToken: string): Promise<boolean>;
}

/** 5 échecs en 15 minutes bloquent le compte 15 minutes ; un compte d'une autre boutique compte comme un échec. */
export async function handleLogin(form: FormData, deps: LoginDeps): Promise<AdminResult> {
  const email = field(form, "email").toLowerCase();
  const password = String(form.get("mot_de_passe") ?? "");
  if (!email || !password) return see("/admin/connexion?erreur=champs");
  if (await deps.limiter.blockedUntil(email)) return see("/admin/connexion?erreur=bloque");

  const tokens = await deps.auth.password(email, password);
  if (tokens && (await deps.isMerchant(tokens.access_token))) {
    await deps.limiter.clear(email);
    return see("/admin", sessionCookies(tokens));
  }
  if (tokens) await deps.auth.logout(tokens.access_token);
  await deps.limiter.fail(email);
  const blocked = await deps.limiter.blockedUntil(email);
  return see(`/admin/connexion?erreur=${blocked ? "bloque" : "identifiants"}`);
}

export async function handleLogout(accessToken: string | undefined, auth: AuthClient): Promise<AdminResult> {
  if (accessToken) await auth.logout(accessToken);
  return see("/admin/connexion?deconnecte=1", clearedCookies());
}

// ---------------------------------------------------------------------------
// Statut d'une commande
// ---------------------------------------------------------------------------

export interface StatusDeps {
  currentStatus(orderId: string): Promise<OrderStatus | null>;
  updateStatus(orderId: string, from: OrderStatus, to: OrderStatus): Promise<boolean>;
  /** Après un passage à « Prête » : envoi immédiat de l'email mis en file par la base (lot 6). */
  afterReady?(): void;
}

/** Fait avancer (ou reculer d'un cran) une commande. Sans session : 401 et aucune écriture. */
export async function handleStatus(
  authenticated: boolean,
  orderId: string,
  form: FormData,
  deps: StatusDeps,
): Promise<AdminResult> {
  if (!authenticated) return UNAUTHENTICATED;
  const back = safeReturn(field(form, "retour"), `/admin/commandes/${orderId}`);
  const target = field(form, "statut");
  if (!isOrderStatus(target)) return see(withNotice(back, "erreur=statut"));
  const current = await deps.currentStatus(orderId);
  if (!current) return { status: 404, message: "Commande introuvable." };
  if (!canTransition(current, target)) return see(withNotice(back, "erreur=statut"));
  const done = await deps.updateStatus(orderId, current, target);
  if (done && target === "ready") deps.afterReady?.();
  return see(withNotice(back, done ? `maj=${orderId}` : "erreur=concurrence"));
}

function withNotice(path: string, notice: string): string {
  const [base, hash] = path.split("#");
  const url = `${base}${base!.includes("?") ? "&" : "?"}${notice}`;
  return hash ? `${url}#${hash}` : url;
}

// ---------------------------------------------------------------------------
// Disponibilité
// ---------------------------------------------------------------------------

export interface AvailabilityDeps {
  /** Identifiants des produits du catalogue (seuls ceux-là peuvent être enregistrés). */
  productIds: ReadonlySet<string>;
  saved(): Promise<Record<string, boolean>>;
  save(changes: { productId: string; available: boolean }[]): Promise<void>;
  /** Relit le catalogue du site (disponibilités comprises) : effet visible en moins d'une minute. */
  revalidate(): Promise<void>;
}

/**
 * Formulaire Disponibilité : « produit » liste les produits basculés, « en_vente » ceux d'entre eux laissés en vente.
 * Seules les différences avec l'état enregistré sont écrites, puis le catalogue est revalidé.
 */
export async function handleAvailability(
  authenticated: boolean,
  form: FormData,
  deps: AvailabilityDeps,
): Promise<AdminResult> {
  if (!authenticated) return UNAUTHENTICATED;
  const shown = form
    .getAll("produit")
    .map(String)
    .filter((id) => deps.productIds.has(id));
  const on = new Set(form.getAll("en_vente").map(String));
  const saved = await deps.saved();
  const changes = shown
    .map((productId) => ({ productId, available: on.has(productId) }))
    .filter((c) => c.available !== (saved[c.productId] ?? true));
  if (changes.length > 0) {
    await deps.save(changes);
    await deps.revalidate();
  }
  return see(`/admin/produits?enregistre=${changes.length}`);
}

// ---------------------------------------------------------------------------
// Mot de passe oublié
// ---------------------------------------------------------------------------

export interface ForgotDeps {
  resets: Pick<PasswordResets, "request">;
  /** Jeton aléatoire du lien (au moins 32 octets) et son empreinte SHA-256 en hexadécimal. */
  newToken(): Promise<{ token: string; hash: string }>;
  sendLink(to: string, url: string): Promise<void>;
  /** Origine du site, pour construire le lien. */
  origin: string;
  /** Lance la tâche après la réponse. */
  background(task: () => Promise<unknown>): void;
}

/**
 * Même réponse et même délai que l'email existe ou non : la recherche du compte et l'envoi se font après la
 * réponse, en arrière-plan.
 */
export function handleForgot(form: FormData, deps: ForgotDeps): AdminResult {
  const email = field(form, "email").toLowerCase();
  if (email.includes("@")) {
    deps.background(async () => {
      const { token, hash } = await deps.newToken();
      const to = await deps.resets.request(email, hash);
      if (to) await deps.sendLink(to, `${deps.origin}/admin/nouveau-mot-de-passe?jeton=${token}`);
    });
  }
  return see("/admin/mot-de-passe-oublie?envoye=1");
}

export interface ResetDeps {
  resets: Pick<PasswordResets, "complete">;
  hash(token: string): Promise<string>;
}

export const MIN_PASSWORD_LENGTH = 10;

export async function handleReset(form: FormData, deps: ResetDeps): Promise<AdminResult> {
  const token = field(form, "jeton");
  const password = String(form.get("mot_de_passe") ?? "");
  const again = String(form.get("confirmation") ?? "");
  const page = `/admin/nouveau-mot-de-passe?jeton=${encodeURIComponent(token)}`;
  if (!/^[A-Za-z0-9_-]{43,}$/.test(token)) return see("/admin/nouveau-mot-de-passe?erreur=lien");
  if (password.length < MIN_PASSWORD_LENGTH) return see(`${page}&erreur=longueur`);
  if (password !== again) return see(`${page}&erreur=confirmation`);
  const done = await deps.resets.complete(await deps.hash(token), password);
  return see(done ? "/admin/connexion?reinitialise=1" : "/admin/nouveau-mot-de-passe?erreur=lien");
}
