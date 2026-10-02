import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse as parseYaml, YAMLParseError } from "yaml";
import type { ClientConfig, Police } from "./schema.ts";
import { ConfigError, type ConfigIssue, validateConfig, type ValidateOptions } from "./validate.ts";

export const CONFIG_FILE = "launchpad.config.yaml";
export const FONTS_DIR = "assets/fonts";

export type FontRole = "titres" | "texte";

export interface FontFile {
  role: FontRole;
  famille: string;
  graisse: number;
  /** Chemin absolu du fichier WOFF2. */
  path: string;
  /** Nom du fichier, ex. "work-sans-400.woff2". */
  fileName: string;
}

export interface LoadedConfig {
  config: ClientConfig;
  rootDir: string;
  logoPath: string;
  fonts: FontFile[];
}

/** "Playfair Display" -> "playfair-display" */
export function fontSlug(famille: string): string {
  return famille
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Fichiers WOFF2 attendus pour une configuration : assets/fonts/<famille>-<graisse>.woff2 */
export function expectedFontFiles(config: ClientConfig, rootDir: string): FontFile[] {
  const files: FontFile[] = [];
  const seen = new Set<string>();
  for (const role of ["titres", "texte"] as const) {
    const police: Police = config.design.typographies[role];
    for (const graisse of police.graisses) {
      const fileName = `${fontSlug(police.famille)}-${graisse}.woff2`;
      if (seen.has(fileName)) continue;
      seen.add(fileName);
      files.push({ role, famille: police.famille, graisse, fileName, path: join(rootDir, FONTS_DIR, fileName) });
    }
  }
  return files;
}

function isWoff2(path: string): boolean {
  const head = readFileSync(path).subarray(0, 4).toString("latin1");
  return head === "wOF2";
}

/** Vérifie la présence et le format du logo et des polices. */
export function checkAssets(config: ClientConfig, rootDir: string): { logoPath: string; fonts: FontFile[] } {
  const issues: ConfigIssue[] = [];
  const logoPath = resolve(rootDir, config.design.logo);
  if (!existsSync(logoPath)) {
    issues.push({ path: "design.logo", message: `Fichier introuvable : ${config.design.logo}` });
  } else if (!readFileSync(logoPath, "utf8").includes("<svg")) {
    issues.push({ path: "design.logo", message: `Le fichier ${config.design.logo} n'est pas un SVG lisible` });
  }
  const fonts = expectedFontFiles(config, rootDir);
  for (const font of fonts) {
    const key = `design.typographies.${font.role}`;
    if (!existsSync(font.path)) {
      issues.push({ path: key, message: `Police manquante : ${FONTS_DIR}/${font.fileName}` });
    } else if (!isWoff2(font.path)) {
      issues.push({ path: key, message: `${FONTS_DIR}/${font.fileName} n'est pas un fichier WOFF2` });
    }
  }
  if (issues.length) throw new ConfigError(issues);
  return { logoPath, fonts };
}

/**
 * Charge et valide la configuration d'un site.
 * `target` est le dossier du site ou le chemin du fichier YAML.
 */
export function loadConfig(target: string, options: Omit<ValidateOptions, "source"> = {}): LoadedConfig {
  const file = target.endsWith(".yaml") || target.endsWith(".yml") ? resolve(target) : resolve(target, CONFIG_FILE);
  const rootDir = dirname(file);
  if (!existsSync(file)) throw new ConfigError([{ path: "", message: `Fichier introuvable : ${file}` }]);

  let raw: unknown;
  try {
    raw = parseYaml(readFileSync(file, "utf8"));
  } catch (error) {
    const message = error instanceof YAMLParseError ? error.message : String(error);
    throw new ConfigError([{ path: "", message: `YAML illisible : ${message}` }], file);
  }

  const config = validateConfig(raw, { ...options, source: file });
  const { logoPath, fonts } = checkAssets(config, rootDir);
  return { config, rootDir, logoPath, fonts };
}
