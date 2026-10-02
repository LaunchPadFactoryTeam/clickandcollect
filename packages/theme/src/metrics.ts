import { openSync, type Font } from "fontkit";

/** Métriques d'une police, rapportées à son em, pour caler une police de repli sur elle. */
export interface FontMetrics {
  ascent: number;
  descent: number;
  lineGap: number;
  /** Chasse moyenne d'un caractère sur un texte français courant. */
  avgWidth: number;
}

/** Texte de référence : la chasse moyenne dépend de la fréquence des lettres, donc de la langue. */
export const WIDTH_SAMPLE =
  "Choisissez vos produits, réglez en ligne et passez les retirer en boutique. Fromages affinés, miels de châtaignier, terrines et vins de producteurs.";

/** Métriques lues dans le fichier, ou null s'il est illisible : le site garde alors le repli système simple. */
export function readFontMetrics(path: string): FontMetrics | null {
  let font: Font;
  try {
    font = openSync(path) as Font;
  } catch {
    return null;
  }
  const em = font.unitsPerEm;
  return {
    ascent: font.ascent / em,
    descent: Math.abs(font.descent) / em,
    lineGap: font.lineGap / em,
    avgWidth: font.layout(WIDTH_SAMPLE).advanceWidth / WIDTH_SAMPLE.length / em,
  };
}
