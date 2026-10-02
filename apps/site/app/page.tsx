import type { Metadata } from "next";
import { pageTitle } from "@launchpadfactoryteam/seo";
import { HomePage } from "@launchpadfactoryteam/ui";
import { config, getSite } from "../lib/site";

export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getSite();
  return { title: pageTitle(null, config), description: content.pages.home.lead, alternates: { canonical: "/" } };
}

export default async function Home() {
  return <HomePage site={await getSite()} />;
}
