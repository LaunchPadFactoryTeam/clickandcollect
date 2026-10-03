import { PageShell } from "../chrome.tsx";
import { Placeholder, Required, type Site, type Variant } from "../shared.tsx";
import { ContactFacts } from "./facts.tsx";

const LABELS: Record<Variant, { name: string; email: string; message: string; submit: string; consent: string }> = {
  A: {
    name: "Nom",
    email: "Email",
    message: "Message",
    submit: "Envoyer",
    consent:
      "J'accepte que mes coordonnées soient utilisées pour répondre à ce message. Elles ne servent à rien d'autre et sont effacées sous trois ans.",
  },
  B: {
    name: "Nom",
    email: "Email",
    message: "Message",
    submit: "Envoyer",
    consent:
      "J'accepte que mes coordonnées soient utilisées pour répondre à ce message, et à rien d'autre. Effacement sous trois ans.",
  },
  C: {
    name: "Votre nom",
    email: "Votre email",
    message: "Votre message",
    submit: "Envoyer le message",
    consent:
      "J'accepte que mes coordonnées servent à répondre à ce message, et à rien d'autre. Elles sont effacées sous trois ans.",
  },
};

/**
 * Formulaire de contact : champs étiquetés, obligatoires annoncés, consentement non pré-coché.
 * Envoi par POST vers /api/contact, sans JavaScript ; un champ piège invisible écarte les robots.
 */
function ContactForm({ variant }: { variant: Variant }) {
  const v = variant.toLowerCase();
  const l = LABELS[variant];
  const id = (name: string) => `${v}-${name}`;
  return (
    <form className={`contact-form contact-form--${v}`} method="post" action="/api/contact">
      <div className="form-field">
        <label htmlFor={id("nom")}>
          {l.name}
          <Required />
        </label>
        <input id={id("nom")} name="nom" type="text" required autoComplete="name" />
      </div>
      <div className="form-field">
        <label htmlFor={id("email")}>
          {l.email}
          <Required />
        </label>
        <input id={id("email")} name="email" type="email" required autoComplete="email" />
      </div>
      <div className="form-field">
        <label htmlFor={id("message")}>
          {l.message}
          <Required />
        </label>
        <textarea id={id("message")} name="message" rows={6} required />
      </div>
      {/* Champ piège : invisible et hors du parcours clavier ; un humain le laisse vide. */}
      <div className="hp" aria-hidden="true">
        <label htmlFor={id("site-web")}>Ne pas remplir</label>
        <input id={id("site-web")} name="site_web" type="text" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="consent">
        <input type="checkbox" name="consentement" value="oui" required />
        <span>
          {l.consent} <a href="/confidentialite">Politique de confidentialité</a>.
        </span>
      </label>
      <button type="submit" className={`btn ${v}-btn ${v}-btn--primary contact-form__submit`}>
        {l.submit}
      </button>
    </form>
  );
}

export function ContactA({ site }: { site: Site }) {
  const { contact } = site.content.pages;
  return (
    <PageShell site={site} variant="A" current="contact">
      <section className="a-wrap a-page">
        <h1 className="a-title">{contact.title}</h1>
        <p className="a-intro">{contact.lead}</p>
        <div className="a-contact">
          <ContactForm variant="A" />
          <div>
            <Placeholder ratio="4/3" className="a-frame a-contact__map" />
            <ContactFacts site={site} variant="A" />
          </div>
        </div>
      </section>
    </PageShell>
  );
}

export function ContactB({ site }: { site: Site }) {
  const { contact } = site.content.pages;
  return (
    <PageShell site={site} variant="B" current="contact">
      <section className="b-contact">
        <div className="b-contact__form">
          <h1 className="b-title">{contact.title}</h1>
          <p className="b-intro">{contact.lead}</p>
          <ContactForm variant="B" />
        </div>
        <div className="b-contact__side">
          <Placeholder className="b-contact__map" />
          <ContactFacts site={site} variant="B" />
        </div>
      </section>
    </PageShell>
  );
}

export function ContactC({ site }: { site: Site }) {
  const { contact } = site.content.pages;
  return (
    <PageShell site={site} variant="C" current="contact">
      <section className="c-page">
        <h1 className="c-title">{contact.title}</h1>
        <p className="c-intro">{contact.lead}</p>
        <div className="c-contact">
          <div className="c-card c-contact__form">
            <ContactForm variant="C" />
          </div>
          <div className="c-contact__side">
            <Placeholder ratio="4/3" className="c-card c-card--warm" />
            <ContactFacts site={site} variant="C" />
          </div>
        </div>
      </section>
    </PageShell>
  );
}

/** Après l'envoi du formulaire de contact (redirection depuis /api/contact). */
export function ContactSent({ site, variant }: { site: Site; variant: Variant }) {
  const v = variant.toLowerCase();
  return (
    <PageShell site={site} variant={variant} current="contact">
      <section className={`cart-page cart-page--${v}`}>
        <h1 className={`cart-page__title ${v}-cart-title`}>Message envoyé</h1>
        <div className={`confirm confirm--${v}`}>
          <p className="confirm__lead">
            Merci, votre message est bien parti. Nous vous répondons par email au plus vite.
          </p>
          <a className={`btn ${v}-btn ${v}-btn--ghost confirm__back`} href="/">
            Retour à l'accueil
          </a>
        </div>
      </section>
    </PageShell>
  );
}
