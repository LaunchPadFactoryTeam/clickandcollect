-- Lot 5 : enregistrement transactionnel d'un paiement par le site.
begin;
select plan(16);

\ir support/fixtures.psql

create temporary table payload as select jsonb_build_object(
  'event_id', 'evt_lot5_1', 'event_type', 'checkout.session.completed',
  'shop_id', 'aaaaaaaa-0000-0000-0000-000000000000',
  'session_id', 'cs_test_lot5_1', 'payment_intent_id', 'pi_lot5_1',
  'slot_start', '2026-10-06T14:00:00Z', 'slot_end', '2026-10-06T17:00:00Z',
  'email', 'client@exemple.fr', 'phone', '+33612345678', 'customer_hash', repeat('c', 64),
  'total_cents', 4700, 'vat_breakdown', '{"5.5": 130, "20": 367}'::jsonb,
  'items', '[{"product_id":"miel","name":"Miel","format":"Pot 250 g","unit_price_cents":1250,"vat_rate":5.5,"quantity":2},
             {"product_id":"vin","name":"Vin","format":"75 cl","unit_price_cents":2200,"vat_rate":20,"quantity":1,"is_alcohol":true}]'::jsonb,
  'consent', jsonb_build_object('version', '2026-10-02', 'hash', repeat('d', 64))
) as p;
grant select on payload to lp_site;

set local role lp_site;
select set_config('request.jwt.claims', '{"role":"lp_site","shop_id":"aaaaaaaa-0000-0000-0000-000000000000"}', true);

select is((select public.record_paid_checkout(p) ->> 'status' from payload), 'created',
  'T5.11 session payée : commande créée');
select is((select count(*)::int from public.orders where stripe_session_id = 'cs_test_lot5_1'), 1, 'une commande');
select is((select number from public.orders where stripe_session_id = 'cs_test_lot5_1'), 2,
  'numéro attribué par la base (deuxième commande de A)');
select is((select count(*)::int from public.order_items i join public.orders o on o.id = i.order_id
           where o.stripe_session_id = 'cs_test_lot5_1'), 2, 'ses deux lignes');
select is((select status::text from public.orders where stripe_session_id = 'cs_test_lot5_1'), 'new', 'statut « nouvelle »');
select is((select count(*)::int from public.consents where customer_hash = repeat('c', 64)), 1,
  'T5.11 case marketing cochée : consentement enregistré');
select is((select array_agg(kind order by kind) from public.email_outbox o
           where (o.payload ->> 'order_id')::uuid = (select id from public.orders where stripe_session_id = 'cs_test_lot5_1')),
  array['merchant_new_order', 'order_confirmation'], 'T5.11 emails client et commerçant dans l''outbox');
select isnt((select processed_at from public.stripe_events where event_id = 'evt_lot5_1'), null, 'événement marqué traité');

select is((select public.record_paid_checkout(p) ->> 'status' from payload), 'duplicate',
  'T5.9 même event_id reçu deux fois : doublon');
select is((select public.record_paid_checkout(p || '{"event_id":"evt_lot5_2","event_type":"checkout.session.async_payment_succeeded"}')
           ->> 'status' from payload), 'duplicate', 'même session, autre événement : doublon');
select is((select count(*)::int from public.orders where stripe_session_id = 'cs_test_lot5_1'), 1, 'toujours une seule commande');

-- T5.10 : une erreur au milieu annule tout, y compris l'event_id (Stripe pourra rejouer).
select throws_ok(
  $$ select public.record_paid_checkout(p || '{"event_id":"evt_lot5_3","session_id":"cs_test_lot5_3",
       "items":[{"product_id":"x","name":"X","unit_price_cents":100,"vat_rate":7,"quantity":1}]}') from payload $$,
  '23514', null, 'T5.10 ligne invalide : erreur');
select is((select count(*)::int from public.stripe_events where event_id = 'evt_lot5_3'), 0,
  'T5.10 aucune trace de l''événement : Stripe pourra le rejouer');
select is((select count(*)::int from public.orders where stripe_session_id = 'cs_test_lot5_3'), 0,
  'T5.10 aucune commande partielle');

select throws_ok(
  $$ select public.record_paid_checkout(p || '{"event_id":"evt_lot5_4","session_id":"cs_b","shop_id":"bbbbbbbb-0000-0000-0000-000000000000"}') from payload $$,
  '42501', null, 'une session d''une autre boutique est refusée');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.record_paid_checkout(p) from payload $$, '42501', null,
  'un commerçant ne peut pas enregistrer de paiement');
reset role;

select * from finish();
rollback;
