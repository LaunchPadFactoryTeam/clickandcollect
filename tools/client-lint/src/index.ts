import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

/**
 * Un repo client ne contient que de la configuration, des contenus et des assets.
 * Tout code vit dans le core ; seule exception : une surcharge de style documentée.
 */

export interface LintIssue {
  file: string;
  message: string;
}

/** Dossiers produits par les outils, jamais versionnés. */
const IGNORED_DIRS = new Set(["node_modules", ".git", ".next", ".open-next", ".wrangler", "dist", ".turbo"]);

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte"]);

/** Dossier des surcharges de style autorisées. */
export const STYLES_DIR = "styles";

/** Première ligne obligatoire d'une surcharge : elle dit pourquoi elle existe. */
export const OVERRIDE_HEADER = /^\/\*\s*Surcharge documentée\s*:\s*\S.*\*\//;

function walk(dir: string, root: string, out: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) walk(join(dir, entry.name), root, out);
    } else {
      out.push(relative(root, join(dir, entry.name)).split(sep).join("/"));
    }
  }
  return out;
}

export function lintClientRepo(root: string): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const file of walk(root, root, [])) {
    const ext = extname(file).toLowerCase();
    if (CODE_EXTENSIONS.has(ext)) {
      issues.push({
        file,
        message:
          "Code interdit dans un repo client : toute fonctionnalité se développe dans le core, derrière un interrupteur features",
      });
    } else if (ext === ".css" || ext === ".scss") {
      if (!file.startsWith(`${STYLES_DIR}/`)) {
        issues.push({ file, message: `Les surcharges de style vont dans ${STYLES_DIR}/` });
      } else {
        const firstLine = readFileSync(join(root, file), "utf8").split("\n", 1)[0] ?? "";
        if (!OVERRIDE_HEADER.test(firstLine.trim())) {
          issues.push({
            file,
            message: "Surcharge non documentée : la première ligne doit être /* Surcharge documentée : <raison> */",
          });
        }
      }
    }
  }
  return issues;
}
