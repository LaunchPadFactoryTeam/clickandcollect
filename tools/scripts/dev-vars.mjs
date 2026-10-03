#!/usr/bin/env node
// Écrit apps/site/.dev.vars : variables du Worker pour tester le tunnel de paiement en local, avec la base Supabase
// locale, le faux fournisseur de paiement et le faux prestataire d'emails. Jamais pour la production : les secrets y sont ceux du poste de dev.
// Usage : node tools/scripts/dev-vars.mjs   (variables facultatives : SUPABASE_URL, JWT_SECRET, SHOP_ID)
import { writeFileSync } from "node:fs";
import { register } from "tsx/esm/api";

register();
const { signSiteToken } = await import("../../packages/db/src/site-token.ts");

const url = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
// Secret JWT par défaut de la stack Supabase locale (public, documenté par Supabase).
const jwtSecret = process.env.JWT_SECRET ?? "super-secret-jwt-token-with-at-least-32-characters-long";
// Boutique Maison Ferrand de packages/db/supabase/seed.sql.
const shopId = process.env.SHOP_ID ?? "f0000000-0000-4000-8000-000000000001";

const vars = {
  SUPABASE_URL: url,
  SUPABASE_SHOP_JWT: signSiteToken({ shopId, jwtSecret }),
  SHOP_HASH_KEY: "cle-de-hachage-locale-de-la-boutique-de-demo",
  LP_PSP: "fake",
  FAKE_PSP_SECRET: "secret-local-du-faux-fournisseur-de-paiement",
  // Emails composés et journalisés, jamais envoyés.
  LP_EMAIL: "fake",
  CRON_SECRET: "secret-local-de-la-tache-planifiee-des-emails",
};
const file = new URL("../../apps/site/.dev.vars", import.meta.url);
writeFileSync(
  file,
  Object.entries(vars)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
);
console.log(`Variables du Worker écrites dans apps/site/.dev.vars (boutique ${shopId}, paiement factice)`);
