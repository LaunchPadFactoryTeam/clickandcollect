import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Les paquets du core sont publiés en TypeScript source.
  transpilePackages: [
    "@launchpadfactoryteam/commerce",
    "@launchpadfactoryteam/config",
    "@launchpadfactoryteam/content",
    "@launchpadfactoryteam/emails",
    "@launchpadfactoryteam/psp",
    "@launchpadfactoryteam/rgpd",
    "@launchpadfactoryteam/seo",
    "@launchpadfactoryteam/ui",
  ],
  poweredByHeader: false,
  // Pas de AGENTS.md ni CLAUDE.md générés par `next dev` dans le dépôt.
  agentRules: false,
  // Sortie attendue par OpenNext ; build:worker réutilise ce build (--skipNextBuild) au lieu de le relancer.
  output: "standalone",
};

export default nextConfig;

initOpenNextCloudflareForDev();
