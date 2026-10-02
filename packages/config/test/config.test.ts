import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkAlcoholFeature,
  ConfigError,
  fontSlug,
  loadConfig,
  openDays,
  toE164,
  validateConfig,
  type ConfigIssue,
} from "../src/index.ts";
import { cadrageExample, makeSite } from "./fixtures.ts";

const NOW = new Date("2026-10-02T08:00:00Z"); // vendredi

function issuesOf(fn: () => unknown): ConfigIssue[] {
  try {
    fn();
  } catch (error) {
    if (error instanceof ConfigError) return error.issues;
    throw error;
  }
  throw new Error("Une ConfigError était attendue");
}

function withChange(change: (c: Record<string, any>) => void): Record<string, any> {
  const c = cadrageExample();
  change(c);
  return c;
}

describe("schéma de configuration", () => {
  it("T1.1 accepte l'exemple complet du cadrage", () => {
    const config = validateConfig(cadrageExample(), { now: NOW });
    expect(config.boutique.nom).toBe("Maison Exemple");
    expect(config.design.typographies.titres).toEqual({ famille: "Playfair Display", graisses: [400, 600] });
    expect(config.design.couleurs.fond).toBe("#FAF8F3");
  });

  it("T1.2 signale boutique.nom absent avec son chemin", () => {
    const issues = issuesOf(() =>
      validateConfig(
        withChange((c) => delete c.boutique.nom),
        { now: NOW },
      ),
    );
    expect(issues.map((i) => i.path)).toContain("boutique.nom");
  });

  it("T1.3 refuse une variante « D »", () => {
    const issues = issuesOf(() =>
      validateConfig(
        withChange((c) => (c.design.variantes.accueil = "D")),
        { now: NOW },
      ),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.path).toBe("design.variantes.accueil");
    expect(issues[0]!.message).toMatch(/A.*B.*C/);
  });

  it("T1.4 refuse un créneau dont le début suit la fin", () => {
    const issues = issuesOf(() =>
      validateConfig(
        withChange((c) => (c.retrait.creneaux.mardi = ["19:00-16:00"])),
        { now: NOW },
      ),
    );
    expect(issues[0]!.path).toBe("retrait.creneaux.mardi.0");
    expect(issues[0]!.message).toContain("début");
  });

  it("T1.5 refuse arrondis « carré »", () => {
    const issues = issuesOf(() =>
      validateConfig(
        withChange((c) => (c.design.arrondis = "carré")),
        { now: NOW },
      ),
    );
    expect(issues[0]!.path).toBe("design.arrondis");
    expect(issues[0]!.message).toMatch(/net.*doux.*rond/);
  });

  it("refuse une couleur non hexadécimale et normalise #abc", () => {
    expect(
      issuesOf(() =>
        validateConfig(
          withChange((c) => (c.design.couleurs.fond = "beige")),
          { now: NOW },
        ),
      )[0]!.path,
    ).toBe("design.couleurs.fond");
    const config = validateConfig(
      withChange((c) => (c.design.couleurs.fond = "#fa0")),
      { now: NOW },
    );
    expect(config.design.couleurs.fond).toBe("#FFAA00");
  });

  it("refuse une troisième graisse", () => {
    const issues = issuesOf(() =>
      validateConfig(
        withChange((c) => (c.design.typographies.texte = { famille: "Work Sans", graisses: [400, 500, 600] })),
        { now: NOW },
      ),
    );
    expect(issues[0]!.path).toBe("design.typographies.texte.graisses");
  });

  it("refuse deux créneaux qui se chevauchent le même jour", () => {
    const issues = issuesOf(() =>
      validateConfig(
        withChange((c) => (c.retrait.creneaux.mardi = ["10:00-12:00", "11:30-13:00"])),
        { now: NOW },
      ),
    );
    expect(issues[0]!.path).toBe("retrait.creneaux.mardi");
  });

  it("refuse une clé inconnue (faute de frappe)", () => {
    const issues = issuesOf(() =>
      validateConfig(
        withChange((c) => (c.features.alcol = true)),
        { now: NOW },
      ),
    );
    expect(issues[0]!.path).toBe("features");
  });

  it("refuse un logo qui n'est pas un SVG", () => {
    const issues = issuesOf(() =>
      validateConfig(
        withChange((c) => (c.design.logo = "./logo.png")),
        { now: NOW },
      ),
    );
    expect(issues[0]!.path).toBe("design.logo");
  });

  it("regroupe toutes les erreurs dans un seul message lisible", () => {
    const error = (() => {
      try {
        validateConfig(
          withChange((c) => {
            delete c.boutique.nom;
            c.design.arrondis = "carré";
          }),
          { now: NOW, source: "launchpad.config.yaml" },
        );
      } catch (e) {
        return e as ConfigError;
      }
    })()!;
    expect(error.issues).toHaveLength(2);
    expect(error.message).toContain("launchpad.config.yaml");
    expect(error.message).toContain("boutique.nom");
    expect(error.message).toContain("design.arrondis");
  });
});

describe("téléphone", () => {
  it("T1.13 normalise « 04 67 00 00 00 » en E.164", () => {
    expect(toE164("04 67 00 00 00")).toBe("+33467000000");
    expect(
      validateConfig(
        withChange((c) => (c.boutique.telephone = "04 67 00 00 00")),
        { now: NOW },
      ).boutique.telephone,
    ).toBe("+33467000000");
  });

  it("refuse un numéro non convertible", () => {
    expect(toE164("12")).toBeNull();
    expect(
      issuesOf(() =>
        validateConfig(
          withChange((c) => (c.boutique.telephone = "12")),
          { now: NOW },
        ),
      )[0]!.path,
    ).toBe("boutique.telephone");
  });
});

describe("contrôles croisés", () => {
  it("T1.14 refuse un produit alcoolisé quand features.alcool est faux", () => {
    const config = validateConfig(
      withChange((c) => (c.features.alcool = false)),
      { now: NOW },
    );
    const issues = issuesOf(() =>
      checkAlcoholFeature(config, [
        { name: "Miel de châtaignier", isAlcohol: false },
        { name: "Vin orange, Domaine Lasserre", isAlcohol: true },
      ]),
    );
    expect(issues[0]!.path).toBe("features.alcool");
    expect(issues[0]!.message).toContain("Vin orange");
  });

  it("accepte un produit alcoolisé quand l'option est active", () => {
    const config = validateConfig(cadrageExample(), { now: NOW });
    expect(() => checkAlcoholFeature(config, [{ name: "Vin", isAlcohol: true }])).not.toThrow();
  });

  it("T0.3 refuse une core_version différente du core installé", () => {
    const issues = issuesOf(() => validateConfig(cadrageExample(), { now: NOW, coreVersion: "1.1.0" }));
    expect(issues[0]!.path).toBe("core_version");
    expect(issues[0]!.message).toContain("1.1.0");
  });

  it("exige au moins un créneau dans les 14 prochains jours", () => {
    const config = validateConfig(cadrageExample(), { now: NOW });
    expect(openDays(config, NOW)).toEqual([
      "2026-10-03",
      "2026-10-06",
      "2026-10-07",
      "2026-10-10",
      "2026-10-13",
      "2026-10-14",
    ]);
    const allClosed = withChange((c) => (c.retrait.fermetures = openDays(config, NOW)));
    expect(issuesOf(() => validateConfig(allClosed, { now: NOW }))[0]!.path).toBe("retrait.creneaux");
  });

  it("calcule le jour à l'heure de Paris, pas en UTC", () => {
    // 23:30 UTC le 2 octobre = 01:30 le 3 octobre à Paris (samedi).
    const config = validateConfig(cadrageExample(), { now: NOW });
    expect(openDays(config, new Date("2026-10-02T23:30:00Z"))[0]).toBe("2026-10-03");
  });
});

describe("chargement et fichiers", () => {
  it("charge un site complet et liste ses polices", () => {
    const loaded = loadConfig(makeSite(), { now: NOW });
    expect(loaded.fonts.map((f) => f.fileName)).toEqual([
      "playfair-display-400.woff2",
      "playfair-display-600.woff2",
      "work-sans-400.woff2",
      "work-sans-600.woff2",
    ]);
  });

  it("échoue si une police manque", () => {
    const dir = makeSite(cadrageExample(), { fonts: ["playfair-display-400", "work-sans-400", "work-sans-600"] });
    const issues = issuesOf(() => loadConfig(dir, { now: NOW }));
    expect(issues).toEqual([
      { path: "design.typographies.titres", message: "Police manquante : assets/fonts/playfair-display-600.woff2" },
    ]);
  });

  it("échoue si un fichier de police n'est pas du WOFF2", () => {
    const dir = makeSite();
    writeFileSync(join(dir, "assets/fonts/work-sans-400.woff2"), "pas une police");
    expect(issuesOf(() => loadConfig(dir, { now: NOW }))[0]!.message).toContain("n'est pas un fichier WOFF2");
  });

  it("échoue si le logo est absent", () => {
    const issues = issuesOf(() => loadConfig(makeSite(cadrageExample(), { logo: null }), { now: NOW }));
    expect(issues[0]!.path).toBe("design.logo");
  });

  it("signale un YAML illisible", () => {
    const dir = makeSite();
    writeFileSync(join(dir, "launchpad.config.yaml"), "boutique: [non fermé");
    expect(issuesOf(() => loadConfig(dir))[0]!.message).toContain("YAML illisible");
  });

  it("dérive le nom de fichier de la famille", () => {
    expect(fontSlug("Playfair Display")).toBe("playfair-display");
    expect(fontSlug("Crème Brûlée Sans")).toBe("creme-brulee-sans");
  });

  it("charge les trois configurations d'exemple des maquettes", () => {
    for (const site of ["maison-ferrand", "noir-et-sel", "comptoir-saint-roch"]) {
      const loaded = loadConfig(join(__dirname, "../../../examples", site), { now: NOW, coreVersion: "1.0.0-alpha.1" });
      expect(loaded.fonts).toHaveLength(4);
    }
  });
});
