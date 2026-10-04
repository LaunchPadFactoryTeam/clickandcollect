import type { Metadata } from "next";
import { ResetScreen } from "@launchpadfactoryteam/ui/admin";
import { adminEnv, sha256Hex } from "../../../lib/admin/session";
import { passwordResets } from "../../../lib/admin/site-rpc";
import { config } from "../../../lib/site";

export const metadata: Metadata = { title: "Nouveau mot de passe", referrer: "same-origin" };

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { jeton = "", erreur } = await searchParams;
  const configured = adminEnv();
  const valid =
    Boolean(configured) &&
    /^[A-Za-z0-9_-]{43,}$/.test(jeton) &&
    (await passwordResets(configured!.e).isValid(await sha256Hex(jeton)));
  return <ResetScreen shopName={config.boutique.nom} token={jeton} valid={valid} error={erreur} />;
}
