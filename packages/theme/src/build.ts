import type { ClientConfig, FontFile, LoadedConfig } from "@launchpadfactoryteam/config";
import { formatRatio } from "./contrast.ts";
import { generateCss, rootVariables, type CssOptions } from "./css.ts";
import { derivePalette, type ContrastCheck, type ColorToken, type DerivedPalette } from "./derive.ts";

/** Clé de configuration à l'origine de chaque jeton, pour orienter la correction. */
const SOURCE: Partial<Record<ColorToken, string>> = {
  "--c-bg": "design.couleurs.fond",
  "--c-primary": "design.couleurs.primaire",
  "--c-accent": "design.couleurs.secondaire",
};

export function describeCheck(c: ContrastCheck, tokens: DerivedPalette["tokens"]): string {
  const min = String(c.min).replace(".", ",");
  const from = [SOURCE[c.fg], SOURCE[c.bg]].filter(Boolean);
  const hint = from.length ? ` (à corriger dans ${from.join(" ou ")})` : "";
  return `${c.fg} (${tokens[c.fg]}) sur ${c.bg} (${tokens[c.bg]}) : ${formatRatio(c.ratio)}, minimum ${min}:1${hint}`;
}

export class ThemeError extends Error {
  readonly failures: ContrastCheck[];
  constructor(failures: ContrastCheck[], palette: DerivedPalette, shop: string) {
    super(
      [
        `Contrastes insuffisants pour ${shop} :`,
        ...failures.map((f) => `  - ${describeCheck(f, palette.tokens)}`),
      ].join("\n"),
    );
    this.name = "ThemeError";
    this.failures = failures;
  }
}

export interface BuiltTheme {
  palette: DerivedPalette;
  css: string;
  /** Toutes les variables CSS, pour les emails et les tests. */
  variables: Record<string, string>;
  /** Polices visibles au-dessus de la ligne de flottaison, à précharger : titre et texte courant, première graisse de chacun. */
  preload: FontFile[];
}

/** Dérive et contrôle le thème d'une configuration validée ; lève ThemeError si un contraste échoue. */
export function buildTheme(config: ClientConfig, fonts: readonly FontFile[], options: CssOptions = {}): BuiltTheme {
  const palette = derivePalette(config.design.couleurs);
  const failures = palette.checks.filter((c) => !c.ok);
  if (failures.length) throw new ThemeError(failures, palette, config.boutique.nom);
  const { titres, texte } = config.design.typographies;
  return {
    palette,
    css: generateCss(config, palette, fonts, options),
    variables: rootVariables(config, palette.tokens),
    preload: fonts.filter(
      (f) => (f.role === "titres" && f.graisse === titres.graisses[0]) || (f.role === "texte" && f.graisse === texte.graisses[0]),
    ),
  };
}

export function buildThemeFromLoaded(loaded: LoadedConfig, options: CssOptions = {}): BuiltTheme {
  return buildTheme(loaded.config, loaded.fonts, options);
}
