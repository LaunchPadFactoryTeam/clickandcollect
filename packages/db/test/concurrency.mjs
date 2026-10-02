// T2.5 : 50 commandes insérées en parallèle sur 10 connexions reçoivent 50 numéros uniques et consécutifs.
// Lancé par tools/scripts/test-db.sh après pg_prove (connexion par les variables PG*).
import pg from "pg";

const SHOP = "cccccccc-0000-0000-0000-000000000000";
const admin = new pg.Client();
await admin.connect();
await admin.query(
  `insert into public.shops (id, slug, name, domain, core_version)
   values ($1, 'concurrence', 'Concurrence', 'concurrence.test', '1.0.0')`,
  [SHOP],
);

let ok;
try {
  const pool = new pg.Pool({ max: 10 });
  await Promise.all(
    Array.from({ length: 50 }, (_, i) =>
      pool.query(
        `insert into public.orders (shop_id, slot_start, slot_end, email, total_cents, stripe_session_id, paid_at)
         values ($1, now(), now() + interval '1 hour', $2, 100, $3, now())`,
        [SHOP, `client${i}@exemple.fr`, `cs_concurrence_${i}`],
      ),
    ),
  );
  await pool.end();
  const { rows } = await admin.query("select number from public.orders where shop_id = $1 order by number", [SHOP]);
  const numbers = rows.map((r) => r.number);
  ok = numbers.length === 50 && numbers.every((n, i) => n === i + 1);
  console.log(
    ok ? "ok - T2.5 50 insertions concurrentes : numéros 1 à 50" : `not ok - T2.5 numéros obtenus : ${numbers}`,
  );
} finally {
  await admin.query("delete from public.orders where shop_id = $1", [SHOP]);
  await admin.query("delete from public.shop_counters where shop_id = $1", [SHOP]);
  await admin.query("delete from public.order_status_events where shop_id = $1", [SHOP]);
  await admin.query("delete from public.shops where id = $1", [SHOP]);
  await admin.end();
}
process.exit(ok ? 0 : 1);
