import { join } from "node:path";
import { differenceCiede2000 } from "culori";
import { describe, expect, it } from "vitest";
import { loadConfig, validateConfig } from "@lp/config";
import {
  buildTheme,
  buildThemeFromLoaded,
  contrastRatio,
  derivePalette,
  formatRatio,
  generateCss,
  isDarkBackground,
  RADII,
  rootVariables,
  ThemeError,
  type BrandColors,
} from "../src/index.ts";
import { cadrageExample, makeSite } from "../../config/test/fixtures.ts";

const NOW = new Date("2026-10-02T08:00:00Z");
const deltaE = differenceCiede2000();

function randomHex(seed: number): string {
  // Générateur déterministe : les tests restent reproductibles.
  let x = seed * 2654435761;
  const next = () => ((x = (x * 1103515245 + 12345) >>> 0) & 0xff);
  return `#${[next(), next(), next()].map((n) => n.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

describe("contraste WCAG", () => {
  it("T1.6 noir sur blanc = 21:1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("T1.7 #767676 sur blanc = 4,54:1, seuil franchi", () => {
    const ratio = contrastRatio("#767676", "#FFFFFF");
    expect(formatRatio(ratio)).toBe("4,54:1");
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("est symétrique", () => {
    expect(contrastRatio("#2F4A3A", "#FAF8F4")).toBeCloseTo(contrastRatio("#FAF8F4", "#2F4A3A"), 10);
  });
});

describe("dérivation des jetons", () => {
  it("T1.8 fond clair #FAF8F4 : encre sombre, ratio ≥ 4,5", () => {
    const p = derivePalette({ primaire: "#2F4A3A", secondaire: "#B08D57", fond: "#FAF8F4" });
    expect(p.isDark).toBe(false);
    expect(isDarkBackground(p.tokens["--c-ink"])).toBe(true);
    expect(contrastRatio(p.tokens["--c-ink"], p.tokens["--c-bg"])).toBeGreaterThanOrEqual(4.5);
  });

  it("T1.9 fond sombre #121110 : encre claire, ratio ≥ 4,5", () => {
    const p = derivePalette({ primaire: "#F2F0ED", secondaire: "#C2565C", fond: "#121110" });
    expect(p.isDark).toBe(true);
    expect(isDarkBackground(p.tokens["--c-ink"])).toBe(false);
    expect(contrastRatio(p.tokens["--c-ink"], p.tokens["--c-bg"])).toBeGreaterThanOrEqual(4.5);
  });

  it("T1.10 --c-on-primary : blanc sur #2F4A3A, sombre sur #F2F0ED", () => {
    expect(derivePalette({ primaire: "#2F4A3A", secondaire: "#B08D57", fond: "#FAF8F4" }).tokens["--c-on-primary"]).toBe(
      "#FFFFFF",
    );
    const dark = derivePalette({ primaire: "#F2F0ED", secondaire: "#C2565C", fond: "#121110" });
    expect(isDarkBackground(dark.tokens["--c-on-primary"])).toBe(true);
    expect(contrastRatio(dark.tokens["--c-on-primary"], "#F2F0ED")).toBeGreaterThanOrEqual(4.5);
  });

  it("T1.11 --c-ink-muted ≥ 4,5 sur fond et surface pour 10 chartes aléatoires", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const colors: BrandColors = { fond: randomHex(seed), primaire: randomHex(seed + 100), secondaire: randomHex(seed + 200) };
      const { tokens } = derivePalette(colors);
      for (const back of ["--c-bg", "--c-surface", "--c-raise", "--c-warm"] as const) {
        expect(contrastRatio(tokens["--c-ink-muted"], tokens[back]), `${colors.fond} ${back}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(tokens["--c-ink"], tokens[back]), `${colors.fond} ${back}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("le texte secondaire reste plus discret que l'encre", () => {
    const { tokens } = derivePalette({ primaire: "#A8572C", secondaire: "#5C6B42", fond: "#FDF6EC" });
    expect(contrastRatio(tokens["--c-ink-muted"], tokens["--c-bg"])).toBeLessThan(
      contrastRatio(tokens["--c-ink"], tokens["--c-bg"]),
    );
  });

  it("reproduit de près les jetons des trois maquettes (ΔE2000 < 6)", () => {
    const cases: Array<[BrandColors, Record<string, string>]> = [
      [
        { primaire: "#2F4A3A", secondaire: "#B08D57", fond: "#FAF8F4" },
        { "--c-surface": "#FFFFFF", "--c-ink": "#1A1A17", "--c-ink-muted": "#6B6B62", "--c-line": "#DEDAD2" },
      ],
      [
        { primaire: "#F2F0ED", secondaire: "#C2565C", fond: "#121110" },
        { "--c-surface": "#1C1B19", "--c-raise": "#272522", "--c-ink": "#F2F0ED", "--c-ink-muted": "#A09B93", "--c-line": "#322F2B", "--c-on-primary": "#121110" },
      ],
      [
        { primaire: "#A8572C", secondaire: "#5C6B42", fond: "#FDF6EC" },
        { "--c-surface": "#FFFFFF", "--c-warm": "#F6EBDA", "--c-ink": "#33291F", "--c-ink-muted": "#73644F", "--c-line": "#E7D9C4" },
      ],
    ];
    for (const [colors, expected] of cases) {
      const { tokens } = derivePalette(colors);
      for (const [token, mock] of Object.entries(expected)) {
        expect(deltaE(mock, tokens[token as keyof typeof tokens]), `${colors.fond} ${token}`).toBeLessThan(6);
      }
    }
  });

  it("garde primaire, secondaire et fond tels que fournis", () => {
    const { tokens } = derivePalette({ primaire: "#2f4a3a", secondaire: "#b08d57", fond: "#faf8f4" });
    expect([tokens["--c-primary"], tokens["--c-accent"], tokens["--c-bg"]]).toEqual(["#2F4A3A", "#B08D57", "#FAF8F4"]);
  });

  it("signale sans bloquer un accent sous 3:1", () => {
    const p = derivePalette({ primaire: "#2F4A3A", secondaire: "#B08D57", fond: "#FAF8F4" });
    expect(p.warnings.map((w) => w.fg)).toEqual(["--c-accent"]);
    expect(p.checks.every((c) => c.ok)).toBe(true);
  });
});

describe("build du thème", () => {
  const config = () => validateConfig(cadrageExample(), { now: NOW });

  it("échoue sur un primaire trop clair et nomme le couple et son ratio", () => {
    const c = config();
    c.design.couleurs.primaire = "#E8E2D0";
    let error: ThemeError | undefined;
    try {
      buildTheme(c, []);
    } catch (e) {
      error = e as ThemeError;
    }
    expect(error).toBeInstanceOf(ThemeError);
    expect(error!.failures.map((f) => `${f.fg}/${f.bg}`)).toEqual(["--c-primary/--c-bg", "--c-primary/--c-surface"]);
    expect(error!.message).toContain("--c-primary (#E8E2D0) sur --c-surface (#FFFFFF) : 1,");
    expect(error!.message).toContain("minimum 4,5:1");
    expect(error!.message).toContain("design.couleurs.primaire");
  });

  it("T1.12 arrondis « doux » = 4px, 6px, 10px", () => {
    const vars = rootVariables(config(), derivePalette(config().design.couleurs).tokens);
    expect([vars["--radius-sm"], vars["--radius-md"], vars["--radius-lg"]]).toEqual(["4px", "6px", "10px"]);
    expect(RADII.net).toEqual([0, 0, 0]);
    expect(RADII.rond).toEqual([10, 18, 28]);
  });

  it("changer la couleur ou les arrondis change le CSS, sans autre intervention", () => {
    const base = config();
    const other = config();
    other.design.couleurs.primaire = "#7A1F2B";
    other.design.arrondis = "rond";
    const a = buildTheme(base, []).css;
    const b = buildTheme(other, []).css;
    expect(a).toContain("--c-primary: #2F4A3A;");
    expect(b).toContain("--c-primary: #7A1F2B;");
    expect(b).toContain("--radius-lg: 28px;");
  });

  it("émet les polices auto-hébergées avec font-display: swap et les piles de repli", () => {
    const loaded = loadConfig(makeSite(), { now: NOW });
    const theme = buildThemeFromLoaded(loaded, { fontBaseUrl: "/fonts/" });
    expect(theme.css.match(/@font-face/g)).toHaveLength(4);
    expect(theme.css).toContain('src: url("/fonts/work-sans-600.woff2") format("woff2");');
    expect(theme.css).toContain("font-display: swap;");
    expect(theme.variables["--f-display"]).toBe('"Playfair Display", Georgia, "Times New Roman", serif');
    expect(theme.variables["--f-body"]).toMatch(/^"Work Sans", system-ui/);
    expect(theme.preload.map((f) => f.fileName)).toEqual(["playfair-display-400.woff2"]);
  });

  it("pose l'échelle typographique fixe et la trame de 4 px", () => {
    const vars = buildTheme(config(), []).variables;
    expect(vars["--fs-display-1"]).toBe("clamp(40px, 6vw, 64px)");
    expect(vars["--fs-body"]).toBe("16px");
    expect(vars["--space-1"]).toBe("4px");
    expect(vars["--space-9"]).toBe("96px");
  });

  it("déclare le schéma de couleur sombre pour un fond sombre", () => {
    const c = config();
    c.design.couleurs = { primaire: "#F2F0ED", secondaire: "#C2565C", fond: "#121110" };
    expect(generateCss(c, derivePalette(c.design.couleurs), [])).toContain("color-scheme: dark;");
  });

  it("construit les trois chartes des maquettes sans échec de contraste", () => {
    for (const site of ["maison-ferrand", "noir-et-sel", "comptoir-saint-roch"]) {
      const loaded = loadConfig(join(__dirname, "../../../examples", site), { now: NOW });
      expect(() => buildThemeFromLoaded(loaded)).not.toThrow();
    }
  });
});
