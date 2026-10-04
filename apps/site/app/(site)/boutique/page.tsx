import type { Metadata } from "next";
import { pageTitle } from "@launchpadfactoryteam/seo";
import { ShopPage } from "@launchpadfactoryteam/ui";
import { config, getSite } from "../../../lib/site";

export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getSite();
  return {
    title: pageTitle(content.pages.shop.title, config),
    description: content.pages.shop.lead,
    alternates: { canonical: "/boutique" },
  };
}

export default async function Boutique() {
  return <ShopPage site={await getSite()} />;
}
