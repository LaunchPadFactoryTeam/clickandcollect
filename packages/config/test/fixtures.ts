import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";

/** Exemple de configuration repris tel quel du document de cadrage (section 5). */
export function cadrageExample(): Record<string, any> {
  return {
    boutique: {
      nom: "Maison Exemple",
      domaine: "maison-exemple.fr",
      adresse: "12 rue des Halles, 34000 Montpellier",
      telephone: "04 00 00 00 00",
      email_notifications: "commandes@maison-exemple.fr",
    },
    legal: {
      raison_sociale: "Maison Exemple SARL",
      siret: "123 456 789 00012",
      directeur_publication: "Paul Martin",
      contact_rgpd: "donnees@maison-exemple.fr",
      mediateur: { nom: "Médiateur de démonstration", site: "https://www.example.fr" },
    },
    design: {
      couleurs: { primaire: "#2F4A3A", secondaire: "#C8A24A", fond: "#FAF8F3" },
      typographies: { titres: "Playfair Display", texte: "Work Sans" },
      arrondis: "doux",
      logo: "./assets/logo.svg",
      variantes: { accueil: "B", boutique: "A", fiche_produit: "A", epicerie: "C", contact: "A" },
    },
    retrait: {
      delai_preparation_heures: 2,
      creneaux: {
        mardi: ["10:00-12:00", "16:00-19:00"],
        mercredi: ["10:00-12:00", "16:00-19:00"],
        samedi: ["09:00-13:00", "15:00-19:00"],
      },
      fermetures: [],
    },
    paiement: { psp: "stripe", stripe_compte_connecte: "acct_xxx" },
    features: { alcool: true, codes_promo: false, message_cadeau: false, precommandes: false },
    core_version: "1.0.0",
  };
}

const WOFF2 = Buffer.concat([Buffer.from("wOF2"), Buffer.alloc(16)]);

/** Crée un dossier de site temporaire avec config, logo et polices factices. */
export function makeSite(
  config: Record<string, any> = cadrageExample(),
  options: { fonts?: string[]; logo?: string | null } = {},
): string {
  const dir = mkdtempSync(join(tmpdir(), "lp-site-"));
  mkdirSync(join(dir, "assets/fonts"), { recursive: true });
  writeFileSync(join(dir, "launchpad.config.yaml"), stringify(config));
  if (options.logo !== null)
    writeFileSync(join(dir, "assets/logo.svg"), options.logo ?? '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const fonts = options.fonts ?? ["playfair-display-400", "playfair-display-600", "work-sans-400", "work-sans-600"];
  for (const f of fonts) writeFileSync(join(dir, "assets/fonts", `${f}.woff2`), WOFF2);
  return dir;
}
