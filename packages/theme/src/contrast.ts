/** Contraste WCAG 2.1 entre deux couleurs hexadécimales. */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  const n = Number.parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(n)) throw new Error(`Couleur invalide : ${hex}`);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Luminance relative WCAG, de 0 (noir) à 1 (blanc). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Ratio de contraste WCAG, de 1 à 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Ratio tronqué à deux décimales et écrit à la française : 4.546 -> "4,54:1". */
export function formatRatio(ratio: number): string {
  return `${(Math.floor(ratio * 100) / 100).toFixed(2).replace(".", ",")}:1`;
}

/** Seuils WCAG 2.1 AA. */
export const MIN_TEXT = 4.5;
export const MIN_UI = 3;
