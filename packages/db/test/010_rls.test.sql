-- Lot 2 : cloisonnement par boutique (T2.1 à T2.4 et compléments).
begin;
select plan(24);

\ir support/fixtures.psql

-- ---------------------------------------------------------------------------
-- Commerçant de la boutique A
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is((select count(*)::int from public.orders), 1, 'commerçant A : ne voit que ses commandes');
select is((select count(*)::int from public.orders where shop_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 0,
  'T2.1 commerçant A : 0 commande de B, même en filtrant sur B');
select is((select count(*)::int from public.order_items), 1, 'commerçant A : ne voit que ses lignes de commande');
select is((select count(*)::int from public.shops), 1, 'commerçant A : ne voit que sa boutique');
select is((select count(*)::int from public.product_availability), 1, 'commerçant A : ne voit que ses disponibilités');

-- T2.2 : modifier le statut d'une commande de B ne touche aucune ligne.
with changed as (
  update public.orders set status = 'preparing'
  where id = 'b0000000-0000-0000-0000-000000000001' returning 1
)
select is((select count(*)::int from changed), 0, 'T2.2 commerçant A : 0 commande de B modifiée');

with changed as (
  update public.orders set status = 'preparing'
  where id = 'a0000000-0000-0000-0000-000000000001' returning 1
)
select is((select count(*)::int from changed), 1, 'commerçant A : peut faire avancer sa propre commande');

select throws_ok(
  $$ update public.orders set total_cents = 1 where id = 'a0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'commerçant A : ne peut pas modifier un montant');

select throws_ok(
  $$ insert into public.product_availability (shop_id, product_id, available)
     values ('bbbbbbbb-0000-0000-0000-000000000000', 'terrine', false) $$,
  '42501', null, 'commerçant A : ne peut pas créer une disponibilité chez B');

select lives_ok(
  $$ update public.product_availability set available = false
     where shop_id = 'aaaaaaaa-0000-0000-0000-000000000000' and product_id = 'miel' $$,
  'commerçant A : peut couper un de ses produits');

select is((select count(*)::int from public.stripe_events), 0, 'commerçant A : ne voit pas les journaux techniques');
select is((select count(*)::int from public.shop_users), 1, 'commerçant A : ne voit que son propre accès');
reset role;

-- ---------------------------------------------------------------------------
-- Jeton de site de la boutique A
-- ---------------------------------------------------------------------------
set local role lp_site;
select set_config('request.jwt.claims', '{"role":"lp_site","shop_id":"aaaaaaaa-0000-0000-0000-000000000000"}', true);

select is((select count(*)::int from public.orders), 1, 'site A : ne lit que les commandes de A');

select throws_ok(
  $$ insert into public.orders (shop_id, slot_start, slot_end, email, total_cents, stripe_session_id, paid_at)
     values ('bbbbbbbb-0000-0000-0000-000000000000', now(), now() + interval '1 hour', 'x@exemple.fr', 100, 'cs_x', now()) $$,
  '42501', null, 'T2.3 site A : écrire une commande avec shop_id B est refusé');

select throws_ok(
  $$ insert into public.product_availability (shop_id, product_id, available)
     values ('bbbbbbbb-0000-0000-0000-000000000000', 'vin', false) $$,
  '42501', null, 'T2.3 site A : écrire une disponibilité de B est refusé');

select lives_ok(
  $$ insert into public.orders (shop_id, slot_start, slot_end, email, total_cents, stripe_session_id, paid_at)
     values ('aaaaaaaa-0000-0000-0000-000000000000', now(), now() + interval '1 hour', 'y@exemple.fr', 100, 'cs_y', now()) $$,
  'site A : peut créer une commande de A (webhook)');

select is((select count(*)::int from public.stripe_events), 1, 'site A : lit ses événements Stripe');
select throws_ok($$ select * from public.shop_users $$, '42501', null, 'site A : aucun accès aux comptes');
reset role;

-- Jeton de site sans revendication shop_id : aucun accès.
set local role lp_site;
select set_config('request.jwt.claims', '{"role":"lp_site"}', true);
select is((select count(*)::int from public.orders), 0, 'site sans shop_id : 0 commande');
reset role;

-- ---------------------------------------------------------------------------
-- Admin LaunchPad (hub)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select is((select count(*)::int from public.orders where shop_id in (select id from public.shops where slug in ('boutique-a', 'boutique-b'))), 3,
  'T2.4 admin : lit les commandes de toutes les boutiques');
select is((select count(*)::int from public.shops where slug in ('boutique-a', 'boutique-b')), 2, 'T2.4 admin : lit toutes les boutiques');
with changed as (update public.orders set status = 'ready' returning 1)
select is((select count(*)::int from changed), 0, 'admin : lecture seule sur les commandes');
reset role;

-- ---------------------------------------------------------------------------
-- Anonyme et utilisateur sans boutique
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$ select * from public.orders $$, '42501', null, 'anonyme : aucun accès aux commandes');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ff","role":"authenticated"}', true);
select is((select count(*)::int from public.orders), 0, 'utilisateur sans boutique : 0 commande');
reset role;

select * from finish();
rollback;
