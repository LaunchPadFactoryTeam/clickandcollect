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
// Compte de démonstration de la base locale, documenté dans DEVELOPPEMENT.md ; jamais créé en production.
const MERCHANT = "f2000000-0000-4000-8000-000000000001";
const MERCHANT_EMAIL = "commandes@maison-ferrand.fr";
const MERCHANT_PASSWORD = "demo-maison-ferrand";
// Clé de hachage de démonstration uniquement : en production, une clé aléatoire par boutique, en secret.
const DEMO_HASH_KEY = "demo-cle-de-hachage-maison-ferrand-0001";
// Dates relatives au jour du `supabase db reset` (heure de Paris) : « Aujourd'hui », « Demain » et « Hier » comme
// dans la maquette, quel que soit le jour de la démonstration.
const paris = (dayOffset, time) =>
  `(((now() at time zone 'Europe/Paris')::date + ${dayOffset}) + time '${time}') at time zone 'Europe/Paris'`;
const SLOTS = {
  "Aujourd'hui 16:00 – 19:00": [paris(0, "16:00"), paris(0, "19:00")],
  "Demain 10:00 – 12:00": [paris(1, "10:00"), paris(1, "12:00")],
  "Hier 16:00 – 19:00": [paris(-1, "16:00"), paris(-1, "19:00")],
};
const STATUS = { nouvelle: "new", preparation: "preparing", prete: "ready", retiree: "collected" };

const q = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const product = (name) => {
  const p = catalog.find((c) => c.name === name || c.name.startsWith(name) || name.startsWith(c.name));
  if (!p) throw new Error(`Produit introuvable dans le catalogue : ${name}`);
  return p;
};
// « 2 oct. à 09:12 » dans la maquette, qui se passe le 2 octobre : même décalage par rapport au jour de la démonstration.
const paidAt = (label) => {
  const [, day, h, m] = /(\d+) oct\. à (\d+):(\d+)/.exec(label);
  return paris(Number(day) - 2, `${h}:${m}`);
};

let sql = `-- Généré par packages/db/scripts/generate-seed.mjs — ne pas modifier à la main.
-- Données de démonstration (supabase db reset) : la boutique Maison Ferrand et les 6 commandes de la maquette
-- du back-office. Les numéros sont attribués par la base (1 à 6) ; la maquette affiche #2466 à #2471.

insert into public.shops (id, slug, name, domain, core_version)
values (${q(SHOP)}, 'maison-ferrand', 'Maison Ferrand', 'maison-ferrand.fr', '1.0.0-alpha.1');

-- Compte back-office de démonstration (local uniquement) : ${MERCHANT_EMAIL} / ${MERCHANT_PASSWORD}
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
                        raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', ${q(MERCHANT)}, 'authenticated', 'authenticated', ${q(MERCHANT_EMAIL)},
        extensions.crypt(${q(MERCHANT_PASSWORD)}, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
values (gen_random_uuid(), ${q(MERCHANT)}, ${q(MERCHANT)}, 'email',
        jsonb_build_object('sub', ${q(MERCHANT)}, 'email', ${q(MERCHANT_EMAIL)}), now(), now());
insert into public.shop_users (user_id, shop_id) values (${q(MERCHANT)}, ${q(SHOP)});

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
insert into public.orders (id, shop_id, status, slot_start, slot_end, email, phone, customer_name, customer_hash, total_cents, vat_breakdown, stripe_session_id, paid_at)
values (${q(id)}, ${q(SHOP)}, ${q(STATUS[o.statut])}, ${start}, ${end}, ${q(o.email)}, ${o.tel === "—" ? "null" : q(o.tel)}, ${q(o.client)}, ${q(hash)}, ${total}, ${q(JSON.stringify(vat))}, ${q(`cs_demo_${o.ref.slice(1)}`)}, ${paidAt(o.payee)});
insert into public.order_items (order_id, shop_id, product_id, name, format, unit_price_cents, vat_rate, quantity, is_alcohol) values
${lines.map(({ p, qty }) => `  (${q(id)}, ${q(SHOP)}, ${q(p.id)}, ${q(p.name)}, ${q(p.format)}, ${p.priceTtcCents}, ${p.vatRate}, ${qty}, ${p.isAlcohol})`).join(",\n")};
`;
});

writeFileSync(join(root, "packages/db/supabase/seed.sql"), sql);
console.log("supabase/seed.sql écrit");
