import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEGAL_SLUGS, legalDocuments, type LegalSlug } from "@launchpadfactoryteam/rgpd";
import { pageTitle } from "@launchpadfactoryteam/seo";
import { LegalPage } from "@launchpadfactoryteam/ui";
import { config, getSite } from "../../../lib/site";

/** Pages légales générées depuis la configuration (lot 8) : /mentions-legales, /cgv, /confidentialite… */
export const dynamic = "force-static";

export function generateStaticParams() {
  return LEGAL_SLUGS.map((legal) => ({ legal }));
}

async function documentFor(slug: string) {
  if (!(LEGAL_SLUGS as readonly string[]).includes(slug)) return null;
  const { content } = await getSite();
  return legalDocuments({ config, shopEmail: content.pages.settings.email })[slug as LegalSlug];
}

export async function generateMetadata({ params }: { params: Promise<{ legal: string }> }): Promise<Metadata> {
  const { legal } = await params;
  const doc = await documentFor(legal);
  if (!doc) return {};
  return { title: pageTitle(doc.title, config), description: doc.description, alternates: { canonical: `/${legal}` } };
}

export default async function Legal({ params }: { params: Promise<{ legal: string }> }) {
  const { legal } = await params;
  const doc = await documentFor(legal);
  if (!doc) notFound();
  return <LegalPage site={await getSite()} doc={doc} />;
}
