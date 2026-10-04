import type { Metadata } from "next";
import { LoginScreen } from "@launchpadfactoryteam/ui/admin";
import { config } from "../../../lib/site";

export const metadata: Metadata = { title: "Connexion" };

const NOTICES: Record<string, string> = {
  deconnecte: "Vous êtes déconnecté.",
  reinitialise: "Mot de passe enregistré : connectez-vous avec le nouveau.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const notice = Object.keys(NOTICES).find((k) => params[k]);
  return <LoginScreen shopName={config.boutique.nom} error={params.erreur} notice={notice && NOTICES[notice]} />;
}
