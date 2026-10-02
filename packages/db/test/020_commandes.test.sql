-- Lot 2 : numérotation, idempotence, intégrité des commandes.
begin;
select plan(14);

\ir support/fixtures.psql

-- Numérotation par boutique, attribuée par la base.
select is((select number from public.orders where id = 'a0000000-0000-0000-0000-000000000001'), 1,
  'première commande de A : numéro 1');
select is((select number from public.orders where id = 'b0000000-0000-0000-0000-000000000001'), 1,
  'première commande de B : numéro 1, séquence indépendante');

insert into public.orders (id, shop_id, number, slot_start, slot_end, email, total_cents, stripe_session_id, paid_at)
values ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 999,
        now(), now() + interval '2 hours', 'c@exemple.fr', 980, 'cs_test_a2', now());
select is((select number from public.orders where id = 'a0000000-0000-0000-0000-000000000002'), 2,
  'numéro fourni par l''appelant ignoré : la base attribue 2');

-- T2.6 : idempotence du webhook.
insert into public.stripe_events (event_id, shop_id, type)
values ('evt_a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'checkout.session.completed')
on conflict (event_id) do nothing;
select is((select count(*)::int from public.stripe_events where event_id = 'evt_a1'), 1,
  'T2.6 même event_id inséré deux fois : une seule ligne');
select throws_ok(
  $$ insert into public.stripe_events (event_id, shop_id, type)
     values ('evt_a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'checkout.session.completed') $$,
  '23505', null, 'event_id en double sans on conflict : violation d''unicité');

select throws_ok(
  $$ insert into public.orders (shop_id, slot_start, slot_end, email, total_cents, stripe_session_id, paid_at)
     values ('aaaaaaaa-0000-0000-0000-000000000000', now(), now() + interval '1 hour', 'd@exemple.fr', 100, 'cs_test_a1', now()) $$,
  '23505', null, 'une session Stripe ne crée qu''une commande');

-- Intégrité.
select throws_ok(
  $$ insert into public.order_items (order_id, shop_id, product_id, name, unit_price_cents, vat_rate, quantity)
     values ('a0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'x', 'X', 100, 5.5, 1) $$,
  '23514', null, 'une ligne ne peut pas appartenir à une autre boutique que sa commande');
select throws_ok(
  $$ insert into public.order_items (order_id, shop_id, product_id, name, unit_price_cents, vat_rate, quantity)
     values ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'x', 'X', 100, 10, 1) $$,
  '23514', null, 'taux de TVA limité à 5,5 et 20');
select throws_ok(
  $$ insert into public.order_items (order_id, shop_id, product_id, name, unit_price_cents, vat_rate, quantity)
     values ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'x', 'X', 100, 5.5, 21) $$,
  '23514', null, 'quantité limitée à 20 par ligne');
select throws_ok(
  $$ insert into public.orders (shop_id, slot_start, slot_end, email, total_cents, stripe_session_id, paid_at)
     values ('aaaaaaaa-0000-0000-0000-000000000000', now(), now() - interval '1 hour', 'e@exemple.fr', 100, 'cs_e', now()) $$,
  '23514', null, 'un créneau finit après son début');
select throws_ok(
  $$ update public.orders set email = null where id = 'a0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'email effaçable seulement avec une date d''anonymisation');
select lives_ok(
  $$ update public.orders set email = null, phone = null, customer_hash = null, anonymized_at = now()
     where id = 'a0000000-0000-0000-0000-000000000001' $$,
  'anonymisation : coordonnées effacées, montants conservés');

-- Historique des statuts.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
update public.orders set status = 'preparing' where id = 'a0000000-0000-0000-0000-000000000002';
reset role;
select results_eq(
  $$ select from_status::text, to_status::text, actor::text from public.order_status_events
     where order_id = 'a0000000-0000-0000-0000-000000000002' order by id $$,
  $$ values (null::text, 'new'::text, null::text), ('new', 'preparing', '00000000-0000-0000-0000-00000000000a') $$,
  'chaque changement de statut est journalisé avec son auteur');
select is((select count(*)::int from public.shop_counters
           where shop_id in ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-000000000000')), 2,
  'un compteur par boutique ayant des commandes');

select * from finish();
rollback;
