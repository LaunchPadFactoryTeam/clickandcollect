import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { productDescription, productJsonLd, productTitle } from "@launchpadfactoryteam/seo";
import { JsonLd, ProductPage } from "@launchpadfactoryteam/ui";
import { config, getContent, getSite } from "../../../lib/site";

type Params = { params: Promise<{ slug: string }> };

export const dynamic = "force-static";

export async function generateStaticParams() {
  return (await getContent()).catalog.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = (await getContent()).catalog.find((p) => p.slug === slug);
  if (!product) return {};
  return {
    title: productTitle(product, config),
    description: productDescription(product, config),
    alternates: { canonical: `/produits/${slug}` },
    openGraph: { type: "website", title: product.name, images: product.images?.slice(0, 1).map((i) => i.url) },
  };
}

export default async function Fiche({ params }: Params) {
  const { slug } = await params;
  const site = await getSite();
  const product = site.content.catalog.find((p) => p.slug === slug);
  if (!product) notFound();
  return (
    <>
      <JsonLd data={productJsonLd(product, config)} />
      <ProductPage site={site} product={product} />
    </>
  );
}
