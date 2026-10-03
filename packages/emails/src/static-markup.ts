import type { ReactElement, ReactNode } from "react";

/**
 * Rendu HTML statique des gabarits d'email, sans react-dom/server (que l'App Router de Next.js interdit dans le code
 * serveur). Les gabarits sont des composants sans état ni effet : fonctions, forwardRef, fragments et balises HTML
 * suffisent. Le résultat est identique à renderToStaticMarkup (vérifié par les tests).
 */

const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);
const FRAGMENT = Symbol.for("react.fragment");
const FORWARD_REF = Symbol.for("react.forward_ref");
const MEMO = Symbol.for("react.memo");
const ATTR_NAMES: Record<string, string> = {
  className: "class",
  htmlFor: "for",
  httpEquiv: "http-equiv",
  acceptCharset: "accept-charset",
};
// Propriétés CSS sans unité (liste de React, réduite à ce qui peut servir dans un email).
const UNITLESS = new Set([
  "flex",
  "flexGrow",
  "flexShrink",
  "fontWeight",
  "lineHeight",
  "opacity",
  "order",
  "orphans",
  "widows",
  "zIndex",
  "zoom",
]);

// Comme React : même échappement pour le texte et les attributs.
const escapeText = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" })[c]!);
const escapeAttr = escapeText;

function style(value: Record<string, unknown>): string {
  return Object.entries(value)
    .filter(([, v]) => v !== null && v !== undefined && v !== "" && typeof v !== "boolean")
    .map(([k, v]) => {
      const name = k.startsWith("--") ? k : k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/^ms-/, "-ms-");
      const css = typeof v === "number" && v !== 0 && !UNITLESS.has(k) ? `${v}px` : String(v).trim();
      return `${name}:${css}`;
    })
    .join(";");
}

function attributes(props: Record<string, unknown>): string {
  let out = "";
  for (const [key, value] of Object.entries(props)) {
    if (key === "children" || key === "key" || key === "ref" || key === "dangerouslySetInnerHTML") continue;
    if (value === null || value === undefined || value === false || typeof value === "function") continue;
    if (key === "style" && typeof value === "object") {
      const css = style(value as Record<string, unknown>);
      if (css) out += ` style="${escapeAttr(css)}"`;
      continue;
    }
    const name = ATTR_NAMES[key] ?? key;
    // Comme React : un booléen vrai vaut "true" pour data-* et aria-*, un attribut vide sinon.
    if (value === true) out += /^(data|aria)-/.test(name) ? ` ${name}="true"` : ` ${name}=""`;
    else out += ` ${name}="${escapeAttr(String(value))}"`;
  }
  return out;
}

export function renderStaticMarkup(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return escapeText(node);
  if (typeof node === "number" || typeof node === "bigint") return String(node);
  if (Array.isArray(node)) return renderList(node);
  const element = node as ReactElement<Record<string, unknown>> & { type: unknown };
  const { props } = element;
  const type = element.type as unknown;
  if (type === FRAGMENT) return renderStaticMarkup(props.children as ReactNode);
  if (typeof type === "function") return renderStaticMarkup((type as (p: unknown) => ReactNode)(props));
  if (typeof type === "object" && type !== null) {
    const t = type as { $$typeof: symbol; render?: (p: unknown, ref: unknown) => ReactNode; type?: unknown };
    if (t.$$typeof === FORWARD_REF) return renderStaticMarkup(t.render!(props, null));
    if (t.$$typeof === MEMO) return renderStaticMarkup({ ...element, type: t.type } as ReactNode);
  }
  if (typeof type !== "string") throw new Error(`Élément non pris en charge dans un email : ${String(type)}`);
  const open = `<${type}${attributes(props)}>`;
  if (VOID.has(type)) return open.replace(/>$/, "/>");
  const inner = props.dangerouslySetInnerHTML
    ? String((props.dangerouslySetInnerHTML as { __html: string }).__html)
    : renderStaticMarkup(props.children as ReactNode);
  return `${open}${inner}</${type}>`;
}

/** Comme React : deux textes voisins ne sont pas séparés (le rendu statique n'ajoute pas de commentaire). */
function renderList(nodes: ReactNode[]): string {
  return nodes.map((n) => renderStaticMarkup(n)).join("");
}
