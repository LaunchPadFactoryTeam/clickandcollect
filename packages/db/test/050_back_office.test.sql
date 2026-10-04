-- Lot 7 : back-office commerçant — transitions de statut, disponibilités, connexion, mot de passe oublié.
begin;
select plan(31);

\ir support/fixtures.psql

-- ---------------------------------------------------------------------------
-- Transitions de statut (commerçant de A)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok(
  $$ update public.orders set status = 'collected' where id = 'a0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'T7.4 new → collected (saut de 3 crans) : refusé');
select throws_ok(
  $$ update public.orders set status = 'ready' where id = 'a0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'new → ready (saut de 2 crans) : refusé');
select lives_ok(
  $$ update public.orders set status = 'preparing' where id = 'a0000000-0000-0000-0000-000000000001' $$,
  'T7.1 new → preparing : accepté');
select lives_ok(
  $$ update public.orders set status = 'ready' where id = 'a0000000-0000-0000-0000-000000000001' $$,
  'preparing → ready : accepté');
select lives_ok(
  $$ update public.orders set status = 'preparing' where id = 'a0000000-0000-0000-0000-000000000001' $$,
  'T7.3 ready → preparing (retour d''un cran) : accepté');
update public.orders set status = 'ready' where id = 'a0000000-0000-0000-0000-000000000001';
update public.orders set status = 'collected' where id = 'a0000000-0000-0000-0000-000000000001';
select throws_ok(
  $$ update public.orders set status = 'new' where id = 'a0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'T7.2 collected : aucun saut possible, seul le retour d''un cran reste');
reset role;
select results_eq(
  $$ select from_status::text, to_status::text, actor::text from public.order_status_events
     where order_id = 'a0000000-0000-0000-0000-000000000001' and from_status is not null order by id $$,
  $$ values ('new'::text, 'preparing'::text, '00000000-0000-0000-0000-00000000000a'::text),
            ('preparing', 'ready', '00000000-0000-0000-0000-00000000000a'),
            ('ready', 'preparing', '00000000-0000-0000-0000-00000000000a'),
            ('preparing', 'ready', '00000000-0000-0000-0000-00000000000a'),
            ('ready', 'collected', '00000000-0000-0000-0000-00000000000a') $$,
  'T7.1 chaque transition acceptée est journalisée avec le commerçant');

-- ---------------------------------------------------------------------------
-- Disponibilités
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into public.product_availability (shop_id, product_id, available, updated_by, updated_at)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'miel', false, '00000000-0000-0000-0000-00000000000b', '2000-01-01'),
       ('aaaaaaaa-0000-0000-0000-000000000000', 'tomme', false, null, null)
on conflict (shop_id, product_id) do update set available = excluded.available;
reset role;
select results_eq(
  $$ select product_id, available, updated_by::text, updated_at > now() - interval '1 minute'
     from public.product_availability where shop_id = 'aaaaaaaa-0000-0000-0000-000000000000' order by product_id $$,
  $$ values ('miel'::text, false, '00000000-0000-0000-0000-00000000000a'::text, true),
            ('tomme', false, '00000000-0000-0000-0000-00000000000a', true) $$,
  'T7.10 enregistrement : produit existant mis à jour, nouveau produit créé, auteur et date posés par la base');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.product_availability (shop_id, product_id, available)
     values ('bbbbbbbb-0000-0000-0000-000000000000', 'vin', false)
     on conflict (shop_id, product_id) do update set available = excluded.available $$,
  '42501', null, 'commerçant de A : ne peut pas couper un produit de B');
select is((select count(*)::int from public.order_items where order_id = 'b0000000-0000-0000-0000-000000000001'), 0,
  'commerçant de A : les lignes d''une commande de B restent invisibles, même par son identifiant');
reset role;

-- ---------------------------------------------------------------------------
-- Connexion : 5 échecs en 15 minutes bloquent le compte 15 minutes (site de A)
-- ---------------------------------------------------------------------------
set local role lp_site;
select set_config('request.jwt.claims', '{"role":"lp_site","shop_id":"aaaaaaaa-0000-0000-0000-000000000000"}', true);
select public.record_login_failure('commandes@boutique-a.fr') from generate_series(1, 4);
select is(public.login_blocked_until('commandes@boutique-a.fr'), null, '4 échecs : encore autorisé');
select public.record_login_failure(' Commandes@Boutique-A.fr ');
select ok(public.login_blocked_until('commandes@boutique-a.fr') between now() + interval '14 minutes' and now() + interval '15 minutes',
  'T7.11 5e échec en 15 minutes (casse et espaces ignorés) : bloqué 15 minutes');
select is(public.login_blocked_until('autre@boutique-a.fr'), null, 'un autre compte n''est pas bloqué');
reset role;
select is((select count(*)::int from public.login_failures where email_hash ~ '@'), 0, 'seule l''empreinte de l''email est conservée');

set local role lp_site;
select set_config('request.jwt.claims', '{"role":"lp_site","shop_id":"bbbbbbbb-0000-0000-0000-000000000000"}', true);
select is(public.login_blocked_until('commandes@boutique-a.fr'), null, 'le blocage vaut pour la boutique du site seulement');
select set_config('request.jwt.claims', '{"role":"lp_site","shop_id":"aaaaaaaa-0000-0000-0000-000000000000"}', true);
select public.clear_login_failures('commandes@boutique-a.fr');
select is(public.login_blocked_until('commandes@boutique-a.fr'), null, 'connexion réussie : compteur remis à zéro');
reset role;

-- Échecs étalés sur plus de 15 minutes : pas de blocage ; blocage échu après 15 minutes.
insert into public.login_failures (shop_id, email_hash, created_at)
select 'aaaaaaaa-0000-0000-0000-000000000000', app.email_hash('lent@boutique-a.fr'), now() - (n * interval '5 minutes')
from generate_series(0, 4) n;
insert into public.login_failures (shop_id, email_hash, created_at)
select 'aaaaaaaa-0000-0000-0000-000000000000', app.email_hash('ancien@boutique-a.fr'), now() - interval '20 minutes' + (n * interval '1 minute')
from generate_series(0, 4) n;
set local role lp_site;
select set_config('request.jwt.claims', '{"role":"lp_site","shop_id":"aaaaaaaa-0000-0000-0000-000000000000"}', true);
select is(public.login_blocked_until('lent@boutique-a.fr'), null, '5 échecs étalés sur 20 minutes : pas de blocage');
select is(public.login_blocked_until('ancien@boutique-a.fr'), null, 'blocage levé 15 minutes après le dernier échec');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.record_login_failure('x@y.fr') $$, '42501', null,
  'compteur d''échecs réservé au site');
reset role;

-- ---------------------------------------------------------------------------
-- Mot de passe oublié
-- ---------------------------------------------------------------------------
insert into auth.sessions (id, user_id) values (gen_random_uuid(), '00000000-0000-0000-0000-00000000000a');

set local role lp_site;
select set_config('request.jwt.claims', '{"role":"lp_site","shop_id":"aaaaaaaa-0000-0000-0000-000000000000"}', true);
select is(public.request_password_reset('inconnu@boutique-a.fr', repeat('1', 64)), null,
  'T7.8 email inconnu : rien à envoyer');
select is(public.request_password_reset('COMMANDES@boutique-a.fr', repeat('2', 64)), 'commandes@boutique-a.fr',
  'email d''un commerçant de la boutique : lien à envoyer');
select ok(public.password_reset_valid(repeat('2', 64)), 'le lien est valable');
select set_config('request.jwt.claims', '{"role":"lp_site","shop_id":"bbbbbbbb-0000-0000-0000-000000000000"}', true);
select is(public.request_password_reset('commandes@boutique-a.fr', repeat('3', 64)), null,
  'commerçant d''une autre boutique : rien à envoyer depuis ce site');
select ok(not public.password_reset_valid(repeat('2', 64)), 'le lien de A ne sert pas sur le site de B');

select set_config('request.jwt.claims', '{"role":"lp_site","shop_id":"aaaaaaaa-0000-0000-0000-000000000000"}', true);
select throws_ok($$ select public.complete_password_reset(repeat('2', 64), 'court') $$, '22023', null,
  'mot de passe de moins de 10 caractères : refusé');
select ok(public.complete_password_reset(repeat('2', 64), 'nouveau-mot-de-passe'), 'nouveau mot de passe enregistré');
select ok(not public.complete_password_reset(repeat('2', 64), 'encore-un-autre-mot'), 'T7.8 lien à usage unique');
reset role;
select ok((select encrypted_password = extensions.crypt('nouveau-mot-de-passe', encrypted_password)
           from auth.users where id = '00000000-0000-0000-0000-00000000000a'), 'mot de passe chiffré (bcrypt)');
select is((select count(*)::int from auth.sessions where user_id = '00000000-0000-0000-0000-00000000000a'), 0,
  'toutes les sessions du compte sont fermées');

-- Lien expiré au bout d'une heure ; 3 demandes par heure au plus.
update public.password_resets set created_at = now() - interval '2 hours', expires_at = now() - interval '1 hour';
set local role lp_site;
select set_config('request.jwt.claims', '{"role":"lp_site","shop_id":"aaaaaaaa-0000-0000-0000-000000000000"}', true);
select public.request_password_reset('commandes@boutique-a.fr', repeat(n::text, 64)) from generate_series(4, 6) n;
select is(public.request_password_reset('commandes@boutique-a.fr', repeat('7', 64)), null,
  '4e demande dans l''heure : ignorée');
select ok(not public.password_reset_valid(repeat('4', 64)) and public.password_reset_valid(repeat('6', 64)),
  'une nouvelle demande retire les liens précédents');
reset role;

select * from finish();
rollback;
