-- Lot 7 : back-office commerçant (section 1.7 des spécifications).
-- Le commerçant se connecte avec Supabase Auth (rôle authenticated) : il lit les commandes de sa boutique, fait
-- avancer leur statut et coupe des produits, sous la RLS du lot 2. Le site (rôle lp_site) limite les essais de
-- connexion et gère la réinitialisation du mot de passe, avec l'email aux couleurs de la boutique.

-- ---------------------------------------------------------------------------
-- Commandes : nom du client et transitions de statut
-- ---------------------------------------------------------------------------

-- Nom saisi au paiement (Stripe), affiché au comptoir. Effacé à l'anonymisation, comme l'email (lot 8).
alter table public.orders add column customer_name text;

-- Un cran à la fois : en avant (Nouvelle → En préparation → Prête → Retirée) ou un retour d'un cran.
create function app.check_order_transition() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_steps public.order_status[] := enum_range(null::public.order_status);
begin
  if abs(array_position(v_steps, new.status) - array_position(v_steps, old.status)) > 1 then
    raise exception 'Transition de statut refusée : % → %', old.status, new.status using errcode = '23514';
  end if;
  return new;
end
$$;

create trigger orders_check_transition
before update of status on public.orders
for each row when (new.status is distinct from old.status)
execute function app.check_order_transition();

-- Le paiement enregistre aussi le nom du client.
create or replace function public.record_paid_checkout(p jsonb) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_shop uuid := app.site_shop_id();
  v_order uuid;
  v_number integer;
  v_inserted integer;
begin
  if v_shop is null then
    raise exception 'record_paid_checkout est réservé au site d''une boutique' using errcode = '42501';
  end if;
  if (p ->> 'shop_id')::uuid is distinct from v_shop then
    raise exception 'Session d''une autre boutique : %', p ->> 'shop_id' using errcode = '42501';
  end if;

  insert into public.stripe_events (event_id, shop_id, type)
  values (p ->> 'event_id', v_shop, p ->> 'event_type')
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('status', 'duplicate');
  end if;

  -- Même session déjà enregistrée par un autre événement (paiement différé confirmé, par exemple).
  select o.id, o.number into v_order, v_number from public.orders o where o.stripe_session_id = p ->> 'session_id';
  if found then
    update public.stripe_events set processed_at = now() where event_id = p ->> 'event_id';
    return jsonb_build_object('status', 'duplicate', 'order_id', v_order, 'number', v_number);
  end if;

  insert into public.orders (shop_id, slot_start, slot_end, email, phone, customer_name, customer_hash, total_cents,
                             vat_breakdown, stripe_session_id, stripe_payment_intent_id, paid_at)
  values (v_shop, (p ->> 'slot_start')::timestamptz, (p ->> 'slot_end')::timestamptz, p ->> 'email', p ->> 'phone',
          nullif(trim(p ->> 'customer_name'), ''), p ->> 'customer_hash', (p ->> 'total_cents')::integer,
          coalesce(p -> 'vat_breakdown', '{}'::jsonb), p ->> 'session_id', p ->> 'payment_intent_id', now())
  returning id, number into v_order, v_number;

  insert into public.order_items (order_id, shop_id, product_id, name, format, unit_price_cents, vat_rate, quantity, is_alcohol)
  select v_order, v_shop, i.product_id, i.name, coalesce(i.format, ''), i.unit_price_cents, i.vat_rate, i.quantity,
         coalesce(i.is_alcohol, false)
  from jsonb_to_recordset(p -> 'items') as i(product_id text, name text, format text, unit_price_cents integer,
                                              vat_rate numeric, quantity integer, is_alcohol boolean);
  if not found then
    raise exception 'Commande sans ligne : %', p ->> 'session_id' using errcode = '23514';
  end if;

  if jsonb_typeof(p -> 'consent') = 'object' then
    insert into public.consents (shop_id, customer_hash, email, text_version, text_hash)
    values (v_shop, p ->> 'customer_hash', p ->> 'email', p -> 'consent' ->> 'version', p -> 'consent' ->> 'hash');
  end if;

  -- Envoyés après la transaction par le site, rejoués par la tâche planifiée en cas d'échec (lot 6).
  insert into public.email_outbox (shop_id, kind, payload) values
    (v_shop, 'order_confirmation', jsonb_build_object('order_id', v_order, 'number', v_number)),
    (v_shop, 'merchant_new_order', jsonb_build_object('order_id', v_order, 'number', v_number));

  update public.stripe_events set processed_at = now() where event_id = p ->> 'event_id';
  return jsonb_build_object('status', 'created', 'order_id', v_order, 'number', v_number);
end
$$;

-- ---------------------------------------------------------------------------
-- Disponibilités : auteur et date posés par la base, jamais par l'appelant
-- ---------------------------------------------------------------------------

create function app.stamp_availability() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end
$$;

create trigger product_availability_stamp
before insert or update on public.product_availability
for each row execute function app.stamp_availability();

-- Upsert du formulaire Disponibilité : la mise à jour d'une ligne existante passe par on conflict.
grant update (product_id, shop_id) on public.product_availability to authenticated;

-- ---------------------------------------------------------------------------
-- Connexion : 5 échecs en 15 minutes bloquent le compte 15 minutes
-- ---------------------------------------------------------------------------

-- Boutique du jeton de site, lue depuis une fonction security definer : current_user y est le propriétaire de la
-- fonction, mais le rôle endossé par PostgREST (SET ROLE lp_site) reste visible dans le paramètre role.
create function app.caller_site_shop_id() returns uuid
language sql stable set search_path = ''
as $$
  select case when current_setting('role', true) = 'lp_site' then
    nullif(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'shop_id', '')::uuid
  end
$$;

-- Empreinte de l'email (jamais l'email en clair), par boutique.
create table public.login_failures (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops (id) on delete cascade,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index login_failures_lookup_idx on public.login_failures (shop_id, email_hash, created_at desc);
alter table public.login_failures enable row level security;
-- Aucune politique : accessible aux seules fonctions ci-dessous.

create function app.email_hash(p_email text) returns text
language sql immutable set search_path = ''
as $$ select encode(extensions.digest(lower(trim(p_email)), 'sha256'), 'hex') $$;

-- Fin du blocage de ce compte sur la boutique du site, ou null s'il peut essayer.
-- Bloqué si ses 5 derniers échecs tiennent en 15 minutes, jusqu'à 15 minutes après le dernier.
create function public.login_blocked_until(p_email text) returns timestamptz
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_shop uuid := app.caller_site_shop_id();
  v_last timestamptz;
  v_fifth timestamptz;
begin
  if v_shop is null then
    raise exception 'Réservé au site d''une boutique' using errcode = '42501';
  end if;
  select max(f.created_at), min(f.created_at) into v_last, v_fifth
  from (
    select l.created_at from public.login_failures l
    where l.shop_id = v_shop and l.email_hash = app.email_hash(p_email)
    order by l.created_at desc
    limit 5
  ) f
  having count(*) = 5;
  if v_last is not null and v_last - v_fifth <= interval '15 minutes' and now() < v_last + interval '15 minutes' then
    return v_last + interval '15 minutes';
  end if;
  return null;
end
$$;

create function public.record_login_failure(p_email text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_shop uuid := app.caller_site_shop_id();
begin
  if v_shop is null then
    raise exception 'Réservé au site d''une boutique' using errcode = '42501';
  end if;
  insert into public.login_failures (shop_id, email_hash) values (v_shop, app.email_hash(p_email));
  delete from public.login_failures where created_at < now() - interval '1 day';
end
$$;

create function public.clear_login_failures(p_email text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if app.caller_site_shop_id() is null then
    raise exception 'Réservé au site d''une boutique' using errcode = '42501';
  end if;
  delete from public.login_failures where shop_id = app.caller_site_shop_id() and email_hash = app.email_hash(p_email);
end
$$;

-- ---------------------------------------------------------------------------
-- Mot de passe oublié : lien à usage unique valable 1 heure
-- ---------------------------------------------------------------------------

-- Le jeton est tiré au hasard par le site et ne transite que dans l'email : la base n'en garde que l'empreinte.
create table public.password_resets (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index password_resets_user_idx on public.password_resets (user_id, created_at desc);
alter table public.password_resets enable row level security;
-- Aucune politique : accessible aux seules fonctions ci-dessous.

-- Enregistre la demande si l'email est celui d'un commerçant de la boutique du site. Renvoie l'adresse à laquelle
-- écrire, ou null (compte inconnu, ou plus de 3 demandes dans l'heure). Le site répond le même message dans tous les cas.
create function public.request_password_reset(p_email text, p_token_hash text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_shop uuid := app.caller_site_shop_id();
  v_user uuid;
  v_email text;
begin
  if v_shop is null then
    raise exception 'Réservé au site d''une boutique' using errcode = '42501';
  end if;
  select u.id, u.email into v_user, v_email
  from auth.users u join public.shop_users su on su.user_id = u.id and su.shop_id = v_shop
  where lower(u.email) = lower(trim(p_email));
  if v_user is null then
    return null;
  end if;
  if (select count(*) from public.password_resets r
      where r.user_id = v_user and r.created_at > now() - interval '1 hour') >= 3 then
    return null;
  end if;
  -- Un seul lien valable à la fois : les précédents sont retirés.
  update public.password_resets set used_at = now() where user_id = v_user and used_at is null;
  insert into public.password_resets (token_hash, user_id, shop_id, expires_at)
  values (p_token_hash, v_user, v_shop, now() + interval '1 hour');
  return v_email;
end
$$;

-- Vrai si le lien peut encore servir (pour afficher le formulaire ou « lien expiré »).
create function public.password_reset_valid(p_token_hash text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.password_resets r
    where r.token_hash = p_token_hash and r.shop_id = app.caller_site_shop_id() and r.used_at is null and r.expires_at > now()
  )
$$;

-- Change le mot de passe et consomme le lien ; déconnecte toutes les sessions du compte. Faux si le lien ne sert plus.
create function public.complete_password_reset(p_token_hash text, p_password text) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
begin
  if app.caller_site_shop_id() is null then
    raise exception 'Réservé au site d''une boutique' using errcode = '42501';
  end if;
  if length(coalesce(p_password, '')) < 10 then
    raise exception 'Mot de passe trop court (10 caractères minimum)' using errcode = '22023';
  end if;
  update public.password_resets r set used_at = now()
  where r.token_hash = p_token_hash and r.shop_id = app.caller_site_shop_id() and r.used_at is null and r.expires_at > now()
  returning r.user_id into v_user;
  if v_user is null then
    return false;
  end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
  where id = v_user;
  delete from auth.sessions where user_id = v_user;
  return true;
end
$$;

revoke all on function public.login_blocked_until(text), public.record_login_failure(text),
  public.clear_login_failures(text), public.request_password_reset(text, text), public.password_reset_valid(text),
  public.complete_password_reset(text, text)
  from public, anon, authenticated;
grant execute on function public.login_blocked_until(text), public.record_login_failure(text),
  public.clear_login_failures(text), public.request_password_reset(text, text), public.password_reset_valid(text),
  public.complete_password_reset(text, text)
  to lp_site;
grant execute on function app.email_hash(text), app.caller_site_shop_id() to lp_site;
