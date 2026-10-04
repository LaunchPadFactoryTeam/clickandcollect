import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { categorySlugs, pageTitle, splitAddress } from "@launchpadfactoryteam/seo";
import { ShopPage } from "@launchpadfactoryteam/ui";
import { config, getContent, getSite } from "../../../../lib/site";

type Params = { params: Promise<{ categorie: string }> };

export const dynamic = "force-static";

export async function generateStaticParams() {
  return categorySlugs(await getContent()).map((categorie) => ({ categorie }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { categorie } = await params;
  const { catalog } = await getContent();
  const name = catalog.find((p) => p.category.slug === categorie)?.category.name;
  if (!name) return {};
  const city = splitAddress(config.boutique.adresse).city;
  return {
    title: pageTitle(`${name} à ${city}`, config),
    description: `${name} de ${config.boutique.nom}, à commander en ligne et à retirer en boutique à ${city}.`,
    alternates: { canonical: `/boutique/${categorie}` },
  };
}

export default async function Categorie({ params }: Params) {
  const { categorie } = await params;
  const site = await getSite();
  if (!site.content.catalog.some((p) => p.category.slug === categorie)) notFound();
  return <ShopPage site={site} category={categorie} />;
}
