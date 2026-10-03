import type { Metadata } from "next";
import { pageTitle } from "@launchpadfactoryteam/seo";
import { ContactSentPage } from "@launchpadfactoryteam/ui";
import { config, getSite } from "../../../lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: pageTitle("Message envoyé", config),
  robots: { index: false, follow: true },
};

export default async function ContactMerci() {
  return <ContactSentPage site={await getSite()} />;
}
