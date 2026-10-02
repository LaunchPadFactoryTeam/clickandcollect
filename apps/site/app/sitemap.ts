import type { MetadataRoute } from "next";
import { siteUrl, sitemapPaths } from "@launchpadfactoryteam/seo";
import { config, getContent } from "../lib/site";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl(config);
  return sitemapPaths(await getContent()).map((path) => ({ url: `${base}${path === "/" ? "" : path}` }));
}
