import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig, type ClientConfig } from "@launchpadfactoryteam/config";
import { main } from "../src/cli.ts";
import {
  accessibilityLabel,
  customerHash,
  hmacSha256Hex,
  LEGAL_SLUGS,
  legalDocuments,
  normalizeEmail,
  processingAgreement,
  processingRecord,
  RETENTION,
  sha256Hex,
  type LegalDocument,
} from "../src/index.ts";

const NOW = new Date("2026-10-02T08:00:00Z");
const example = (name: string) => join(__dirname, `../../../examples/${name}`);
const config: ClientConfig = loadConfig(example("maison-ferrand"), { now: NOW }).config;
const docs = legalDocuments({ config, shopEmail: "bonjour@maison-ferrand.fr" });

/** Texte intégral d'une page, pour y chercher les informations injectées. */
const text = (doc: LegalDocument) =>
  doc.sections
    .flatMap((s) => [
      s.heading,
      ...s.blocks.flatMap((b) =>
        typeof b === "string" ? [b] : "list" in b ? b.list : b.facts.map(([label, value]) => `${label} : ${value}`),
      ),
    ])
    .join("\n");

describe("empreinte client", () => {
  it("T8.1 normalisation : espaces retirés, minuscules", () => {
    expect(normalizeEmail("  Paul.Martin@Exemple.FR ")).toBe("paul.martin@exemple.fr");
    expect(normalizeEmail("paul .martin@exemple.fr\t")).toBe("paul.martin@exemple.fr");
  });

  it("T8.2 même email (à la casse près), même clé : même empreinte", async () => {
    const key = "a".repeat(32);
    expect(await customerHash(key, "Paul.Martin@Exemple.FR")).toBe(await customerHash(key, " paul.martin@exemple.fr"));
  });

  it("T8.3 même email, clés de deux boutiques : empreintes différentes", async () => {
    expect(await customerHash("a".repeat(32), "paul@exemple.fr")).not.toBe(
      await customerHash("b".repeat(32), "paul@exemple.fr"),
    );
  });

  it("T8.4 vecteur de test HMAC-SHA256 connu (RFC 4231, cas 2) ; SHA-256 de « abc »", async () => {
    expect(await hmacSha256Hex("Jefe", "what do ya want for nothing?")).toBe(
      "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
    );
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("pages légales", () => {
  it("T8.13 configuration d'exemple : raison sociale, adresse et contact RGPD injectés", () => {
    expect(Object.keys(docs)).toEqual([...LEGAL_SLUGS]);
    expect(text(docs["mentions-legales"])).toContain("Maison Ferrand, SARL au capital de 10 000 €");
    expect(text(docs["mentions-legales"])).toContain("Siège social : 12 rue des Halles, 34000 Montpellier");
    expect(text(docs["mentions-legales"])).toContain("SIRET : 000 000 000 00011");
    expect(text(docs["mentions-legales"])).toContain("Claire Ferrand");
    expect(text(docs.confidentialite)).toContain("donnees@maison-ferrand.fr");
    expect(text(docs["mes-droits"])).toContain("donnees@maison-ferrand.fr");
    expect(text(docs.cgv)).toContain("Médiateur de la consommation (démonstration) (https://www.example.fr/mediateur)");
  });

  it("CGV : exception de rétractation des denrées périssables, 14 jours pour le reste, paragraphe alcool si l'option est active", () => {
    const cgv = text(docs.cgv);
    expect(cgv).toContain("article L221-28, 4°");
    expect(cgv).toContain("14 jours à compter du retrait");
    expect(cgv).toContain("interdite aux mineurs");
    const sansAlcool = legalDocuments({
      config: { ...config, features: { ...config.features, alcool: false } },
      shopEmail: "x@y.fr",
    });
    expect(text(sansAlcool.cgv)).not.toContain("interdite aux mineurs");
  });

  it("confidentialité : durées du cadrage, prestataires, CNIL", () => {
    const privacy = text(docs.confidentialite);
    expect(privacy).toContain(`${RETENTION.customerYears} ans après la dernière commande`);
    expect(privacy).toContain(`${RETENTION.salesYears} ans, sans aucune donnée personnelle`);
    for (const name of ["Cloudflare", "Supabase", "Stripe", "Brevo"]) expect(privacy).toContain(name);
    expect(privacy).toContain("CNIL");
  });

  it("cookies : aucun cookie sur les pages, Umami cité seulement s'il est configuré", () => {
    expect(text(docs.cookies)).toContain("Aucun outil de mesure d'audience");
    const withUmami = legalDocuments({
      config: { ...config, audience: { ...config.audience, umami_website_id: "11111111-1111-4111-8111-111111111111" } },
      shopEmail: "x@y.fr",
    });
    expect(text(withUmami.cookies)).toContain("Umami, sans cookie");
  });

  it("accessibilité : non conforme sans audit ; conformité partielle avec la date et le taux de l'audit", () => {
    expect(text(docs.accessibilite)).toContain("est non conforme avec le RGAA");
    expect(accessibilityLabel(config)).toBe("Accessibilité : non conforme");
    const audited = {
      ...config,
      legal: {
        ...config.legal,
        accessibilite: { etat: "partiellement_conforme" as const, date_audit: "2026-09-15", taux_conformite: 84 },
      },
    };
    const doc = text(legalDocuments({ config: audited, shopEmail: "x@y.fr" }).accessibilite);
    expect(doc).toContain("partiellement conforme");
    expect(doc).toContain("15 septembre 2026 révèle que 84 % des critères");
    expect(accessibilityLabel(audited)).toBe("Accessibilité : partiellement conforme");
  });
});

describe("modèles documentaires", () => {
  it("contrat de sous-traitance et fiche du registre remplis depuis la configuration", () => {
    const contract = processingAgreement(config);
    expect(contract).toContain("Maison Ferrand, SARL, 12 rue des Halles, 34000 Montpellier, SIRET 000 000 000 00011");
    expect(contract).toContain("article 28 du RGPD");
    expect(contract).toContain("Stripe Payments Europe");
    const record = processingRecord(config);
    expect(record).toContain("donnees@maison-ferrand.fr");
    expect(record).toContain("Commandes en ligne et retrait en boutique sur maison-ferrand.fr");
  });

  it("lp-rgpd documents écrit les deux fichiers ; usage affiché sans arguments", async () => {
    const out = mkdtempSync(join(tmpdir(), "lp-rgpd-"));
    expect(await main(["documents", example("noir-et-sel"), out])).toBe(0);
    expect(readFileSync(join(out, "contrat-sous-traitance.md"), "utf8")).toContain("Noir & Sel");
    expect(readFileSync(join(out, "registre-des-traitements.md"), "utf8")).toContain("donnees@noir-et-sel.fr");
    expect(await main([])).toBe(2);
  });
});
