import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ConfigError, loadConfig } from "@launchpadfactoryteam/config";
import { processingAgreement, processingRecord } from "./documents.ts";

const USAGE = `Usage : lp-rgpd documents <dossier du site> [dossier de sortie]

Écrit, depuis launchpad.config.yaml, le contrat de sous-traitance et la fiche du registre des traitements
de la boutique (Markdown, à relire et signer). Sortie par défaut : <dossier du site>/rgpd.`;

/** Commande lp-rgpd ; renvoie le code de sortie. */
export async function main(args: string[]): Promise<number> {
  const [command, siteDir, outArg] = args;
  if (command !== "documents" || !siteDir) {
    console.error(USAGE);
    return 2;
  }
  try {
    const { config } = loadConfig(resolve(siteDir));
    const out = resolve(outArg ?? join(siteDir, "rgpd"));
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "contrat-sous-traitance.md"), processingAgreement(config));
    writeFileSync(join(out, "registre-des-traitements.md"), processingRecord(config));
    console.log(`Documents écrits dans ${out} : contrat-sous-traitance.md, registre-des-traitements.md`);
    return 0;
  } catch (error) {
    console.error(error instanceof ConfigError ? error.message : String(error));
    return 1;
  }
}
