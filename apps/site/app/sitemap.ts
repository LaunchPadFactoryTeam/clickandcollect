import type { MetadataRoute } from "next";
import { LEGAL_SLUGS } from "@launchpadfactoryteam/rgpd";
import { siteUrl, sitemapPaths } from "@launchpadfactoryteam/seo";
import { config, getContent } from "../lib/site";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl(config);
  return sitemapPaths(
    await getContent(),
    LEGAL_SLUGS.map((slug) => `/${slug}`),
  ).map((path) => ({ url: `${base}${path === "/" ? "" : path}` }));
}
