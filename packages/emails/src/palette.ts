/**
 * Charte des emails, dérivée des jetons de la boutique (tokens.json produit par lp-theme).
 * Le corps reste clair et lisible partout (clients qui forcent le mode clair, images bloquées) ; la marque vit
 * dans le bandeau d'en-tête et les boutons. Chaque couple texte/fond est contrôlé : AA, 4,5:1 au moins.
 */

export interface EmailPalette {
  page: string;
  card: string;
  ink: string;
  muted: string;
  line: string;
  brand: string;
  onBrand: string;
  link: string;
  fontDisplay: string;
  fontBody: string;
}

export const MIN_CONTRAST = 4.5;

function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? [...n].map((c) => c + c).join("") : n;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [number, number, number];
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const HEX = /^#[0-9a-f]{6}$/i;

/** Polices des emails : la police de la boutique si le client la connaît, sinon la pile système de repli. */
const stack = (value: string | undefined, fallback: string) => {
  const family = value?.split(",")[0]?.trim();
  return family ? `${family}, ${fallback}` : fallback;
};

export function emailPalette(tokens: { isDark: boolean; variables: Record<string, string> }): EmailPalette {
  const v = tokens.variables;
  const pick = (name: string, fallback: string) => (HEX.test(v[name] ?? "") ? v[name]! : fallback);
  // Boutique à fond sombre (template B) : bandeau sombre aux couleurs de la boutique, corps clair neutre.
  const page = tokens.isDark ? "#F4F3F1" : pick("--c-bg", "#FAF8F4");
  const card = "#FFFFFF";
  const ink = tokens.isDark ? "#1F1E1C" : pick("--c-ink", "#211F1B");
  const muted = tokens.isDark ? "#5E5D59" : pick("--c-ink-muted", "#666460");
  const brand = tokens.isDark ? pick("--c-bg", "#121110") : pick("--c-primary", "#2F4A3A");
  const onBrand = tokens.isDark ? pick("--c-ink", "#F2F0ED") : pick("--c-on-primary", "#FFFFFF");
  const accent = pick("--c-accent-text", brand);
  return {
    page,
    card,
    ink: contrast(ink, card) >= MIN_CONTRAST ? ink : "#1F1E1C",
    muted: contrast(muted, card) >= MIN_CONTRAST ? muted : "#5E5D59",
    line: tokens.isDark ? "#DEDCD8" : pick("--c-line", "#DDDBD7"),
    brand,
    onBrand:
      contrast(onBrand, brand) >= MIN_CONTRAST
        ? onBrand
        : contrast("#FFFFFF", brand) > contrast("#000000", brand)
          ? "#FFFFFF"
          : "#000000",
    // Liens : l'accent de la boutique s'il reste lisible sur fond blanc, sinon la couleur de marque.
    link: contrast(accent, card) >= MIN_CONTRAST ? accent : brand,
    fontDisplay: stack(v["--f-display"], "Georgia, 'Times New Roman', serif"),
    fontBody: stack(v["--f-body"], "Helvetica, Arial, sans-serif"),
  };
}
