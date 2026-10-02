import type { ClientConfig } from "@lp/config";
import type { BuiltTheme } from "./build.ts";
import { formatRatio } from "./contrast.ts";
import { COLOR_TOKENS } from "./derive.ts";
import { RADII, SPACING, STATUS_COLORS, TYPE_SCALE } from "./scale.ts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Page de contrôle : montre les jetons calculés et le résultat des contrôles pour une configuration. */
export function previewHtml(config: ClientConfig, theme: BuiltTheme, cssHref = "theme.css"): string {
  const { palette } = theme;
  const name = esc(config.boutique.nom);
  const swatches = COLOR_TOKENS.map(
    (t) => `<li><span class="sw" style="background:var(${t})"></span><code>${t}</code><code>${palette.tokens[t]}</code></li>`,
  ).join("");
  const checks = [...palette.checks, ...palette.warnings.map((w) => ({ ...w, warn: true }))]
    .map(
      (c) =>
        `<tr><td><code>${c.fg}</code></td><td><code>${c.bg}</code></td><td>${formatRatio(c.ratio)}</td>` +
        `<td>${String(c.min).replace(".", ",")}:1</td><td>${"warn" in c ? "Signalé" : c.ok ? "OK" : "Échec"}</td></tr>`,
    )
    .join("");
  const scale = TYPE_SCALE.map(
    (s) =>
      `<div class="step"><span style="font-family:var(--f-${s.name.startsWith("display") || s.name === "heading" ? "display" : "body"});font-size:var(--fs-${s.name});line-height:var(--lh-${s.name});font-weight:${s.weight}${s.letterSpacing ? `;letter-spacing:${s.letterSpacing};text-transform:uppercase` : ""}">${s.name === "overline" ? "Surtitre" : "Miel de châtaignier"}</span><code>${s.name} · ${s.size}</code></div>`,
  ).join("");
  const spacing = SPACING.map((px, i) => `<span class="sp" style="width:var(--space-${i + 1});height:var(--space-${i + 1})" title="${px}px"></span>`).join("");
  const status = Object.values(STATUS_COLORS)
    .map((s) => `<span class="pill" style="background:${s.bg};color:${s.fg}"><i style="background:${s.dot}"></i>${s.label}</span>`)
    .join("");
  const [rs, rm, rl] = RADII[config.design.arrondis];

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Thème — ${name}</title>
<link rel="stylesheet" href="${cssHref}">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--c-bg); color: var(--c-ink); font-family: var(--f-body); font-size: var(--fs-body); line-height: var(--lh-body); }
  main { max-width: 1080px; margin: 0 auto; padding: var(--space-7) var(--space-4); }
  h1 { font-family: var(--f-display); font-size: var(--fs-display-1); line-height: var(--lh-display-1); font-weight: 400; margin: 0 0 var(--space-3); }
  h2 { font-family: var(--f-display); font-size: var(--fs-heading); font-weight: 400; margin: var(--space-8) 0 var(--space-4); }
  p.muted, code { color: var(--c-ink-muted); }
  code { font-family: var(--f-mono); font-size: 13px; }
  ul.sw-list { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-3); }
  ul.sw-list li { display: flex; gap: var(--space-2); align-items: center; background: var(--c-surface); border: 1px solid var(--c-line); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); }
  .sw { width: 28px; height: 28px; border-radius: var(--radius-sm); border: 1px solid var(--c-line); flex: none; }
  table { border-collapse: collapse; width: 100%; background: var(--c-surface); }
  th, td { text-align: left; padding: var(--space-2) var(--space-3); border-bottom: 1px solid var(--c-line); font-size: var(--fs-small); }
  .step { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-4); padding: var(--space-3) 0; border-bottom: 1px solid var(--c-line); }
  .sp { display: inline-block; background: var(--c-warm); border: 1px solid var(--c-primary); margin-right: var(--space-2); vertical-align: bottom; }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; }
  .btn { font: inherit; font-weight: 500; min-height: 48px; padding: 13px 24px; border-radius: var(--radius-sm); cursor: pointer; }
  .btn-primary { background: var(--c-primary); color: var(--c-on-primary); border: 1px solid var(--c-primary); }
  .btn-secondary { background: transparent; color: var(--c-ink); border: 1px solid var(--c-ink); }
  .btn:disabled { background: var(--c-surface); color: var(--c-ink-muted); border: 1px solid var(--c-line); cursor: not-allowed; }
  .card { width: 220px; background: var(--c-surface); border: 1px solid var(--c-line); border-radius: var(--radius-lg); overflow: hidden; }
  .card .img { aspect-ratio: 4 / 5; background: var(--c-raise); }
  .card .body { padding: var(--space-3) var(--space-4) var(--space-4); }
  .card h3 { font-family: var(--f-display); font-weight: 500; margin: 0; font-size: 17px; }
  .price { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--c-primary); }
  .error { color: var(--c-danger); font-weight: 500; }
  .accent { border-bottom: 2px solid var(--c-accent); }
  .pill { display: inline-flex; align-items: center; gap: 7px; padding: 6px 13px; border-radius: 999px; font-size: 13.5px; font-weight: 500; }
  .pill i { width: 7px; height: 7px; border-radius: 50%; }
  :focus-visible { outline: 2px solid var(--c-primary); outline-offset: 3px; }
</style>
</head>
<body>
<main>
  <p class="muted"><code>@lp/theme · page de contrôle · fond ${palette.isDark ? "sombre" : "clair"} · arrondis ${config.design.arrondis} (${rs} / ${rm} / ${rl} px)</code></p>
  <h1><span class="accent">${name}</span></h1>
  <p class="muted">${esc(config.boutique.adresse)}</p>

  <h2>Jetons de couleur</h2>
  <ul class="sw-list">${swatches}</ul>

  <h2>Contrôles de contraste</h2>
  <table><thead><tr><th>Texte</th><th>Fond</th><th>Ratio</th><th>Minimum</th><th>Résultat</th></tr></thead><tbody>${checks}</tbody></table>

  <h2>Typographie</h2>
  <p class="muted"><code>titres : ${esc(config.design.typographies.titres.famille)} ${config.design.typographies.titres.graisses.join(", ")} · texte : ${esc(config.design.typographies.texte.famille)} ${config.design.typographies.texte.graisses.join(", ")}</code></p>
  ${scale}

  <h2>Espace</h2>
  <div>${spacing}</div>

  <h2>Composants témoins</h2>
  <div class="row">
    <button class="btn btn-primary" type="button">Ajouter au panier</button>
    <button class="btn btn-secondary" type="button">Voir la boutique</button>
    <button class="btn" type="button" disabled>Indisponible</button>
  </div>
  <p class="error">Cette adresse email semble incomplète.</p>
  <div class="row">
    <article class="card"><div class="img"></div><div class="body"><h3>Miel de châtaignier</h3><p class="muted" style="margin:2px 0 8px;font-size:var(--fs-small)">Pot 250 g</p><span class="price">12,50 €</span></div></article>
  </div>

  <h2>Statuts de commande (fixes)</h2>
  <div class="row">${status}</div>
</main>
</body>
</html>
`;
}
