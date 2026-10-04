import type { Metadata } from "next";
import { pageTitle } from "@launchpadfactoryteam/seo";
import { CartPage } from "@launchpadfactoryteam/ui";
import { config, getSite } from "../../../lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: pageTitle("Votre panier", config),
  // Page propre à chaque visiteur : rien à indexer.
  robots: { index: false, follow: true },
  alternates: { canonical: "/panier" },
};

export default async function Panier() {
  return <CartPage site={await getSite()} />;
}
