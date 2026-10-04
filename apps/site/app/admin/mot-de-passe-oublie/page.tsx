import type { Metadata } from "next";
import { ForgotScreen } from "@launchpadfactoryteam/ui/admin";
import { config } from "../../../lib/site";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { envoye } = await searchParams;
  return <ForgotScreen shopName={config.boutique.nom} sent={Boolean(envoye)} />;
}
