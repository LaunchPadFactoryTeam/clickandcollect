import { LEGAL_VERSION, type LegalBlock, type LegalDocument } from "@launchpadfactoryteam/rgpd";
import { PageShell } from "../chrome.tsx";
import type { Site } from "../shared.tsx";
import { variantOf } from "../variants.tsx";

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${iso}T00:00:00Z`),
  );

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") return <p>{block}</p>;
  if ("list" in block) {
    return (
      <ul>
        {block.list.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <dl className="legal__facts">
      {block.facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Page légale (lot 8), dans la variante de la page Contact de la boutique. */
export function LegalPage({ site, doc }: { site: Site; doc: LegalDocument }) {
  return (
    <PageShell site={site} variant={variantOf(site.config, "contact")} current="legal">
      <article className="legal">
        <h1 className="legal__title">{doc.title}</h1>
        {doc.sections.map((s) => (
          <section key={s.heading} className="legal__section">
            <h2>{s.heading}</h2>
            {s.blocks.map((b, i) => (
              <Block key={i} block={b} />
            ))}
          </section>
        ))}
        <p className="legal__updated">Dernière mise à jour : {longDate(LEGAL_VERSION)}</p>
      </article>
    </PageShell>
  );
}
