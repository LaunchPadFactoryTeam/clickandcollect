import type { Metadata } from "next";
import { pageTitle } from "@launchpadfactoryteam/seo";
import { PaymentPage } from "@launchpadfactoryteam/ui";
import { config, getSite } from "../../../lib/site";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: pageTitle("Paiement", config),
  robots: { index: false, follow: false },
};

export default async function Paiement() {
  return <PaymentPage site={await getSite()} />;
}
