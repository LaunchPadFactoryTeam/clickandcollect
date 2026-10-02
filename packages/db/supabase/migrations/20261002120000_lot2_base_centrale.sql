-- Lot 2 : base centrale LaunchPad (section 1.4 des spécifications).
-- Une ligne par commande avec son identifiant boutique, accès cloisonné par boutique (RLS).
--
-- Trois façons d'accéder aux données :
--   * authenticated + shop_users       : le commerçant, limité à ses boutiques (back-office) ;
--   * authenticated + launchpad_admins : l'équipe LaunchPad, lecture de toutes les boutiques (hub) ;
--   * lp_site                          : le serveur d'un site, jeton signé portant la revendication shop_id,
--                                        limité à sa boutique. Jamais la clé service_role.

-- ---------------------------------------------------------------------------
-- Rôles et fonctions d'accès
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'lp_site') then
    create role lp_site nologin noinherit;
  end if;
end
$$;

-- PostgREST bascule sur le rôle nommé dans le jeton : authenticator doit pouvoir l'endosser.
grant lp_site to authenticator;
grant usage on schema public to lp_site;

create schema if not exists app;
grant usage on schema app to authenticated, lp_site;

create type public.order_status as enum ('new', 'preparing', 'ready', 'collected');

-- ---------------------------------------------------------------------------
-- Boutiques et comptes
-- ---------------------------------------------------------------------------

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (length(name) > 0),
  domain text not null unique,
  stripe_account_id text unique check (stripe_account_id ~ '^acct_\w+$'),
  core_version text not null,
  created_at timestamptz not null default now()
);

-- Comptes du back-office, créés par LaunchPad.
create table public.shop_users (
  user_id uuid not null references auth.users (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  role text not null default 'merchant' check (role in ('merchant')),
  created_at timestamptz not null default now(),
  primary key (user_id, shop_id)
);
create index shop_users_shop_id_idx on public.shop_users (shop_id);

-- Équipe LaunchPad (hub). Rôle « launchpad_admin » des spécifications.
create table public.launchpad_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Les fonctions d'accès lisent shop_users et launchpad_admins sans repasser par leur RLS (pas de récursion).
create function app.my_shop_ids() returns setof uuid
language sql stable security definer set search_path = ''
as $$ select su.shop_id from public.shop_users su where su.user_id = auth.uid() $$;

create function app.is_launchpad_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.launchpad_admins a where a.user_id = auth.uid()) $$;

-- Boutique du jeton de site ; null pour tout autre appelant.
-- Lit les revendications posées par PostgREST sans passer par le schéma auth, inaccessible à lp_site.
create function app.site_shop_id() returns uuid
language sql stable set search_path = ''
as $$
  select case when current_user = 'lp_site' then
    nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'shop_id', '')::uuid
  end
$$;

-- Vrai si l'appelant (commerçant, admin ou site) a accès à la boutique.
create function app.can_access_shop(target uuid) returns boolean
language sql stable set search_path = ''
as $$
  select target = app.site_shop_id()
      or app.is_launchpad_admin()
      or target in (select app.my_shop_ids())
$$;

-- Vrai si l'appelant est un commerçant de la boutique (pas l'admin, pas le site).
create function app.is_merchant_of(target uuid) returns boolean
language sql stable set search_path = ''
as $$ select target in (select app.my_shop_ids()) $$;

grant execute on all functions in schema app to authenticated, lp_site;

-- ---------------------------------------------------------------------------
-- Catalogue : disponibilités (le reste du catalogue vit dans Sanity)
-- ---------------------------------------------------------------------------

create table public.product_availability (
  shop_id uuid not null references public.shops (id) on delete cascade,
  product_id text not null check (length(product_id) > 0), -- identifiant du document Sanity
  available boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (shop_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Commandes
-- ---------------------------------------------------------------------------

-- Dernier numéro attribué par boutique (#2471…). Ligne verrouillée le temps d'une insertion : pas de doublon.
create table public.shop_counters (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  last_order_number integer not null check (last_order_number >= 0)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete restrict,
  number integer not null default 0, -- attribué par le déclencheur orders_assign_number
  status public.order_status not null default 'new',
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  email text,                 -- effacé à l'anonymisation
  phone text,                 -- facultatif, effacé à l'anonymisation
  customer_hash text,         -- HMAC-SHA256 de l'email, effacé à l'anonymisation
  total_cents integer not null check (total_cents >= 0),
  vat_breakdown jsonb not null default '{}'::jsonb, -- { "5.5": 189, "20": 367 } en centimes
  stripe_session_id text not null unique,
  stripe_payment_intent_id text,
  paid_at timestamptz not null,
  ready_email_sent_at timestamptz,
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  unique (shop_id, number),
  check (slot_end > slot_start),
  check (anonymized_at is not null or email is not null)
);
create index orders_shop_slot_idx on public.orders (shop_id, slot_start);
create index orders_shop_customer_idx on public.orders (shop_id, customer_hash);

-- Copie figée des lignes au moment du paiement.
create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete restrict,
  product_id text not null,
  name text not null,
  format text not null default '',
  unit_price_cents integer not null check (unit_price_cents >= 0),
  vat_rate numeric(4, 1) not null check (vat_rate in (5.5, 20)),
  quantity integer not null check (quantity between 1 and 20),
  is_alcohol boolean not null default false
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_status_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete restrict,
  from_status public.order_status,
  to_status public.order_status not null,
  actor uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_status_events_order_idx on public.order_status_events (order_id);

-- Numéro de commande : attribué par la base, jamais par l'appelant.
create function app.assign_order_number() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.shop_counters as c (shop_id, last_order_number)
  values (new.shop_id, 1)
  on conflict (shop_id) do update set last_order_number = c.last_order_number + 1
  returning c.last_order_number into new.number;
  return new;
end
$$;

create trigger orders_assign_number
before insert on public.orders
for each row execute function app.assign_order_number();

-- Une ligne de commande appartient à la même boutique que sa commande.
create function app.check_item_shop() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.shop_id is distinct from (select o.shop_id from public.orders o where o.id = new.order_id) then
    raise exception 'order_items.shop_id ne correspond pas à la boutique de la commande' using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger order_items_check_shop
before insert or update on public.order_items
for each row execute function app.check_item_shop();

-- Historique des statuts : création, puis chaque changement.
create function app.log_order_status() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_events (order_id, shop_id, from_status, to_status, actor)
    values (new.id, new.shop_id, case when tg_op = 'UPDATE' then old.status end, new.status, auth.uid());
  end if;
  return new;
end
$$;

create trigger orders_log_status
after insert or update of status on public.orders
for each row execute function app.log_order_status();

-- ---------------------------------------------------------------------------
-- Paiement, emails, RGPD, exports
-- ---------------------------------------------------------------------------

-- Idempotence du webhook Stripe : un event_id n'est traité qu'une fois.
create table public.stripe_events (
  event_id text primary key,
  shop_id uuid not null references public.shops (id) on delete restrict,
  type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.consents (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops (id) on delete restrict,
  customer_hash text not null,
  email text,
  text_version text not null,
  text_hash text not null check (text_hash ~ '^[0-9a-f]{64}$'),
  given_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create index consents_shop_customer_idx on public.consents (shop_id, customer_hash);

create table public.unsubscribes (
  shop_id uuid not null references public.shops (id) on delete restrict,
  customer_hash text not null,
  created_at timestamptz not null default now(),
  primary key (shop_id, customer_hash)
);

create table public.email_events (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops (id) on delete restrict,
  kind text not null check (kind in ('order_confirmation', 'merchant_new_order', 'order_ready', 'password_reset', 'monthly_export')),
  order_id uuid references public.orders (id) on delete set null,
  provider_message_id text,
  status text not null check (status in ('sent', 'failed')),
  created_at timestamptz not null default now()
);
create index email_events_day_idx on public.email_events (created_at);

create table public.email_outbox (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops (id) on delete restrict,
  kind text not null,
  payload jsonb not null,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now()
);
create index email_outbox_pending_idx on public.email_outbox (next_attempt_at) where sent_at is null and failed_at is null;

create table public.exports (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops (id) on delete restrict,
  period date not null check (extract(day from period) = 1), -- premier jour du mois exporté
  csv_path text,
  pdf_path text,
  status text not null default 'pending' check (status in ('pending', 'generated', 'sent', 'failed')),
  generated_at timestamptz,
  sent_at timestamptz,
  unique (shop_id, period)
);

-- ---------------------------------------------------------------------------
-- Droits : rien par défaut, puis le strict nécessaire, puis la RLS
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated, lp_site;
revoke all on all sequences in schema public from anon, authenticated, lp_site;

-- Lecture : commerçant (ses boutiques), admin (toutes), site (la sienne), filtrées par la RLS.
grant select on public.shops, public.product_availability, public.orders, public.order_items to authenticated, lp_site;
grant select on public.shop_users, public.launchpad_admins, public.order_status_events, public.exports to authenticated;
grant select on public.stripe_events, public.consents, public.unsubscribes, public.email_events, public.email_outbox
  to authenticated, lp_site;

-- Commerçant : statut des commandes et disponibilités uniquement.
grant update (status) on public.orders to authenticated;
grant insert, update (available, updated_at, updated_by) on public.product_availability to authenticated;

-- Site (webhook Stripe, tunnel, emails) : création de commandes et journaux de sa boutique.
grant insert on public.orders, public.order_items, public.stripe_events, public.consents, public.unsubscribes,
  public.email_events, public.email_outbox to lp_site;
grant update (ready_email_sent_at) on public.orders to lp_site;
grant update (processed_at) on public.stripe_events to lp_site;
grant update (attempts, next_attempt_at, sent_at, failed_at) on public.email_outbox to lp_site;
grant update (withdrawn_at) on public.consents to lp_site;

alter table public.shops enable row level security;
alter table public.shop_users enable row level security;
alter table public.launchpad_admins enable row level security;
alter table public.shop_counters enable row level security;
alter table public.product_availability enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_events enable row level security;
alter table public.stripe_events enable row level security;
alter table public.consents enable row level security;
alter table public.unsubscribes enable row level security;
alter table public.email_events enable row level security;
alter table public.email_outbox enable row level security;
alter table public.exports enable row level security;

create policy shops_read on public.shops for select using (app.can_access_shop(id));

create policy shop_users_read on public.shop_users for select to authenticated
  using (user_id = auth.uid() or app.is_launchpad_admin());

create policy launchpad_admins_read on public.launchpad_admins for select to authenticated
  using (app.is_launchpad_admin());

-- shop_counters : aucune politique, accessible au seul déclencheur (security definer).

create policy availability_read on public.product_availability for select using (app.can_access_shop(shop_id));
create policy availability_insert on public.product_availability for insert to authenticated
  with check (app.is_merchant_of(shop_id));
create policy availability_update on public.product_availability for update to authenticated
  using (app.is_merchant_of(shop_id)) with check (app.is_merchant_of(shop_id));

create policy orders_read on public.orders for select using (app.can_access_shop(shop_id));
create policy orders_merchant_update on public.orders for update to authenticated
  using (app.is_merchant_of(shop_id)) with check (app.is_merchant_of(shop_id));
create policy orders_site_insert on public.orders for insert to lp_site with check (shop_id = app.site_shop_id());
create policy orders_site_update on public.orders for update to lp_site
  using (shop_id = app.site_shop_id()) with check (shop_id = app.site_shop_id());

create policy order_items_read on public.order_items for select using (app.can_access_shop(shop_id));
create policy order_items_site_insert on public.order_items for insert to lp_site
  with check (shop_id = app.site_shop_id());

create policy order_status_events_read on public.order_status_events for select to authenticated
  using (app.can_access_shop(shop_id));

-- Journaux techniques : le site de la boutique et l'admin ; pas le commerçant.
create policy stripe_events_access on public.stripe_events for all
  using (shop_id = app.site_shop_id() or app.is_launchpad_admin())
  with check (shop_id = app.site_shop_id());
create policy consents_access on public.consents for all
  using (shop_id = app.site_shop_id() or app.is_launchpad_admin())
  with check (shop_id = app.site_shop_id());
create policy unsubscribes_access on public.unsubscribes for all
  using (shop_id = app.site_shop_id() or app.is_launchpad_admin())
  with check (shop_id = app.site_shop_id());
create policy email_events_access on public.email_events for all
  using (shop_id = app.site_shop_id() or app.is_launchpad_admin())
  with check (shop_id = app.site_shop_id());
create policy email_outbox_access on public.email_outbox for all
  using (shop_id = app.site_shop_id() or app.is_launchpad_admin())
  with check (shop_id = app.site_shop_id());

-- Exports : lecture par le commerçant de la boutique et l'admin ; écrits par la tâche planifiée (service_role).
create policy exports_read on public.exports for select to authenticated using (app.can_access_shop(shop_id));
