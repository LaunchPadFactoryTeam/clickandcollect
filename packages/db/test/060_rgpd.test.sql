-- Lot 8 : conservation, export et effacement des données personnelles.
begin;
select plan(24);

\ir support/fixtures.psql

-- ---------------------------------------------------------------------------
-- Jeu de données daté : la tâche tourne le 1er janvier 2030 sur la boutique A
-- ---------------------------------------------------------------------------
insert into public.orders (id, shop_id, slot_start, slot_end, email, phone, customer_name, customer_hash, total_cents, stripe_session_id, paid_at) values
  -- Client X : dernière commande il y a 3 ans et 2 jours.
  ('a0000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', '2026-12-30 14:00Z', '2026-12-30 17:00Z',
   'x@exemple.fr', '0600000001', 'Client X', repeat('1', 64), 1500, 'cs_rgpd_x', '2026-12-30 10:00Z'),
  -- Client Y : une commande ancienne et une commande il y a 6 mois.
  ('a0000000-0000-0000-0000-0000000000b1', 'aaaaaaaa-0000-0000-0000-000000000000', '2025-01-01 14:00Z', '2025-01-01 17:00Z',
   'y@exemple.fr', null, 'Client Y', repeat('2', 64), 2000, 'cs_rgpd_y1', '2025-01-01 10:00Z'),
  ('a0000000-0000-0000-0000-0000000000b2', 'aaaaaaaa-0000-0000-0000-000000000000', '2029-07-01 14:00Z', '2029-07-01 17:00Z',
   'y@exemple.fr', null, 'Client Y', repeat('2', 64), 3000, 'cs_rgpd_y2', '2029-07-01 10:00Z'),
  -- Vente d'il y a 10 ans et 2 jours (déjà anonymisée).
  ('a0000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000', '2019-12-30 14:00Z', '2019-12-30 17:00Z',
   'z@exemple.fr', null, null, repeat('3', 64), 990, 'cs_rgpd_z', '2019-12-30 10:00Z');
insert into public.order_items (order_id, shop_id, product_id, name, unit_price_cents, vat_rate, quantity) values
  ('a0000000-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'miel', 'Miel', 1500, 5.5, 1),
  ('a0000000-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000', 'miel', 'Miel', 990, 5.5, 1);
insert into public.consents (shop_id, customer_hash, email, text_version, text_hash, given_at, withdrawn_at, archived_at) values
  ('aaaaaaaa-0000-0000-0000-000000000000', repeat('2', 64), 'y@exemple.fr', 'v1', repeat('d', 64), '2029-07-01', null, null),
  ('aaaaaaaa-0000-0000-0000-000000000000', repeat('4', 64), 'retrait@exemple.fr', 'v1', repeat('d', 64), '2029-01-01', '2029-11-01', null),
  ('aaaaaaaa-0000-0000-0000-000000000000', repeat('5', 64), null, 'v1', repeat('d', 64), '2020-01-01', '2024-12-30', '2024-12-30'),
  ('aaaaaaaa-0000-0000-0000-000000000000', repeat('6', 64), null, 'v1', repeat('d', 64), '2021-01-01', '2025-01-02', '2025-01-02');

select is(app.apply_retention('aaaaaaaa-0000-0000-0000-000000000000', '2030-01-01 00:00Z'),
  '{"anonymized_orders": 3, "archived_consents": 1, "deleted_consents": 1, "deleted_orders": 1}'::jsonb,
  'la tâche de conservation traite exactement les lignes attendues');
select results_eq(
  $$ select email, phone, customer_name, customer_hash, anonymized_at, total_cents from public.orders
     where id = 'a0000000-0000-0000-0000-0000000000a1' $$,
  $$ values (null::text, null::text, null::text, null::text, '2030-01-01 00:00Z'::timestamptz, 1500) $$,
  'T8.5 dernière commande il y a 3 ans et 1 jour : coordonnées et empreinte effacées, montant gardé');
select is((select count(*)::int from public.order_items where order_id = 'a0000000-0000-0000-0000-0000000000a1'), 1,
  'T8.5 lignes de la commande anonymisée gardées');
select is((select count(*)::int from public.orders where customer_hash = repeat('2', 64) and email = 'y@exemple.fr'), 2,
  'T8.6 ancienne commande, mais nouvelle commande il y a 6 mois : aucune anonymisation');
select ok((select anonymized_at is not null from public.orders where id = 'a0000000-0000-0000-0000-000000000001'),
  'la commande de démonstration du 2 octobre 2026 est anonymisée elle aussi');
select results_eq(
  $$ select email, archived_at, text_version, text_hash from public.consents where customer_hash = repeat('4', 64) $$,
  $$ values (null::text, '2030-01-01 00:00Z'::timestamptz, 'v1'::text, repeat('d', 64)) $$,
  'T8.7 consentement retiré : retiré de la liste (email effacé), preuve archivée');
select is((select email from public.consents where customer_hash = repeat('2', 64)), 'y@exemple.fr',
  'consentement d''un client actif : inchangé');
select is((select count(*)::int from public.consents where customer_hash = repeat('5', 64)), 0,
  'T8.8 preuve archivée depuis 5 ans et 2 jours : supprimée');
select is((select count(*)::int from public.consents where customer_hash = repeat('6', 64)), 1,
  'preuve archivée depuis moins de 5 ans : gardée');
select is((select count(*)::int from public.orders where id = 'a0000000-0000-0000-0000-0000000000c1'), 0,
  'T8.9 vente de 10 ans et 2 jours : supprimée');
select is((select count(*)::int from public.order_items where order_id = 'a0000000-0000-0000-0000-0000000000c1'), 0,
  'T8.9 ses lignes aussi');
select is(app.apply_retention('aaaaaaaa-0000-0000-0000-000000000000', '2030-01-01 00:00Z'),
  '{"anonymized_orders": 0, "archived_consents": 0, "deleted_consents": 0, "deleted_orders": 0}'::jsonb,
  'deuxième passage le même jour : plus rien à faire');
select is((select count(*)::int from public.orders where shop_id = 'bbbbbbbb-0000-0000-0000-000000000000' and anonymized_at is not null), 0,
  'la boutique B n''est pas touchée');

-- Tâche planifiée du site : sa boutique seulement, à la date du jour ; jamais un autre rôle.
set local role lp_site;
select set_config('request.jwt.claims', '{"role":"lp_site","shop_id":"bbbbbbbb-0000-0000-0000-000000000000"}', true);
select is(public.apply_retention() ->> 'anonymized_orders', '0', 'site de B : commandes récentes, rien à anonymiser');
select throws_ok($$ select app.apply_retention('aaaaaaaa-0000-0000-0000-000000000000', '2100-01-01') $$, '42501', null,
  'le site ne peut pas choisir la date ni la boutique');
reset role;

-- ---------------------------------------------------------------------------
-- Consentement, export et effacement
-- ---------------------------------------------------------------------------
set local role lp_site;
select set_config('request.jwt.claims', '{"role":"lp_site","shop_id":"bbbbbbbb-0000-0000-0000-000000000000"}', true);
select public.record_paid_checkout(jsonb_build_object(
  'event_id', 'evt_rgpd', 'event_type', 'checkout.session.completed', 'shop_id', 'bbbbbbbb-0000-0000-0000-000000000000',
  'session_id', 'cs_rgpd_paul', 'slot_start', now(), 'slot_end', now() + interval '1 hour',
  'email', 'paul.martin@exemple.fr', 'phone', '+33612345678', 'customer_name', 'Paul Martin', 'customer_hash', repeat('7', 64),
  'total_cents', 1250, 'vat_breakdown', '{"5.5": 65}'::jsonb,
  'items', '[{"product_id":"miel","name":"Miel","unit_price_cents":1250,"vat_rate":5.5,"quantity":1}]'::jsonb,
  'consent', jsonb_build_object('version', '2026-10-04', 'hash', repeat('e', 64))));
reset role;
select results_eq($$ select text_version, text_hash from public.consents where customer_hash = repeat('7', 64) $$,
  $$ values ('2026-10-04'::text, repeat('e', 64)) $$, 'T8.10 case cochée : version et empreinte du texte affiché enregistrées');

-- Aucun email en clair hors des tables orders et consents (toutes les colonnes texte et JSON du schéma public).
create temporary table email_columns as
select table_name, column_name from information_schema.columns
where table_schema = 'public' and data_type in ('text', 'character varying', 'jsonb', 'json')
  and (table_name, column_name) not in (('orders', 'email'), ('consents', 'email'));
create function pg_temp.email_occurrences(p_email text) returns integer language plpgsql as $$
declare r record; n integer := 0; c integer;
begin
  for r in select * from email_columns loop
    execute format('select count(*) from public.%I where %I::text ilike %L', r.table_name, r.column_name, '%' || p_email || '%') into c;
    n := n + c;
  end loop;
  return n;
end $$;
select is(pg_temp.email_occurrences('paul.martin@exemple.fr'), 0,
  'aucun email client en clair hors des tables orders et consents, même dans les files et journaux');

insert into public.orders (shop_id, slot_start, slot_end, email, customer_hash, total_cents, stripe_session_id, paid_at)
values ('bbbbbbbb-0000-0000-0000-000000000000', now(), now() + interval '1 hour', 'Paul.Martin@exemple.fr', repeat('7', 64), 800,
        'cs_rgpd_paul2', now());

-- Commerçant : refusé ; équipe LaunchPad : autorisée.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.export_customer_data('bbbbbbbb-0000-0000-0000-000000000000', 'paul.martin@exemple.fr') $$,
  '42501', null, 'un commerçant ne peut pas exporter les données d''un client');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
create temporary table export as
select public.export_customer_data('bbbbbbbb-0000-0000-0000-000000000000', ' Paul.Martin@Exemple.fr ') as data;
reset role;
select is((select jsonb_array_length(data -> 'commandes') from export), 2, 'T8.11 export : les 2 commandes de l''email');
select is((select jsonb_array_length(data -> 'consentements') from export), 1, 'T8.11 export : son consentement');
select is((select data -> 'commandes' -> 0 -> 'lignes' -> 0 ->> 'produit' from export), 'Miel', 'export : lignes comprises');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ad","role":"authenticated"}', true);
select is(public.erase_customer_data('bbbbbbbb-0000-0000-0000-000000000000', 'paul.martin@exemple.fr'),
  '{"commandes_anonymisees": 2, "consentements_retires": 1}'::jsonb, 'effacement : 2 commandes, 1 consentement');
reset role;
select is((select count(*)::int from public.orders where customer_hash is null and email is null and phone is null
           and customer_name is null and anonymized_at is not null and stripe_session_id in ('cs_rgpd_paul', 'cs_rgpd_paul2')), 2,
  'T8.12 effacement : coordonnées nulles, anonymized_at renseigné, montants gardés');
select results_eq(
  $$ select kind, email_hash, orders_count, consents_count, requested_by::text from public.privacy_requests order by id $$,
  $$ values ('export'::text, encode(extensions.digest('paul.martin@exemple.fr', 'sha256'), 'hex'), 2, 1, '00000000-0000-0000-0000-0000000000ad'),
            ('erase', encode(extensions.digest('paul.martin@exemple.fr', 'sha256'), 'hex'), 2, 1, '00000000-0000-0000-0000-0000000000ad') $$,
  'les deux demandes sont journalisées avec leur auteur, sans l''email en clair');

select * from finish();
rollback;
