import type { ClientConfig, FontFile, Police } from "@lp/config";
import { COLOR_TOKENS, type ColorTokens, type DerivedPalette } from "./derive.ts";
import { FALLBACK_STACKS, RADII, SPACING, TYPE_SCALE } from "./scale.ts";

export interface CssOptions {
  /** Préfixe d'URL des polices publiées, ex. "/fonts/". */
  fontBaseUrl?: string;
}

/** Pile de polices : famille de la marque puis repli système de même catégorie. */
export function fontStack(police: Police, defaultCategory: "serif" | "sans-serif"): string {
  const category = ("categorie" in police && police.categorie) || defaultCategory;
  return `"${police.famille}", ${FALLBACK_STACKS[category]}`;
}

export function fontFaceCss(fonts: readonly FontFile[], baseUrl = "/fonts/"): string {
  return fonts
    .map(
      (f) =>
        `@font-face {\n  font-family: "${f.famille}";\n  font-style: normal;\n  font-weight: ${f.graisse};\n` +
        `  font-display: swap;\n  src: url("${baseUrl}${f.fileName}") format("woff2");\n}`,
    )
    .join("\n\n");
}

/** Variables CSS de toute la charte, à poser sur :root. */
export function rootVariables(config: ClientConfig, colors: ColorTokens): Record<string, string> {
  const { typographies, arrondis } = config.design;
  const [sm, md, lg] = RADII[arrondis];
  const vars: Record<string, string> = {};
  for (const token of COLOR_TOKENS) vars[token] = colors[token];
  vars["--f-display"] = fontStack(typographies.titres, "serif");
  vars["--f-body"] = fontStack(typographies.texte, "sans-serif");
  vars["--f-mono"] = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
  vars["--radius-sm"] = `${sm}px`;
  vars["--radius-md"] = `${md}px`;
  vars["--radius-lg"] = `${lg}px`;
  SPACING.forEach((px, i) => {
    vars[`--space-${i + 1}`] = `${px}px`;
  });
  for (const step of TYPE_SCALE) {
    vars[`--fs-${step.name}`] = step.size;
    vars[`--lh-${step.name}`] = String(step.lineHeight);
  }
  return vars;
}

export function generateCss(
  config: ClientConfig,
  palette: DerivedPalette,
  fonts: readonly FontFile[],
  options: CssOptions = {},
): string {
  const vars = rootVariables(config, palette.tokens);
  const root = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return [
    `/* Généré par @lp/theme pour ${config.boutique.nom} — ne pas modifier à la main. */`,
    fontFaceCss(fonts, options.fontBaseUrl),
    `:root {\n${root}\n  color-scheme: ${palette.isDark ? "dark" : "light"};\n}`,
    "",
  ].join("\n\n");
}
