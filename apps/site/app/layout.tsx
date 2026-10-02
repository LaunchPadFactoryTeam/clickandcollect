import type { Metadata } from "next";
import type { ReactNode } from "react";
import { config } from "../lib/site";

export function generateMetadata(): Metadata {
  return {
    title: config.boutique.nom,
    description: `${config.boutique.nom}, épicerie fine — ${config.boutique.adresse}`,
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="stylesheet" href="/theme/theme.css" />
      </head>
      <body
        style={{
          margin: 0,
          background: "var(--c-bg)",
          color: "var(--c-ink)",
          fontFamily: "var(--f-body)",
          fontSize: "var(--fs-body)",
          lineHeight: "var(--lh-body)",
        }}
      >
        {children}
      </body>
    </html>
  );
}
