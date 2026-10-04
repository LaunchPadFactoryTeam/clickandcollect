import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { groceryStoreJsonLd, pageTitle, siteUrl } from "@launchpadfactoryteam/seo";
import { JsonLd, SkipLink } from "@launchpadfactoryteam/ui";
import "@launchpadfactoryteam/ui/styles/base.css";
import "@launchpadfactoryteam/ui/styles/a.css";
import "@launchpadfactoryteam/ui/styles/b.css";
import "@launchpadfactoryteam/ui/styles/c.css";
import { config, fontPreload, getContent } from "../../lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl(config)),
  title: { default: pageTitle(null, config), template: "%s" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const content = await getContent();
  const umami = config.audience.umami_website_id;
  return (
    <html lang="fr">
      <head>
        <link rel="stylesheet" href="/theme/theme.css" />
        {fontPreload.map((href) => (
          <link key={href} rel="preload" as="font" type="font/woff2" href={`/theme/${href}`} crossOrigin="" />
        ))}
        <JsonLd data={groceryStoreJsonLd(config, content)} />
        {umami && <script defer src={config.audience.umami_src} data-website-id={umami} />}
      </head>
      <body>
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
