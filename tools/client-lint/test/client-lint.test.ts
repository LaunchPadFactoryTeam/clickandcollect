import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lintClientRepo } from "../src/index.ts";

const TEMPLATE = join(__dirname, "../../../templates/client-repo");

function repo(files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "lp-client-"));
  cpSync(TEMPLATE, dir, { recursive: true });
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

describe("règle de lint des repos clients", () => {
  it("le gabarit de repo client est conforme", () => {
    expect(lintClientRepo(repo())).toEqual([]);
  });

  it("T0.1 refuse un fichier .tsx hors du dossier styles et nomme le fichier", () => {
    const issues = lintClientRepo(repo({ "app/promo-noel.tsx": "export default () => null;" }));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.file).toBe("app/promo-noel.tsx");
    expect(issues[0]!.message).toContain("core");
  });

  it("refuse aussi .ts, .js et .mjs, même dans styles/", () => {
    const issues = lintClientRepo(repo({ "lib/a.ts": "", "b.js": "", "styles/c.mjs": "" }));
    expect(issues.map((i) => i.file).sort()).toEqual(["b.js", "lib/a.ts", "styles/c.mjs"]);
  });

  it("T0.2 accepte une surcharge CSS documentée", () => {
    const issues = lintClientRepo(
      repo({
        "styles/logo.css":
          "/* Surcharge documentée : logo trop haut dans l'en-tête mobile */\n.logo { max-height: 40px; }\n",
      }),
    );
    expect(issues).toEqual([]);
  });

  it("refuse une surcharge CSS sans en-tête documenté", () => {
    const issues = lintClientRepo(repo({ "styles/logo.css": ".logo { max-height: 40px; }\n" }));
    expect(issues[0]!.message).toContain("non documentée");
  });

  it("refuse une feuille CSS hors du dossier styles", () => {
    const issues = lintClientRepo(repo({ "assets/extra.css": "/* Surcharge documentée : x */\n" }));
    expect(issues[0]!.message).toContain("styles/");
  });

  it("ignore les dossiers produits par les outils", () => {
    expect(lintClientRepo(repo({ "node_modules/x/index.js": "", ".open-next/worker.js": "" }))).toEqual([]);
  });
});
