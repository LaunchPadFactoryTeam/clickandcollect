-- Lot 6 : file d'envoi et email « commande prête ».
begin;
select plan(11);

\ir support/fixtures.psql

-- Commerçant de A : passe la commande à « prête », revient en arrière, repasse à « prête ».
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
update public.orders set status = 'ready' where id = 'a0000000-0000-0000-0000-000000000001';
reset role;
select is((select count(*)::int from public.email_outbox where kind = 'order_ready'
           and payload ->> 'order_id' = 'a0000000-0000-0000-0000-000000000001'), 1,
  'premier passage à « prête » : un email en file');
select isnt((select ready_email_sent_at from public.orders where id = 'a0000000-0000-0000-0000-000000000001'), null,
  'ready_email_sent_at renseigné');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
update public.orders set status = 'preparing' where id = 'a0000000-0000-0000-0000-000000000001';
update public.orders set status = 'ready' where id = 'a0000000-0000-0000-0000-000000000001';
reset role;
select is((select count(*)::int from public.email_outbox where kind = 'order_ready'
           and payload ->> 'order_id' = 'a0000000-0000-0000-0000-000000000001'), 1,
  'T6.5 second passage à « prête » : aucun nouvel email');

-- Réservation par le site de A.
insert into public.email_outbox (shop_id, kind, payload, next_attempt_at) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'order_confirmation', '{"order_id":"x"}', now() - interval '1 minute'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'order_confirmation', '{"order_id":"plus-tard"}', now() + interval '1 hour'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'order_confirmation', '{"order_id":"autre-boutique"}', now() - interval '1 minute');

set local role lp_site;
select set_config('request.jwt.claims', '{"role":"lp_site","shop_id":"aaaaaaaa-0000-0000-0000-000000000000"}', true);
create temporary table claimed as select * from public.claim_email_outbox(20);
select is((select count(*)::int from claimed), 2, 'le site réserve les emails dus de sa boutique (confirmation et prête)');
select ok(not exists (select 1 from claimed where payload ->> 'order_id' in ('plus-tard', 'autre-boutique')),
  'ni un email programmé plus tard, ni celui d''une autre boutique');
select ok((select bool_and(next_attempt_at > now() + interval '9 minutes') from claimed), 'bail de 10 minutes posé');
select is((select count(*)::int from public.claim_email_outbox(20)), 0, 'une seconde réservation ne reprend rien');

-- Échec puis succès : colonnes autorisées au site.
update public.email_outbox set attempts = 1, next_attempt_at = now() + interval '5 minutes', last_error = 'Brevo 500'
  where id = (select min(id) from claimed);
select is((select attempts from public.email_outbox where id = (select min(id) from claimed)), 1, 'T6.3 attempts + 1 enregistré');
update public.email_outbox set sent_at = now() where id = (select max(id) from claimed);
insert into public.email_events (shop_id, kind, order_id, provider_message_id, status)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'order_ready', 'a0000000-0000-0000-0000-000000000001', '<m1@brevo>', 'sent');
select is((select provider_message_id from public.email_events where provider_message_id = '<m1@brevo>'), '<m1@brevo>',
  'T6.6 journal email_events avec provider_message_id');
insert into public.email_events (shop_id, kind, status) values ('aaaaaaaa-0000-0000-0000-000000000000', 'contact_message', 'sent');
select pass('message de contact journalisé');
select throws_ok($$ update public.email_outbox set payload = '{}' $$, '42501', null,
  'le site ne peut pas réécrire le contenu d''un email');
reset role;

select * from finish();
rollback;
