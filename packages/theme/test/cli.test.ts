import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cadrageExample, makeSite } from "../../config/test/fixtures.ts";

const BIN = join(__dirname, "../bin/lp-theme.mjs");
const VERSION = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8")).version as string;

function run(args: string[]) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8" });
}

function siteAtCoreVersion(change?: (c: Record<string, any>) => void): string {
  const config = cadrageExample();
  config.core_version = VERSION;
  change?.(config);
  return makeSite(config);
}

describe("commande lp-theme", () => {
  it("écrit le CSS, les jetons, la page de contrôle, les polices et la configuration validée", () => {
    const site = siteAtCoreVersion();
    const out = mkdtempSync(join(tmpdir(), "lp-theme-out-"));
    const result = run(["build", site, "--out", out, "--config-out", join(out, "site.json")]);
    expect(result.status, result.stderr).toBe(0);
    for (const file of ["theme.css", "tokens.json", "preview.html", "fonts/work-sans-600.woff2"]) {
      expect(existsSync(join(out, file)), file).toBe(true);
    }
    const config = JSON.parse(readFileSync(join(out, "site.json"), "utf8"));
    // La configuration publiée est la version validée et normalisée, prête pour le Worker.
    expect(config.boutique.telephone).toBe("+33400000000");
    expect(config.design.typographies.titres).toEqual({ famille: "Playfair Display", graisses: [400, 600] });
  });

  it("échoue avec le code 1 et un message explicite sur une configuration invalide", () => {
    const site = siteAtCoreVersion((c) => (c.design.variantes.accueil = "D"));
    const result = run(["build", site, "--out", mkdtempSync(join(tmpdir(), "lp-theme-out-"))]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("design.variantes.accueil");
  });

  it("échoue avec le code 1 sur un contraste insuffisant", () => {
    const site = siteAtCoreVersion((c) => (c.design.couleurs.primaire = "#E8E2D0"));
    const result = run(["build", site, "--out", mkdtempSync(join(tmpdir(), "lp-theme-out-"))]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Contrastes insuffisants");
  });

  it("refuse une configuration qui vise une autre version du core", () => {
    const site = siteAtCoreVersion((c) => (c.core_version = "9.9.9"));
    const result = run(["build", site, "--out", mkdtempSync(join(tmpdir(), "lp-theme-out-"))]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("core_version");
  });
});
