import type { ReactNode } from "react";
import { displayPhone, splitAddress } from "@launchpadfactoryteam/seo";
import { EVIN_TEXT, type Site, type Variant } from "./shared.tsx";

export type Section = "accueil" | "boutique" | "epicerie" | "contact";

/** Libellés propres à chaque template ; les liens et les pages sont les mêmes. */
const LABELS: Record<
  Variant,
  {
    nav: Record<Exclude<Section, "accueil">, string>;
    footerShop: string;
    footerAll: string;
    footerStory: string;
    data: string;
  }
> = {
  A: {
    nav: { boutique: "La boutique", epicerie: "Notre histoire", contact: "Contact" },
    footerShop: "Boutique",
    footerAll: "Tous les produits",
    footerStory: "Notre histoire",
    data: "Ce site n'utilise aucun cookie publicitaire et ne dépose aucun traceur. La mesure d'audience est anonyme.",
  },
  B: {
    nav: { boutique: "Catalogue", epicerie: "Maison", contact: "Contact" },
    footerShop: "Boutique",
    footerAll: "Catalogue",
    footerStory: "La maison",
    data: "Aucun cookie publicitaire, aucun traceur. La mesure d'audience est anonyme.",
  },
  C: {
    nav: { boutique: "Nos produits", epicerie: "Notre histoire", contact: "Contact" },
    footerShop: "La boutique",
    footerAll: "Nos produits",
    footerStory: "Notre histoire",
    data: "Aucun cookie publicitaire, aucun traceur. Notre mesure d'audience est anonyme.",
  },
};

export const LEGAL_LINKS = [
  ["/confidentialite", "Politique de confidentialité"],
  ["/cgv", "Conditions générales de vente"],
  ["/mentions-legales", "Mentions légales"],
  ["/cookies", "Gestion des cookies"],
  ["/accessibilite", "Accessibilité : conformité partielle"],
] as const;

const SECTION_HREF: Record<Exclude<Section, "accueil">, string> = {
  boutique: "/boutique",
  epicerie: "/epicerie",
  contact: "/contact",
};

export function navLabel(variant: Variant, section: Exclude<Section, "accueil">): string {
  return LABELS[variant].nav[section];
}

export function Header({ site, variant, current }: { site: Site; variant: Variant; current: Section }) {
  const v = variant.toLowerCase();
  return (
    <header className={`hdr hdr--${v}`}>
      <div className="hdr__in">
        <a className="hdr__brand" href="/" aria-current={current === "accueil" ? "page" : undefined}>
          {site.config.boutique.nom}
          <span className="hdr__tag">{site.content.pages.settings.tagline}</span>
        </a>
        <nav aria-label="Principale">
          <ul className="hdr__nav">
            {(Object.keys(SECTION_HREF) as (keyof typeof SECTION_HREF)[]).map((s) => (
              <li key={s}>
                <a href={SECTION_HREF[s]} aria-current={current === s ? "page" : undefined}>
                  {LABELS[variant].nav[s]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

export function Footer({ site, variant }: { site: Site; variant: Variant }) {
  const v = variant.toLowerCase();
  const { config } = site;
  const address = splitAddress(config.boutique.adresse);
  const labels = LABELS[variant];
  return (
    <footer className={`ftr ftr--${v}`}>
      <div className="ftr__in">
        <div className="ftr__cols">
          <div>
            <p className="ftr__brand">{config.boutique.nom}</p>
            <p className="ftr__addr">
              {address.street}
              <br />
              {address.postalCode} {address.city}
              <br />
              {displayPhone(config.boutique.telephone)}
            </p>
          </div>
          <div>
            <h2 className="ftr__title">{labels.footerShop}</h2>
            <ul className="ftr__list">
              <li>
                <a href="/boutique">{labels.footerAll}</a>
              </li>
              <li>
                <a href="/epicerie">{labels.footerStory}</a>
              </li>
              <li>
                <a href="/contact">Contact</a>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="ftr__title">Informations légales</h2>
            <ul className="ftr__list">
              {LEGAL_LINKS.map(([href, label]) => (
                <li key={href}>
                  <a href={href}>{label}</a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="ftr__title">Vos données</h2>
            <p className="ftr__text">{labels.data}</p>
            <a className="ftr__rights" href="/mes-droits">
              Exercer mes droits
            </a>
          </div>
        </div>
        <p className="ftr__legal">
          {config.features.alcool && <>{EVIN_TEXT} · </>}© {new Date().getFullYear()} {config.boutique.nom} · Site
          réalisé par LaunchPadFactory
        </p>
      </div>
    </footer>
  );
}

/** Cadre d'une page : en-tête, contenu principal (cible du lien d'évitement), pied de page. */
export function PageShell({
  site,
  variant,
  current,
  children,
}: {
  site: Site;
  variant: Variant;
  current: Section;
  children: ReactNode;
}) {
  const v = variant.toLowerCase();
  return (
    <div className={`site site--${v}`} data-variant={variant}>
      <Header site={site} variant={variant} current={current} />
      <main id="contenu" tabIndex={-1} className={`main main--${v}`}>
        {children}
      </main>
      <Footer site={site} variant={variant} />
    </div>
  );
}
