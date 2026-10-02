// Génère supabase/seed.sql : la boutique Maison Ferrand et les 6 commandes de la maquette du back-office,
// à partir de la maquette et du catalogue de démonstration. Usage : node packages/db/scripts/generate-seed.mjs
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const mock = readFileSync(join(root, "project/Back-office commercant.dc.html"), "utf8");
const ctx = {};
vm.runInNewContext(
  mock.slice(mock.indexOf("const ORDERS = ["), mock.indexOf("const PRODUCTS")).replace("const ORDERS", "ORDERS"),
  ctx,
);
const catalog = JSON.parse(readFileSync(join(root, "examples/maison-ferrand/content/catalogue.json"), "utf8"));

const SHOP = "f0000000-0000-4000-8000-000000000001";
// Clé de hachage de démonstration uniquement : en production, une clé aléatoire par boutique, en secret.
const DEMO_HASH_KEY = "demo-cle-de-hachage-maison-ferrand-0001";
const SLOTS = {
  "Aujourd'hui 16:00 – 19:00": ["2026-10-02 16:00+02", "2026-10-02 19:00+02"],
  "Demain 10:00 – 12:00": ["2026-10-03 10:00+02", "2026-10-03 12:00+02"],
  "Hier 16:00 – 19:00": ["2026-10-01 16:00+02", "2026-10-01 19:00+02"],
};
const STATUS = { nouvelle: "new", preparation: "preparing", prete: "ready", retiree: "collected" };

const q = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const product = (name) => {
  const p = catalog.find((c) => c.name === name || c.name.startsWith(name) || name.startsWith(c.name));
  if (!p) throw new Error(`Produit introuvable dans le catalogue : ${name}`);
  return p;
};
const paidAt = (label) => {
  const [, day, h, m] = /(\d+) oct\. à (\d+):(\d+)/.exec(label);
  return `2026-10-${day.padStart(2, "0")} ${h}:${m}+02`;
};

let sql = `-- Généré par packages/db/scripts/generate-seed.mjs — ne pas modifier à la main.
-- Données de démonstration (supabase db reset) : la boutique Maison Ferrand et les 6 commandes de la maquette
-- du back-office. Les numéros sont attribués par la base (1 à 6) ; la maquette affiche #2466 à #2471.

insert into public.shops (id, slug, name, domain, core_version)
values (${q(SHOP)}, 'maison-ferrand', 'Maison Ferrand', 'maison-ferrand.fr', '1.0.0-alpha.1');

insert into public.product_availability (shop_id, product_id, available) values
  (${q(SHOP)}, 'terrine', false),
  (${q(SHOP)}, 'biscuit', false);
`;

[...ctx.ORDERS].reverse().forEach((o, i) => {
  const id = `f1000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
  const lines = o.lignes.map((l) => ({ p: product(l.nom), qty: l.qte }));
  const total = lines.reduce((sum, { p, qty }) => sum + p.priceTtcCents * qty, 0);
  const ttcByRate = {};
  for (const { p, qty } of lines) ttcByRate[p.vatRate] = (ttcByRate[p.vatRate] ?? 0) + p.priceTtcCents * qty;
  const vat = Object.fromEntries(
    Object.entries(ttcByRate).map(([rate, ttc]) => [rate, Math.round((ttc * Number(rate)) / (100 + Number(rate)))]),
  );
  const hash = createHmac("sha256", DEMO_HASH_KEY).update(o.email.trim().toLowerCase()).digest("hex");
  const [start, end] = SLOTS[o.creneau];
  sql += `
-- ${o.ref} ${o.client}
insert into public.orders (id, shop_id, status, slot_start, slot_end, email, phone, customer_hash, total_cents, vat_breakdown, stripe_session_id, paid_at)
values (${q(id)}, ${q(SHOP)}, ${q(STATUS[o.statut])}, ${q(start)}, ${q(end)}, ${q(o.email)}, ${o.tel === "—" ? "null" : q(o.tel)}, ${q(hash)}, ${total}, ${q(JSON.stringify(vat))}, ${q(`cs_demo_${o.ref.slice(1)}`)}, ${q(paidAt(o.payee))});
insert into public.order_items (order_id, shop_id, product_id, name, format, unit_price_cents, vat_rate, quantity, is_alcohol) values
${lines.map(({ p, qty }) => `  (${q(id)}, ${q(SHOP)}, ${q(p.id)}, ${q(p.name)}, ${q(p.format)}, ${p.priceTtcCents}, ${p.vatRate}, ${qty}, ${p.isAlcohol})`).join(",\n")};
`;
});

writeFileSync(join(root, "packages/db/supabase/seed.sql"), sql);
console.log("supabase/seed.sql écrit");
