import type { ReactElement } from "react";
import { renderStaticMarkup } from "./static-markup.ts";

const DOCTYPE =
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">';

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/**
 * Version texte brut, tirée du HTML rendu : même contenu, sans mise en forme. Les liens gardent leur adresse
 * entre parenthèses ; l'aperçu caché (Preview) et l'en-tête sont retirés.
 */
export function htmlToText(html: string): string {
  let s = html
    .replace(/<head[\s\S]*?<\/head>/i, "")
    .replace(/<div[^>]*data-skip-in-text="true"[^>]*>[\s\S]*?<\/div>\s*(<\/div>)?/gi, "")
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const text = label.replace(/<[^>]+>/g, "").trim();
      const url = decode(href);
      if (!text || url.startsWith("tel:") || url.startsWith("mailto:") || text === url || `https://${text}` === url)
        return label;
      return `${label} (${url})`;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|tr|table|li|section)>/gi, "\n")
    .replace(/<\/td>/gi, "  ")
    .replace(/<[^>]+>/g, "");
  s = decode(s)
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]{2,}/g, (m) => (m.includes("\u00a0") ? "\u00a0" : " ")).trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  return s.trim() + "\n";
}

export function renderEmail(element: ReactElement): { html: string; text: string } {
  const html = DOCTYPE + renderStaticMarkup(element);
  return { html, text: htmlToText(html) };
}
