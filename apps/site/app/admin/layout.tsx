import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/geist/index.css";
import "@fontsource-variable/geist-mono/index.css";
import "@launchpadfactoryteam/ui/styles/admin.css";
import { config } from "../../lib/site";

/** Back-office commerçant : mise en page racine distincte du site (ni charte, ni polices, ni JSON-LD de la boutique). */
export const metadata: Metadata = {
  title: { default: `Back-office · ${config.boutique.nom}`, template: `%s · Back-office · ${config.boutique.nom}` },
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#EFF1F4" };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body className="bo-body">
        <a className="bo-skip" href="#contenu">
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
