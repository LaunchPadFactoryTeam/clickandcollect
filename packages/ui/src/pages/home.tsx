import { PageShell } from "../chrome.tsx";
import { Placeholder, type Site } from "../shared.tsx";
import { ProductCard } from "./cards.tsx";
import { PickupFacts } from "./facts.tsx";

function featured(site: Site) {
  const byId = new Map(site.content.catalog.map((p) => [p.id, p]));
  return site.content.pages.home.featuredProductIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}

/** Template A — Éditorial : grande typographie, longues respirations, le récit porte la page. */
export function HomeA({ site }: { site: Site }) {
  const { home } = site.content.pages;
  return (
    <PageShell site={site} variant="A" current="accueil">
      <section className="a-hero a-wrap">
        <p className="a-eyebrow">{home.eyebrow}</p>
        <h1 className="a-display">{home.title}</h1>
        <div className="a-hero__row">
          <p className="a-lead">{home.lead}</p>
          <div className="a-actions">
            <a className="btn a-btn a-btn--primary" href="/boutique">
              {home.ctaShop}
            </a>
            <a className="btn a-btn a-btn--ghost" href="/epicerie">
              {home.ctaStory}
            </a>
          </div>
        </div>
      </section>
      <div className="a-wrap a-hero__image">
        <Placeholder ratio="21/9" className="a-frame" />
      </div>
      <section className="a-band a-band--surface" aria-labelledby="selection">
        <div className="a-wrap a-section">
          <div className="a-section__head">
            <h2 id="selection" className="a-h2">
              {home.featuredTitle}
            </h2>
            <a className="a-link" href="/boutique">
              Tout le catalogue
            </a>
          </div>
          <ul className="products products--a products--featured">
            {featured(site).map((p, i) => (
              <li key={p.id}>
                <ProductCard product={p} site={site} variant="A" priority={i === 0} />
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="a-band" aria-labelledby="histoire">
        <div className="a-wrap a-section a-split">
          <div>
            <h2 id="histoire" className="a-eyebrow">
              {home.story.eyebrow}
            </h2>
            <blockquote className="a-quote">
              <p>« {home.story.quote} »</p>
            </blockquote>
            <p className="a-muted">{home.story.author}</p>
            <a className="btn a-btn a-btn--ghost" href="/epicerie">
              {home.story.cta}
            </a>
          </div>
          <Placeholder ratio="4/3" className="a-frame" />
        </div>
      </section>
      <section className="a-band a-band--surface" aria-labelledby="retrait">
        <div className="a-wrap a-section">
          <h2 id="retrait" className="a-h2 a-h2--small">
            {home.pickupTitle}
          </h2>
          <PickupFacts site={site} variant="A" />
        </div>
      </section>
    </PageShell>
  );
}

/** Template B — Immersif : photographie plein cadre, cartels superposés, fond sombre. */
export function HomeB({ site }: { site: Site }) {
  const { home } = site.content.pages;
  return (
    <PageShell site={site} variant="B" current="accueil">
      <section className="b-hero">
        <Placeholder className="b-hero__bg" />
        <div className="b-hero__in b-wrap">
          <p className="b-eyebrow">{home.eyebrow}</p>
          <h1 className="b-display">{home.title}</h1>
          <p className="b-lead">{home.lead}</p>
          <div className="b-actions">
            <a className="btn b-btn b-btn--primary" href="/boutique">
              {home.ctaShop}
            </a>
            <a className="btn b-btn b-btn--ghost" href="/epicerie">
              {home.ctaStory}
            </a>
          </div>
        </div>
      </section>
      <section className="b-band" aria-labelledby="selection">
        <div className="b-wrap b-section">
          <div className="b-section__head">
            <h2 id="selection" className="b-h2">
              {home.featuredTitle}
            </h2>
            <a className="b-link" href="/boutique">
              Tout le catalogue →
            </a>
          </div>
          <ul className="products products--b products--featured">
            {featured(site).map((p, i) => (
              <li key={p.id}>
                <ProductCard product={p} site={site} variant="B" priority={i === 0} />
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="b-band b-band--surface" aria-labelledby="maison">
        <div className="b-split">
          <Placeholder className="b-split__img" />
          <div className="b-split__text">
            <h2 id="maison" className="b-eyebrow">
              {home.story.eyebrow}
            </h2>
            <blockquote className="b-quote">
              <p>« {home.story.quote} »</p>
            </blockquote>
            {home.story.text && <p className="b-muted b-split__p">{home.story.text}</p>}
            <a className="btn b-btn b-btn--ghost b-btn--solidline" href="/epicerie">
              {home.story.cta}
            </a>
          </div>
        </div>
      </section>
      <section aria-labelledby="retrait">
        <div className="b-wrap b-section">
          <h2 id="retrait" className="b-h2 b-h2--small">
            {home.pickupTitle}
          </h2>
          <PickupFacts site={site} variant="B" />
        </div>
      </section>
    </PageShell>
  );
}

/** Template C — Chaleureux artisanal : blocs arrondis, fond crème, grille en mosaïque. */
export function HomeC({ site }: { site: Site }) {
  const { home } = site.content.pages;
  return (
    <PageShell site={site} variant="C" current="accueil">
      <section className="c-mosaic">
        <div className="c-card c-hero">
          <p className="c-chip">{home.eyebrow}</p>
          <h1 className="c-display">{home.title}</h1>
          <p className="c-lead">{home.lead}</p>
          <div className="c-actions">
            <a className="btn c-btn c-btn--primary" href="/boutique">
              {home.ctaShop}
            </a>
            <a className="btn c-btn c-btn--ghost" href="/epicerie">
              {home.ctaStory}
            </a>
          </div>
        </div>
        <Placeholder className="c-card c-card--warm c-hero__img" />
      </section>
      {home.highlights && (
        <ul className="c-tiles" aria-label="En bref">
          {home.highlights.map((h) => (
            <li key={h.label} className="c-card c-tile">
              <p className="c-tile__value">{h.value}</p>
              <p className="c-tile__label">{h.label}</p>
            </li>
          ))}
        </ul>
      )}
      <section className="c-section" aria-labelledby="selection">
        <div className="c-section__head">
          <h2 id="selection" className="c-h2">
            {home.featuredTitle}
          </h2>
          <a className="c-link" href="/boutique">
            Tout voir →
          </a>
        </div>
        <ul className="products products--c products--featured">
          {featured(site).map((p, i) => (
            <li key={p.id}>
              <ProductCard product={p} site={site} variant="C" priority={i === 0} />
            </li>
          ))}
        </ul>
      </section>
      <section className="c-card c-card--warm c-story c-section" aria-labelledby="histoire">
        <div>
          <h2 id="histoire" className="c-kicker">
            {home.story.eyebrow}
          </h2>
          <blockquote className="c-quote">
            <p>« {home.story.quote} »</p>
          </blockquote>
          <p className="c-muted">{home.story.author}</p>
          <a className="btn c-btn c-btn--surface" href="/epicerie">
            {home.story.cta}
          </a>
        </div>
        <Placeholder ratio="4/3" className="c-round" />
      </section>
      <section className="c-section" aria-labelledby="retrait">
        <h2 id="retrait" className="c-h2 c-h2--small">
          {home.pickupTitle}
        </h2>
        <PickupFacts site={site} variant="C" />
      </section>
    </PageShell>
  );
}
