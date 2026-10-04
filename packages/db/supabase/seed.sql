-- Généré par packages/db/scripts/generate-seed.mjs — ne pas modifier à la main.
-- Données de démonstration (supabase db reset) : la boutique Maison Ferrand et les 6 commandes de la maquette
-- du back-office. Les numéros sont attribués par la base (1 à 6) ; la maquette affiche #2466 à #2471.

insert into public.shops (id, slug, name, domain, core_version)
values ('f0000000-0000-4000-8000-000000000001', 'maison-ferrand', 'Maison Ferrand', 'maison-ferrand.fr', '1.0.0-alpha.1');

-- Compte back-office de démonstration (local uniquement) : commandes@maison-ferrand.fr / demo-maison-ferrand
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
                        raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
                        email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', 'f2000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'commandes@maison-ferrand.fr',
        extensions.crypt('demo-maison-ferrand', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at)
values (gen_random_uuid(), 'f2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000001', 'email',
        jsonb_build_object('sub', 'f2000000-0000-4000-8000-000000000001', 'email', 'commandes@maison-ferrand.fr'), now(), now());
insert into public.shop_users (user_id, shop_id) values ('f2000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001');

insert into public.product_availability (shop_id, product_id, available) values
  ('f0000000-0000-4000-8000-000000000001', 'terrine', false),
  ('f0000000-0000-4000-8000-000000000001', 'biscuit', false);

-- #2466 Antoine Fabre
insert into public.orders (id, shop_id, status, slot_start, slot_end, email, phone, customer_name, customer_hash, total_cents, vat_breakdown, stripe_session_id, paid_at)
values ('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'collected', (((now() at time zone 'Europe/Paris')::date + -1) + time '16:00') at time zone 'Europe/Paris', (((now() at time zone 'Europe/Paris')::date + -1) + time '19:00') at time zone 'Europe/Paris', 'a.fabre@exemple.fr', '06 03 00 00 00', 'Antoine Fabre', '6470239584325ec3ec1c47bfba0438eaa1667e31cf457d4dcbce4dc81386e8db', 1800, '{"5.5":94}', 'cs_demo_2466', (((now() at time zone 'Europe/Paris')::date + -1) + time '10:22') at time zone 'Europe/Paris');
insert into public.order_items (order_id, shop_id, product_id, name, format, unit_price_cents, vat_rate, quantity, is_alcohol) values
  ('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'huile', 'Huile d''olive Lucques', 'Bidon 500 ml', 1800, 5.5, 1, false);

-- #2467 Sophie Rouvier
insert into public.orders (id, shop_id, status, slot_start, slot_end, email, phone, customer_name, customer_hash, total_cents, vat_breakdown, stripe_session_id, paid_at)
values ('f1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'new', (((now() at time zone 'Europe/Paris')::date + 1) + time '10:00') at time zone 'Europe/Paris', (((now() at time zone 'Europe/Paris')::date + 1) + time '12:00') at time zone 'Europe/Paris', 'sophie.rouvier@exemple.fr', null, 'Sophie Rouvier', 'ac7d42c6a41c1b2cbfe27eb70dc35877fb86d78a36346ab7a5aadf992164a33e', 2240, '{"5.5":117}', 'cs_demo_2467', (((now() at time zone 'Europe/Paris')::date + -1) + time '21:34') at time zone 'Europe/Paris');
insert into public.order_items (order_id, shop_id, product_id, name, format, unit_price_cents, vat_rate, quantity, is_alcohol) values
  ('f1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'tomme', 'Tomme du Larzac affinée', 'Portion 300 g', 1120, 5.5, 2, false);

-- #2468 Marc Oliveira
insert into public.orders (id, shop_id, status, slot_start, slot_end, email, phone, customer_name, customer_hash, total_cents, vat_breakdown, stripe_session_id, paid_at)
values ('f1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'new', (((now() at time zone 'Europe/Paris')::date + 1) + time '10:00') at time zone 'Europe/Paris', (((now() at time zone 'Europe/Paris')::date + 1) + time '12:00') at time zone 'Europe/Paris', 'm.oliveira@exemple.fr', '07 88 00 00 00', 'Marc Oliveira', '124a872737a44a1608d75699d2fe9f582bc1791de257ce2f2e3842723e86ffac', 3210, '{"5.5":167}', 'cs_demo_2468', (((now() at time zone 'Europe/Paris')::date + 0) + time '07:55') at time zone 'Europe/Paris');
insert into public.order_items (order_id, shop_id, product_id, name, format, unit_price_cents, vat_rate, quantity, is_alcohol) values
  ('f1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'terrine', 'Terrine de canard aux figues', 'Bocal 180 g', 980, 5.5, 2, false),
  ('f1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', 'miel', 'Miel de châtaignier', 'Pot 250 g', 1250, 5.5, 1, false);

-- #2469 Hélène Daviau
insert into public.orders (id, shop_id, status, slot_start, slot_end, email, phone, customer_name, customer_hash, total_cents, vat_breakdown, stripe_session_id, paid_at)
values ('f1000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000001', 'ready', (((now() at time zone 'Europe/Paris')::date + 0) + time '16:00') at time zone 'Europe/Paris', (((now() at time zone 'Europe/Paris')::date + 0) + time '19:00') at time zone 'Europe/Paris', 'helene.daviau@exemple.fr', '06 44 00 00 00', 'Hélène Daviau', 'd3244355dff7efb94f18759f19ed0c597020a8c918fbb680c64b35749afe5460', 4170, '{"5.5":217}', 'cs_demo_2469', (((now() at time zone 'Europe/Paris')::date + -1) + time '19:03') at time zone 'Europe/Paris');
insert into public.order_items (order_id, shop_id, product_id, name, format, unit_price_cents, vat_rate, quantity, is_alcohol) values
  ('f1000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000001', 'huile', 'Huile d''olive Lucques', 'Bidon 500 ml', 1800, 5.5, 1, false),
  ('f1000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000001', 'confiture', 'Confiture d''abricot du Roussillon', 'Pot 370 g', 790, 5.5, 3, false);

-- #2470 Yanis Moreau
insert into public.orders (id, shop_id, status, slot_start, slot_end, email, phone, customer_name, customer_hash, total_cents, vat_breakdown, stripe_session_id, paid_at)
values ('f1000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000001', 'preparing', (((now() at time zone 'Europe/Paris')::date + 0) + time '16:00') at time zone 'Europe/Paris', (((now() at time zone 'Europe/Paris')::date + 0) + time '19:00') at time zone 'Europe/Paris', 'y.moreau@exemple.fr', null, 'Yanis Moreau', '25029940e29f8810787ee66d808885573d929939ff17be71993feba5c396ac31', 5040, '{"20":733,"5.5":33}', 'cs_demo_2470', (((now() at time zone 'Europe/Paris')::date + 0) + time '08:47') at time zone 'Europe/Paris');
insert into public.order_items (order_id, shop_id, product_id, name, format, unit_price_cents, vat_rate, quantity, is_alcohol) values
  ('f1000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000001', 'vin', 'Vin orange, Domaine Lasserre', 'Bouteille 75 cl', 2200, 20, 2, true),
  ('f1000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000001', 'tapenade', 'Tapenade d''olives noires', 'Bocal 110 g', 640, 5.5, 1, false);

-- #2471 Camille Besson
insert into public.orders (id, shop_id, status, slot_start, slot_end, email, phone, customer_name, customer_hash, total_cents, vat_breakdown, stripe_session_id, paid_at)
values ('f1000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000001', 'new', (((now() at time zone 'Europe/Paris')::date + 0) + time '16:00') at time zone 'Europe/Paris', (((now() at time zone 'Europe/Paris')::date + 0) + time '19:00') at time zone 'Europe/Paris', 'camille.besson@exemple.fr', '06 12 00 00 00', 'Camille Besson', 'b9e35ae9173f827a3ffa755e75959ebf49a258d4fca628f774b0d82b9fd30954', 4470, '{"5.5":233}', 'cs_demo_2471', (((now() at time zone 'Europe/Paris')::date + 0) + time '09:12') at time zone 'Europe/Paris');
insert into public.order_items (order_id, shop_id, product_id, name, format, unit_price_cents, vat_rate, quantity, is_alcohol) values
  ('f1000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000001', 'tomme', 'Tomme du Larzac affinée', 'Portion 300 g', 1120, 5.5, 1, false),
  ('f1000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000001', 'miel', 'Miel de châtaignier', 'Pot 250 g', 1250, 5.5, 2, false),
  ('f1000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000001', 'biscuit', 'Croquants aux amandes', 'Sachet 200 g', 850, 5.5, 1, false);
