import type { ClientConfig, FontFile, Police } from "@launchpadfactoryteam/config";
import { COLOR_TOKENS, type ColorTokens, type DerivedPalette } from "./derive.ts";
import type { FontMetrics } from "./metrics.ts";
import { FALLBACK_FACES, FALLBACK_STACKS, RADII, SPACING, TYPE_SCALE } from "./scale.ts";

type Category = "serif" | "sans-serif";
type Role = "titres" | "texte";
const DEFAULT_CATEGORY: Record<Role, Category> = { titres: "serif", texte: "sans-serif" };

export interface CssOptions {
  /** Préfixe d'URL des polices publiées, ex. "/fonts/". */
  fontBaseUrl?: string;
  /** Métriques des polices de la marque : sans elles, pas de repli ajusté. */
  metrics?: Partial<Record<Role, FontMetrics>>;
}

const categoryOf = (police: Police, role: Role): Category =>
  ("categorie" in police && police.categorie) || DEFAULT_CATEGORY[role];

/** Pile de polices : famille de la marque, son repli ajusté, puis repli système de même catégorie. */
export function fontStack(police: Police, defaultCategory: Category): string {
  const category = ("categorie" in police && police.categorie) || defaultCategory;
  return `"${police.famille}", "${police.famille} Fallback", ${FALLBACK_STACKS[category]}`;
}

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

/**
 * Police de repli locale mise à l'échelle de la police de la marque (largeur, hauteurs de ligne) :
 * le texte occupe la même place avant et après le chargement de la police, donc aucun décalage (CLS).
 */
export function fallbackFaceCss(police: Police, role: Role, m: FontMetrics): string {
  const face = FALLBACK_FACES[categoryOf(police, role)];
  const sizeAdjust = m.avgWidth / face.avgWidth;
  return (
    `@font-face {\n  font-family: "${police.famille} Fallback";\n` +
    `  src: ${face.local.map((l) => `local("${l}")`).join(", ")};\n` +
    `  size-adjust: ${pct(sizeAdjust)};\n  ascent-override: ${pct(m.ascent / sizeAdjust)};\n` +
    `  descent-override: ${pct(m.descent / sizeAdjust)};\n  line-gap-override: ${pct(m.lineGap / sizeAdjust)};\n}`
  );
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
  const fallbacks = (["titres", "texte"] as const).flatMap((role) => {
    const m = options.metrics?.[role];
    return m ? [fallbackFaceCss(config.design.typographies[role], role, m)] : [];
  });
  return [
    `/* Généré par @launchpadfactoryteam/theme pour ${config.boutique.nom} — ne pas modifier à la main. */`,
    fontFaceCss(fonts, options.fontBaseUrl),
    ...fallbacks,
    `:root {\n${root}\n  color-scheme: ${palette.isDark ? "dark" : "light"};\n}`,
    "",
  ].join("\n\n");
}
