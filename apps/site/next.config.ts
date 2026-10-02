import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Les paquets du core sont publiés en TypeScript source.
  transpilePackages: ["@launchpadfactoryteam/config", "@launchpadfactoryteam/theme"],
  poweredByHeader: false,
};

export default nextConfig;

initOpenNextCloudflareForDev();
