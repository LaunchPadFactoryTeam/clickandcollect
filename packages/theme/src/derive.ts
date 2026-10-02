import { clampChroma, converter, formatHex, type Oklch } from "culori";
import { contrastRatio, MIN_TEXT, MIN_UI } from "./contrast.ts";

/** Les trois couleurs fournies par le brief. */
export interface BrandColors {
  primaire: string;
  secondaire: string;
  fond: string;
}

export const COLOR_TOKENS = [
  "--c-bg",
  "--c-surface",
  "--c-raise",
  "--c-warm",
  "--c-ink",
  "--c-ink-muted",
  "--c-line",
  "--c-primary",
  "--c-on-primary",
  "--c-accent",
  "--c-danger",
] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];
export type ColorTokens = Record<ColorToken, string>;

export interface ContrastCheck {
  fg: ColorToken;
  bg: ColorToken;
  ratio: number;
  min: number;
  ok: boolean;
}

export interface DerivedPalette {
  isDark: boolean;
  tokens: ColorTokens;
  /** Couples bloquants : un seul en échec fait échouer le build. */
  checks: ContrastCheck[];
  /** Couples signalés sans bloquer. */
  warnings: ContrastCheck[];
}

const toOklch = converter("oklch");
const WHITE = "#FFFFFF";
const BLACK = "#000000";
const DANGER_LIGHT = "#A32020";
const DANGER_DARK = "#E0767C";

/** Ratio visé pour le texte courant et pour le texte secondaire (marge au-dessus de 4,5). */
const INK_TARGET = 7;
const MUTED_TARGET = 5;
/** Part de l'encre dans la couleur des filets (« ink à 12 % »). */
const LINE_INK_SHARE = 0.12;

function lch(hex: string): Required<Pick<Oklch, "l" | "c" | "h">> {
  const c = toOklch(hex);
  if (!c) throw new Error(`Couleur invalide : ${hex}`);
  return { l: c.l, c: c.c ?? 0, h: c.h ?? 0 };
}

function hex(l: number, c: number, h: number): string {
  const color: Oklch = { mode: "oklch", l: Math.min(1, Math.max(0, l)), c: Math.max(0, c), h };
  return formatHex(clampChroma(color, "oklch")).toUpperCase();
}

/** Mélange en OKLCH de la clarté et de la saturation : t = 0 donne `from`, t = 1 donne `to`. */
function mix(from: string, to: string, t: number, hue: number): string {
  const a = lch(from);
  const b = lch(to);
  return hex(a.l + (b.l - a.l) * t, a.c + (b.c - a.c) * t, hue);
}

function minContrast(fg: string, backgrounds: readonly string[]): number {
  return Math.min(...backgrounds.map((b) => contrastRatio(fg, b)));
}

/** Un fond est sombre si un texte blanc y contraste mieux qu'un texte noir. */
export function isDarkBackground(color: string): boolean {
  return contrastRatio(WHITE, color) > contrastRatio(BLACK, color);
}

export function derivePalette(colors: BrandColors): DerivedPalette {
  const bg = colors.fond.toUpperCase();
  const dark = isDarkBackground(bg);
  const b = lch(bg);
  const p = lch(colors.primaire);
  const dir = dark ? 1 : -1; // sens « vers le contraste » pour l'encre

  // Surfaces : éclaircies sur fond sombre, éclaircies jusqu'au blanc sur fond clair.
  const surface = dark ? hex(b.l + 0.04, b.c, b.h) : hex(b.l + 0.04, b.c * 0.5, b.h);
  const raise = dark ? hex(b.l + 0.08, b.c, b.h) : surface;
  const warmHue = b.c > 0.005 ? b.h : p.h;
  const warm = dark ? hex(b.l + 0.06, Math.max(b.c * 1.8, 0.015), warmHue) : hex(b.l - 0.035, Math.max(b.c * 1.8, 0.015), warmHue);
  const backgrounds = [bg, surface, raise, warm];

  // Encre : teinte du fond (ou du primaire si le fond est neutre), presque neutre,
  // poussée vers le contraste jusqu'au ratio visé.
  const inkHue = b.c > 0.005 ? b.h : p.h;
  const inkChroma = b.c > 0.005 ? Math.min(b.c * 1.5, 0.025) : Math.min(p.c, 0.015);
  let inkL = dark ? 0.955 : 0.24;
  let ink = hex(inkL, inkChroma, inkHue);
  while (minContrast(ink, backgrounds) < INK_TARGET && inkL > 0 && inkL < 1) {
    inkL += dir * 0.01;
    ink = hex(inkL, inkChroma, inkHue);
  }

  // Texte secondaire : le plus proche du fond qui garde le ratio visé (recherche dichotomique).
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const t = (lo + hi) / 2;
    if (minContrast(mix(ink, bg, t, inkHue), backgrounds) >= MUTED_TARGET) lo = t;
    else hi = t;
  }
  const inkMuted = mix(ink, bg, lo, inkHue);

  const line = mix(ink, bg, 1 - LINE_INK_SHARE, inkHue);
  const primary = colors.primaire.toUpperCase();
  // Texte sur primaire : la couleur claire ou sombre du thème, sinon blanc ou noir pur.
  const lightest = dark ? ink : surface;
  const darkest = dark ? bg : ink;
  const best = contrastRatio(lightest, primary) >= contrastRatio(darkest, primary) ? lightest : darkest;
  const onPrimary =
    contrastRatio(best, primary) >= MIN_TEXT
      ? best
      : contrastRatio(WHITE, primary) >= contrastRatio(BLACK, primary) ? WHITE : BLACK;
  const accent = colors.secondaire.toUpperCase();
  const danger = dark ? DANGER_DARK : DANGER_LIGHT;

  const tokens: ColorTokens = {
    "--c-bg": bg,
    "--c-surface": surface,
    "--c-raise": raise,
    "--c-warm": warm,
    "--c-ink": ink,
    "--c-ink-muted": inkMuted,
    "--c-line": line,
    "--c-primary": primary,
    "--c-on-primary": onPrimary,
    "--c-accent": accent,
    "--c-danger": danger,
  };

  const check = (fg: ColorToken, back: ColorToken, min: number): ContrastCheck => {
    const ratio = contrastRatio(tokens[fg], tokens[back]);
    return { fg, bg: back, ratio, min, ok: ratio >= min };
  };
  const surfaces: ColorToken[] = ["--c-bg", "--c-surface", "--c-raise", "--c-warm"];
  const checks: ContrastCheck[] = [
    ...surfaces.flatMap((s) => [check("--c-ink", s, MIN_TEXT), check("--c-ink-muted", s, MIN_TEXT)]),
    check("--c-primary", "--c-bg", MIN_TEXT),
    check("--c-primary", "--c-surface", MIN_TEXT),
    check("--c-on-primary", "--c-primary", MIN_TEXT),
    check("--c-danger", "--c-bg", MIN_TEXT),
    check("--c-danger", "--c-surface", MIN_TEXT),
  ];
  // L'accent n'est jamais seul porteur de sens : signalé, pas bloquant.
  const warnings = [check("--c-accent", "--c-bg", MIN_UI)].filter((c) => !c.ok);

  return { isDark: dark, tokens, checks, warnings };
}
