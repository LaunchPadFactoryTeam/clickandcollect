import { config } from "../lib/site";

// Site vide du lot 0 : rendu statique depuis la configuration, aucune logique métier.
export const dynamic = "force-static";

export default function Home() {
  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1
        style={{
          fontFamily: "var(--f-display)",
          fontSize: "var(--fs-display-1)",
          lineHeight: "var(--lh-display-1)",
          fontWeight: 400,
          margin: 0,
        }}
      >
        {config.boutique.nom}
      </h1>
      <p style={{ color: "var(--c-ink-muted)" }}>{config.boutique.adresse}</p>
      <p>
        <a href="/theme/preview.html" style={{ color: "var(--c-primary)" }}>
          Page de contrôle du thème
        </a>
      </p>
    </main>
  );
}
