#!/usr/bin/env -S npx tsx
/**
 * lp-theme build <dossier-du-site> [--out <dossier>]
 * Valide la configuration, dérive le thème et écrit theme.css, tokens.json,
 * preview.html et les polices dans <dossier-du-site>/dist/theme (par défaut).
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ConfigError, loadConfig } from "@lp/config";
import { buildThemeFromLoaded, ThemeError } from "./build.ts";
import { previewHtml } from "./preview.ts";

const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8")) as {
  version: string;
};

function main(argv: string[]): number {
  const [command, target, ...rest] = argv;
  if (command !== "build" || !target) {
    console.error("Usage : lp-theme build <dossier-du-site> [--out <dossier>]");
    return 2;
  }
  const outFlag = rest.indexOf("--out");
  const outDir = resolve(outFlag >= 0 && rest[outFlag + 1] ? rest[outFlag + 1]! : join(target, "dist/theme"));

  try {
    const loaded = loadConfig(target, { coreVersion: pkg.version });
    const theme = buildThemeFromLoaded(loaded, { fontBaseUrl: "fonts/" });
    mkdirSync(join(outDir, "fonts"), { recursive: true });
    for (const font of loaded.fonts) copyFileSync(font.path, join(outDir, "fonts", font.fileName));
    writeFileSync(join(outDir, "theme.css"), theme.css);
    writeFileSync(join(outDir, "tokens.json"), JSON.stringify({ isDark: theme.palette.isDark, variables: theme.variables }, null, 2));
    writeFileSync(join(outDir, "preview.html"), previewHtml(loaded.config, theme));
    for (const w of theme.palette.warnings) {
      console.warn(`Avertissement : ${w.fg} sur ${w.bg} sous ${w.min}:1 (accent jamais seul porteur de sens)`);
    }
    console.log(`Thème de ${loaded.config.boutique.nom} écrit dans ${outDir}`);
    return 0;
  } catch (error) {
    if (error instanceof ConfigError || error instanceof ThemeError) {
      console.error(error.message);
      return 1;
    }
    throw error;
  }
}

process.exitCode = main(process.argv.slice(2));
