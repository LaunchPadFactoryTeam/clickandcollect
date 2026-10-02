import type { ClientConfig } from "@launchpadfactoryteam/config";
import site from "../generated/site.json";

/**
 * Configuration du site, validée au build par `pnpm theme` (lp-theme --config-out) depuis LP_SITE_DIR,
 * par défaut l'exemple Maison Ferrand. Importée en JSON : aucun accès disque à l'exécution,
 * le Worker Cloudflare n'en a pas.
 */
export const config = site as ClientConfig;
