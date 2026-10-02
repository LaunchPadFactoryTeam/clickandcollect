import type { Figure } from "@launchpadfactoryteam/content";
import { PageShell } from "../chrome.tsx";
import { Placeholder, type Site, type Variant } from "../shared.tsx";

function Figures({ figures, variant }: { figures: readonly Figure[]; variant: Variant }) {
  if (!figures.length) return null;
  return (
    <ul className={`figures figures--${variant.toLowerCase()}`} aria-label="Chiffres clés">
      {figures.map((f) => (
        <li key={f.label}>
          <p className="figures__value">{f.value}</p>
          <p className="figures__label">{f.label}</p>
        </li>
      ))}
    </ul>
  );
}

const Paragraphs = ({ items }: { items: readonly string[] }) => (
  <>
    {items.map((p) => (
      <p key={p.slice(0, 40)}>{p}</p>
    ))}
  </>
);

/** A : récit en colonne de lecture, photo légendée après deux paragraphes, citation, chiffres. */
export function StoryA({ site }: { site: Site }) {
  const { story } = site.content.pages;
  const [first, ...rest] = [story.paragraphs.slice(0, 2), story.paragraphs.slice(2)];
  return (
    <PageShell site={site} variant="A" current="epicerie">
      <article className="a-wrap a-page a-story">
        <p className="a-eyebrow">{story.eyebrow}</p>
        <h1 className="a-display a-display--story">{story.title}</h1>
        <div className="a-prose">
          <Paragraphs items={first} />
        </div>
        <figure className="a-figure">
          <Placeholder ratio="16/9" className="a-frame" />
          {story.caption && <figcaption>{story.caption}</figcaption>}
        </figure>
        {rest.flat().length > 0 && (
          <div className="a-prose">
            <Paragraphs items={rest.flat()} />
          </div>
        )}
        {story.quote && (
          <blockquote className="a-pullquote">
            <p>« {story.quote.text} »</p>
            <footer>{story.quote.author}</footer>
          </blockquote>
        )}
        <Figures figures={story.figures} variant="A" />
      </article>
    </PageShell>
  );
}

/** B : bandeau plein cadre, récit, chiffres en tableau, triptyque photo. */
export function StoryB({ site }: { site: Site }) {
  const { story } = site.content.pages;
  return (
    <PageShell site={site} variant="B" current="epicerie">
      <article>
        <section className="b-hero b-hero--short">
          <Placeholder className="b-hero__bg" />
          <div className="b-hero__in b-wrap">
            <p className="b-eyebrow">{story.eyebrow}</p>
            <h1 className="b-display b-display--story">{story.title}</h1>
          </div>
        </section>
        <div className="b-wrap b-section">
          <div className="b-prose">
            <Paragraphs items={story.paragraphs} />
          </div>
          {story.quote && (
            <blockquote className="b-quote b-quote--story">
              <p>« {story.quote.text} »</p>
              <footer>{story.quote.author}</footer>
            </blockquote>
          )}
          <Figures figures={story.figures} variant="B" />
          <div className="b-triptych" aria-hidden="true">
            <Placeholder ratio="4/5" />
            <Placeholder ratio="4/5" />
            <Placeholder ratio="4/5" />
          </div>
        </div>
      </article>
    </PageShell>
  );
}

/** C : récit à la première personne dans une carte, mosaïque photo, chiffres en tuiles. */
export function StoryC({ site }: { site: Site }) {
  const { story } = site.content.pages;
  return (
    <PageShell site={site} variant="C" current="epicerie">
      <article className="c-page">
        <div className="c-card c-story-card">
          <p className="c-chip">{story.eyebrow}</p>
          <h1 className="c-display c-display--story">{story.title}</h1>
          <div className="c-prose">
            <Paragraphs items={story.paragraphs} />
          </div>
          {story.quote && (
            <blockquote className="c-quote">
              <p>« {story.quote.text} »</p>
              <footer>{story.quote.author}</footer>
            </blockquote>
          )}
        </div>
        <div className="c-triptych" aria-hidden="true">
          <Placeholder ratio="1/1" className="c-card c-card--warm" />
          <Placeholder ratio="1/1" className="c-card c-card--warm" />
          <Placeholder ratio="1/1" className="c-card c-card--warm" />
        </div>
        <Figures figures={story.figures} variant="C" />
      </article>
    </PageShell>
  );
}
