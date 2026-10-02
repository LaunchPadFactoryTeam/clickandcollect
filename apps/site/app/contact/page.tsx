import type { Metadata } from "next";
import { pageTitle } from "@launchpadfactoryteam/seo";
import { ContactPage } from "@launchpadfactoryteam/ui";
import { config, getSite } from "../../lib/site";

export const dynamic = "force-static";

export async function generateMetadata(): Promise<Metadata> {
  const { content } = await getSite();
  return { title: pageTitle("Contact", config), description: content.pages.contact.lead, alternates: { canonical: "/contact" } };
}

export default async function Contact() {
  return <ContactPage site={await getSite()} />;
}
