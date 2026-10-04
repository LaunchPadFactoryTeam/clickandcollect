import type { Metadata } from "next";
import { pageTitle } from "@launchpadfactoryteam/seo";
import { StoryPage } from "@launchpadfactoryteam/ui";
import { config, getSite } from "../../../lib/site";

export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getSite();
  return {
    title: pageTitle(content.pages.story.title, config),
    description: content.pages.story.paragraphs[0],
    alternates: { canonical: "/epicerie" },
  };
}

export default async function Epicerie() {
  return <StoryPage site={await getSite()} />;
}
