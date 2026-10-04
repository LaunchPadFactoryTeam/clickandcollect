import type { ReactNode } from "react";
import {
  nextActionLabel,
  nextStatus,
  ORDER_STEPS,
  STATUS_LABELS,
  canTransition,
  type DayBanner,
  type OrderStatus,
  type StatusFilter,
} from "@launchpadfactoryteam/commerce";
import { formatPrice, formatVat } from "../format.ts";

/**
 * Back-office commerçant (lot 7), d'après la maquette « Back-office commerçant » : même charte pour toutes les
 * boutiques, pensée pour le comptoir (cibles de 48 px, gros chiffres). Formulaires HTML classiques vers /api/admin/*.
 */

export const SUPPORT_EMAIL = "support@launchpadfactory.fr";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Toutes" },
  ...ORDER_STEPS.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
];

function StatusBadge({ status, large }: { status: OrderStatus; large?: boolean }) {
  return (
    <span className={`bo-badge bo-badge--${status}${large ? " bo-badge--lg" : ""}`}>
      <span className="bo-dot" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Écrans hors session : connexion, mot de passe oublié, nouveau mot de passe
// ---------------------------------------------------------------------------

function AuthCard({
  shopName,
  title,
  intro,
  children,
}: {
  shopName: string;
  title?: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="bo-auth" id="contenu">
      <div className="bo-auth__card">
        <p className="bo-overline">Back-office</p>
        <h1 className="bo-auth__title">{title ?? shopName}</h1>
        <p className="bo-auth__intro">{intro}</p>
        {children}
        <p className="bo-auth__support">
          Votre compte est créé par LaunchPad. Pour ajouter un accès, écrivez à{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
        </p>
      </div>
    </main>
  );
}

function Notice({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  return (
    <p className={`bo-notice bo-notice--${tone}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </p>
  );
}

export const LOGIN_ERRORS: Record<string, string> = {
  identifiants: "Email ou mot de passe incorrect.",
  bloque:
    "Trop d'essais : ce compte est bloqué pendant 15 minutes. Réessayez plus tard ou réinitialisez votre mot de passe.",
  champs: "Saisissez votre email et votre mot de passe.",
  configuration: "Le back-office n'est pas encore configuré pour cette boutique. Contactez LaunchPad.",
};

export function LoginScreen({ shopName, error, notice }: { shopName: string; error?: string; notice?: string }) {
  return (
    <AuthCard shopName={shopName} intro="Connectez-vous pour voir vos commandes du jour.">
      {error && LOGIN_ERRORS[error] && <Notice tone="error">{LOGIN_ERRORS[error]}</Notice>}
      {notice && <Notice tone="info">{notice}</Notice>}
      <form className="bo-form" method="post" action="/api/admin/connexion">
        <div>
          <label htmlFor="bo-mail">Email</label>
          <input id="bo-mail" name="email" type="email" autoComplete="username" required />
        </div>
        <div>
          <label htmlFor="bo-pw">Mot de passe</label>
          <input id="bo-pw" name="mot_de_passe" type="password" autoComplete="current-password" required />
        </div>
        <button type="submit" className="bo-btn bo-btn--primary bo-btn--block">
          Se connecter
        </button>
        <a className="bo-form__link" href="/admin/mot-de-passe-oublie">
          Mot de passe oublié
        </a>
      </form>
    </AuthCard>
  );
}

export function ForgotScreen({ shopName, sent }: { shopName: string; sent: boolean }) {
  return (
    <AuthCard
      shopName={shopName}
      title="Mot de passe oublié"
      intro="Indiquez l'email de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe."
    >
      {sent && (
        <Notice tone="info">
          Si un compte existe pour cet email, un lien vient de lui être envoyé. Il est valable une heure.
        </Notice>
      )}
      <form className="bo-form" method="post" action="/api/admin/mot-de-passe-oublie">
        <div>
          <label htmlFor="bo-mail">Email</label>
          <input id="bo-mail" name="email" type="email" autoComplete="username" required />
        </div>
        <button type="submit" className="bo-btn bo-btn--primary bo-btn--block">
          Recevoir le lien
        </button>
        <a className="bo-form__link" href="/admin/connexion">
          Retour à la connexion
        </a>
      </form>
    </AuthCard>
  );
}

export const RESET_ERRORS: Record<string, string> = {
  lien: "Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.",
  longueur: "Choisissez un mot de passe d'au moins 10 caractères.",
  confirmation: "Les deux mots de passe ne correspondent pas.",
};

export function ResetScreen({
  shopName,
  token,
  valid,
  error,
}: {
  shopName: string;
  token: string;
  valid: boolean;
  error?: string;
}) {
  if (!valid) {
    return (
      <AuthCard shopName={shopName} title="Nouveau mot de passe" intro={RESET_ERRORS.lien!}>
        <a className="bo-btn bo-btn--primary bo-btn--block" href="/admin/mot-de-passe-oublie">
          Demander un nouveau lien
        </a>
      </AuthCard>
    );
  }
  return (
    <AuthCard
      shopName={shopName}
      title="Nouveau mot de passe"
      intro="Choisissez un mot de passe d'au moins 10 caractères."
    >
      {error && RESET_ERRORS[error] && <Notice tone="error">{RESET_ERRORS[error]}</Notice>}
      <form className="bo-form" method="post" action="/api/admin/nouveau-mot-de-passe">
        <input type="hidden" name="jeton" value={token} />
        <div>
          <label htmlFor="bo-pw">Nouveau mot de passe</label>
          <input id="bo-pw" name="mot_de_passe" type="password" autoComplete="new-password" minLength={10} required />
        </div>
        <div>
          <label htmlFor="bo-pw2">Confirmation</label>
          <input id="bo-pw2" name="confirmation" type="password" autoComplete="new-password" minLength={10} required />
        </div>
        <button type="submit" className="bo-btn bo-btn--primary bo-btn--block">
          Enregistrer le mot de passe
        </button>
      </form>
    </AuthCard>
  );
}

// ---------------------------------------------------------------------------
// Cadre de l'application : en-tête, navigation basse
// ---------------------------------------------------------------------------

export function AdminShell({
  shopName,
  dateLabel,
  newCount,
  section,
  children,
}: {
  shopName: string;
  /** « Jeudi 2 octobre ». */
  dateLabel: string;
  newCount: number;
  section: "orders" | "products";
  children: ReactNode;
}) {
  return (
    <div className="bo-app">
      <header className="bo-header">
        <div className="bo-header__shop">
          <p className="bo-header__name">{shopName}</p>
          <p className="bo-header__date">{dateLabel}</p>
        </div>
        <div className="bo-header__side">
          <a className="bo-pill" href="/admin?statut=new">
            <span className="bo-dot" aria-hidden="true" />
            {newCount} nouvelle{newCount > 1 ? "s" : ""}
          </a>
          <form method="post" action="/api/admin/deconnexion">
            <button type="submit" className="bo-icon-btn" aria-label="Se déconnecter">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                <path
                  d="M12 3v9M6.3 6.3a8 8 0 1 0 11.4 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </form>
        </div>
      </header>
      <main className="bo-main" id="contenu">
        {children}
      </main>
      <nav className="bo-nav" aria-label="Sections">
        <a href="/admin" className="bo-nav__item" aria-current={section === "orders" ? "page" : undefined}>
          <span aria-hidden="true" className="bo-nav__icon">
            ▤
          </span>
          Commandes
        </a>
        <a href="/admin/produits" className="bo-nav__item" aria-current={section === "products" ? "page" : undefined}>
          <span aria-hidden="true" className="bo-nav__icon">
            ◧
          </span>
          Produits
        </a>
      </nav>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Commandes
// ---------------------------------------------------------------------------

export interface OrderCardView {
  id: string;
  number: number;
  status: OrderStatus;
  /** Nom du client, à défaut son email. */
  client: string;
  itemCount: number;
  totalCents: number;
}

export interface OrdersView {
  banner: DayBanner;
  filter: StatusFilter;
  groups: { title: string; orders: OrderCardView[] }[];
  /** Message après une action (« Commande #12 : Prête »). */
  notice?: { tone: "error" | "info"; text: string };
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function OrdersScreen({ banner, filter, groups, notice }: OrdersView) {
  const back = filter === "all" ? "/admin" : `/admin?statut=${filter}`;
  return (
    <>
      <h1 className="bo-sr">Commandes</h1>
      <section className="bo-stats" aria-label="Aujourd'hui">
        <div className="bo-stat">
          <p className="bo-stat__value">{banner.count}</p>
          <p className="bo-stat__label">Commandes aujourd'hui</p>
        </div>
        <div className="bo-stat">
          {/* Espace ordinaire avant l'euro : le montant passe à la ligne sur un écran étroit, comme dans la maquette. */}
          <p className="bo-stat__value">{formatPrice(banner.totalCents).replace("\u00a0", " ")}</p>
          <p className="bo-stat__label">Encaissé aujourd'hui</p>
        </div>
        <div className="bo-stat">
          <p className="bo-stat__value">{banner.nextSlotCount}</p>
          <p className="bo-stat__label">Au prochain créneau</p>
        </div>
      </section>

      <nav className="bo-filters" aria-label="Filtrer par statut">
        {FILTERS.map((f) => (
          <a
            key={f.value}
            className="bo-filter"
            href={f.value === "all" ? "/admin" : `/admin?statut=${f.value}`}
            aria-current={f.value === filter ? "page" : undefined}
          >
            {f.label}
          </a>
        ))}
      </nav>

      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      {groups.length === 0 && <p className="bo-empty">Aucune commande ici pour le moment.</p>}
      {groups.map((g) => (
        <section className="bo-group" key={g.title} aria-labelledby={`g-${g.orders[0]!.id}`}>
          <div className="bo-group__head">
            <h2 id={`g-${g.orders[0]!.id}`}>{g.title}</h2>
            <span className="bo-mono">{plural(g.orders.length, "commande", "commandes")}</span>
          </div>
          <ul className="bo-orders">
            {g.orders.map((o) => (
              <OrderCard key={o.id} order={o} back={back} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function OrderCard({ order, back }: { order: OrderCardView; back: string }) {
  const next = nextStatus(order.status);
  return (
    <li className={`bo-card bo-card--${order.status}`} id={`commande-${order.id}`}>
      <div className="bo-card__top">
        <div className="bo-card__who">
          <p className="bo-card__client">{order.client}</p>
          <p className="bo-mono">
            #{order.number} · {plural(order.itemCount, "article", "articles")}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="bo-card__bottom">
        <span className="bo-card__total">{formatPrice(order.totalCents)}</span>
        <div className="bo-card__actions">
          <a
            className="bo-btn bo-btn--ghost"
            href={`/admin/commandes/${order.id}`}
            aria-label={`Détail de la commande #${order.number}`}
          >
            Détail
          </a>
          {next && (
            <form method="post" action={`/api/admin/commandes/${order.id}/statut`}>
              <input type="hidden" name="statut" value={next} />
              <input type="hidden" name="retour" value={`${back}#commande-${order.id}`} />
              <button
                type="submit"
                className="bo-btn bo-btn--primary"
                aria-label={`${nextActionLabel(order.status)} : commande #${order.number}`}
              >
                {nextActionLabel(order.status)}
              </button>
            </form>
          )}
        </div>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Détail d'une commande
// ---------------------------------------------------------------------------

export interface OrderDetailView {
  id: string;
  number: number;
  status: OrderStatus;
  client: string;
  /** « Aujourd'hui 16:00 – 19:00 ». */
  slotLabel: string;
  /** « 2 oct. à 09:12 ». */
  paidLabel: string;
  email: string | null;
  phone: string | null;
  lines: { name: string; format: string; quantity: number; totalCents: number }[];
  vat: { rate: number; cents: number }[];
  totalCents: number;
  notice?: { tone: "error" | "info"; text: string };
}

export function OrderDetailScreen(o: OrderDetailView) {
  return (
    <>
      <a className="bo-back" href="/admin">
        ← Toutes les commandes
      </a>
      {o.notice && <Notice tone={o.notice.tone}>{o.notice.text}</Notice>}
      <section className="bo-panel">
        <div className="bo-panel__head">
          <div>
            <h1 className="bo-detail__client">{o.client}</h1>
            <p className="bo-mono">#{o.number}</p>
          </div>
          <StatusBadge status={o.status} large />
        </div>
        <dl className="bo-facts">
          <div>
            <dt>Créneau de retrait</dt>
            <dd className="bo-strong">{o.slotLabel}</dd>
          </div>
          <div>
            <dt>Payée le</dt>
            <dd>{o.paidLabel}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd className="bo-break">{o.email ? <a href={`mailto:${o.email}`}>{o.email}</a> : "—"}</dd>
          </div>
          <div>
            <dt>Téléphone</dt>
            <dd>{o.phone ? <a href={`tel:${o.phone.replace(/[^\d+]/g, "")}`}>{o.phone}</a> : "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="bo-panel" aria-labelledby="a-preparer">
        <h2 id="a-preparer" className="bo-panel__title">
          À préparer
        </h2>
        <ul className="bo-lines">
          {o.lines.map((l, i) => (
            <li key={i}>
              <span className="bo-qty" aria-label={`Quantité ${l.quantity}`}>
                {l.quantity}
              </span>
              <div className="bo-lines__name">
                <p>{l.name}</p>
                {l.format && <p className="bo-muted">{l.format}</p>}
              </div>
              <span className="bo-num">{formatPrice(l.totalCents)}</span>
            </li>
          ))}
        </ul>
        <dl className="bo-totals">
          {o.vat.map((v) => (
            <div key={v.rate}>
              <dt>Dont TVA {formatVat(v.rate)}</dt>
              <dd className="bo-num">{formatPrice(v.cents)}</dd>
            </div>
          ))}
          <div className="bo-totals__grand">
            <dt>Total payé</dt>
            <dd className="bo-num">{formatPrice(o.totalCents)}</dd>
          </div>
        </dl>
      </section>

      <section className="bo-panel" aria-labelledby="avancement">
        <h2 id="avancement" className="bo-panel__title">
          Avancement
        </h2>
        <ol className="bo-steps">
          {ORDER_STEPS.map((step, i) => {
            const current = ORDER_STEPS.indexOf(o.status);
            const done = i < current;
            const active = i === current;
            const reachable = canTransition(o.status, step);
            const label = (
              <>
                <span
                  className={`bo-step__mark bo-step__mark--${step}${done || active ? " is-on" : ""}`}
                  aria-hidden="true"
                >
                  {done || active ? "✓" : ""}
                </span>
                <span className="bo-step__label">{STATUS_LABELS[step]}</span>
                <span className="bo-step__note">{active ? "statut actuel" : done ? "fait" : ""}</span>
              </>
            );
            return (
              <li key={step}>
                {reachable ? (
                  <form method="post" action={`/api/admin/commandes/${o.id}/statut`}>
                    <input type="hidden" name="statut" value={step} />
                    <input type="hidden" name="retour" value={`/admin/commandes/${o.id}`} />
                    <button
                      type="submit"
                      className={`bo-step${done ? " is-done" : ""}`}
                      aria-label={`${STATUS_LABELS[step]} : ${i < current ? "revenir à cette étape" : "passer à cette étape"}`}
                    >
                      {label}
                    </button>
                  </form>
                ) : (
                  <div
                    className={`bo-step is-static${active ? " is-active" : ""}${done ? " is-done" : ""}`}
                    aria-current={active ? "step" : undefined}
                  >
                    {label}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <p className="bo-hint">
          Le passage à « Prête » envoie automatiquement un email au client. Les remboursements se font depuis votre
          tableau de bord Stripe.
        </p>
      </section>
    </>
  );
}

export function ErrorScreen({ title, text }: { title: string; text: string }) {
  return (
    <section className="bo-panel">
      <h1 className="bo-panel__title">{title}</h1>
      <p>{text}</p>
      <a className="bo-btn bo-btn--ghost" href="/admin">
        Retour aux commandes
      </a>
    </section>
  );
}
