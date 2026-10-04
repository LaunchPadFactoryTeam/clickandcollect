-- Lot 8 : conservation des données, export et effacement (section 1.10 des spécifications).
-- Durées du cadrage (reprises dans @launchpadfactoryteam/rgpd, RETENTION) :
--   coordonnées et empreinte : 3 ans après la dernière commande du client ;
--   consentement marketing : jusqu'au retrait ou 3 ans sans commande, puis archivé ; preuve archivée 5 ans ;
--   désinscrits : 3 ans au moins (jamais supprimés par la tâche) ;
--   montants et lignes de vente : 10 ans, sans donnée personnelle.

-- Consentement archivé : retiré de la liste de diffusion (email effacé), preuve gardée 5 ans.
alter table public.consents add column archived_at timestamptz;
create index consents_archived_idx on public.consents (archived_at) where archived_at is not null;

-- Journal des demandes d'accès et d'effacement : jamais l'email en clair, son empreinte SHA-256.
create table public.privacy_requests (
  id bigint generated always as identity primary key,
  shop_id uuid not null references public.shops (id) on delete cascade,
  kind text not null check (kind in ('export', 'erase')),
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  requested_by uuid references auth.users (id) on delete set null,
  orders_count integer not null default 0,
  consents_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index privacy_requests_shop_idx on public.privacy_requests (shop_id, created_at desc);
alter table public.privacy_requests enable row level security;
grant select on public.privacy_requests to authenticated;
create policy privacy_requests_read on public.privacy_requests for select to authenticated using (app.is_launchpad_admin());

-- ---------------------------------------------------------------------------
-- Conservation : tâche mensuelle, boutique par boutique
-- ---------------------------------------------------------------------------

-- Applique les durées de conservation à une boutique, à la date p_now. Renvoie le nombre de lignes traitées.
create function app.apply_retention(p_shop uuid, p_now timestamptz) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_anonymized integer;
  v_archived integer;
  v_consents_deleted integer;
  v_orders_deleted integer;
begin
  -- Clients sans commande depuis 3 ans : coordonnées et empreinte effacées sur toutes leurs commandes.
  with last_orders as (
    select coalesce(o.customer_hash, lower(o.email)) as customer, max(o.paid_at) as last_paid
    from public.orders o
    where o.shop_id = p_shop and o.anonymized_at is null
    group by 1
  )
  update public.orders o
  set email = null, phone = null, customer_name = null, customer_hash = null, anonymized_at = p_now
  from last_orders l
  where o.shop_id = p_shop and o.anonymized_at is null
    and coalesce(o.customer_hash, lower(o.email)) = l.customer
    and l.last_paid < p_now - interval '3 years';
  get diagnostics v_anonymized = row_count;

  -- Consentements retirés, ou sans commande depuis 3 ans : retirés de la liste, preuve archivée.
  update public.consents c
  set archived_at = p_now, email = null
  where c.shop_id = p_shop and c.archived_at is null
    and (c.withdrawn_at is not null
         or (c.given_at < p_now - interval '3 years'
             and not exists (select 1 from public.orders o
                             where o.shop_id = p_shop and o.customer_hash = c.customer_hash
                               and o.paid_at >= p_now - interval '3 years')));
  get diagnostics v_archived = row_count;

  -- Preuves archivées depuis plus de 5 ans : supprimées.
  delete from public.consents c
  where c.shop_id = p_shop and c.archived_at < p_now - interval '5 years';
  get diagnostics v_consents_deleted = row_count;

  -- Ventes de plus de 10 ans : supprimées avec leurs lignes et leur historique.
  delete from public.orders o
  where o.shop_id = p_shop and o.paid_at < p_now - interval '10 years';
  get diagnostics v_orders_deleted = row_count;

  -- Hygiène : liens de réinitialisation expirés depuis plus d'un jour.
  delete from public.password_resets r where r.shop_id = p_shop and r.expires_at < p_now - interval '1 day';

  return jsonb_build_object('anonymized_orders', v_anonymized, 'archived_consents', v_archived,
                            'deleted_consents', v_consents_deleted, 'deleted_orders', v_orders_deleted);
end
$$;
revoke all on function app.apply_retention(uuid, timestamptz) from public, anon, authenticated, lp_site;

-- Appelée chaque mois par la tâche planifiée du site, pour sa boutique, à la date du jour.
create function public.apply_retention() returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if app.caller_site_shop_id() is null then
    raise exception 'Réservé au site d''une boutique' using errcode = '42501';
  end if;
  return app.apply_retention(app.caller_site_shop_id(), now());
end
$$;
revoke all on function public.apply_retention() from public, anon, authenticated;
grant execute on function public.apply_retention() to lp_site;

-- ---------------------------------------------------------------------------
-- Droits des personnes : export et effacement par email (hub LaunchPad)
-- ---------------------------------------------------------------------------

-- L'équipe LaunchPad (hub), la clé service_role, ou une connexion d'administration directe à la base (éditeur SQL
-- de Supabase) : aucun rôle endossé, contrairement aux appels passant par PostgREST.
create function app.can_handle_privacy_requests() returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.is_launchpad_admin() or coalesce(current_setting('role', true), 'none') in ('none', 'service_role')
$$;

-- Toutes les commandes et tous les consentements d'un email sur une boutique, en JSON ; la demande est journalisée.
create function public.export_customer_data(p_shop uuid, p_email text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(regexp_replace(p_email, '\s', '', 'g'));
  v_orders jsonb;
  v_consents jsonb;
begin
  if not app.can_handle_privacy_requests() then
    raise exception 'Réservé à l''équipe LaunchPad' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'numero', o.number, 'payee_le', o.paid_at, 'statut', o.status,
           'creneau', jsonb_build_object('debut', o.slot_start, 'fin', o.slot_end),
           'nom', o.customer_name, 'email', o.email, 'telephone', o.phone,
           'total_centimes', o.total_cents, 'tva_centimes', o.vat_breakdown,
           'lignes', (select coalesce(jsonb_agg(jsonb_build_object(
                        'produit', i.name, 'format', i.format, 'quantite', i.quantity,
                        'prix_unitaire_centimes', i.unit_price_cents, 'taux_tva', i.vat_rate) order by i.id), '[]'::jsonb)
                      from public.order_items i where i.order_id = o.id)
         ) order by o.paid_at), '[]'::jsonb)
  into v_orders
  from public.orders o
  where o.shop_id = p_shop and lower(o.email) = v_email;

  select coalesce(jsonb_agg(jsonb_build_object(
           'donne_le', c.given_at, 'version_du_texte', c.text_version, 'empreinte_du_texte', c.text_hash,
           'retire_le', c.withdrawn_at, 'archive_le', c.archived_at) order by c.given_at), '[]'::jsonb)
  into v_consents
  from public.consents c
  where c.shop_id = p_shop and lower(c.email) = v_email;

  insert into public.privacy_requests (shop_id, kind, email_hash, requested_by, orders_count, consents_count)
  values (p_shop, 'export', encode(extensions.digest(v_email, 'sha256'), 'hex'), auth.uid(),
          jsonb_array_length(v_orders), jsonb_array_length(v_consents));

  return jsonb_build_object('boutique', (select s.name from public.shops s where s.id = p_shop), 'email', v_email,
                            'genere_le', now(), 'commandes', v_orders, 'consentements', v_consents);
end
$$;

-- Efface les coordonnées d'un email sur une boutique : commandes anonymisées (montants et lignes gardés),
-- consentements retirés et archivés sans email. La demande est journalisée. Renvoie les nombres de lignes traitées.
create function public.erase_customer_data(p_shop uuid, p_email text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(regexp_replace(p_email, '\s', '', 'g'));
  v_orders integer;
  v_consents integer;
begin
  if not app.can_handle_privacy_requests() then
    raise exception 'Réservé à l''équipe LaunchPad' using errcode = '42501';
  end if;
  update public.orders o
  set email = null, phone = null, customer_name = null, customer_hash = null, anonymized_at = now()
  where o.shop_id = p_shop and lower(o.email) = v_email;
  get diagnostics v_orders = row_count;

  update public.consents c
  set email = null, withdrawn_at = coalesce(c.withdrawn_at, now()), archived_at = coalesce(c.archived_at, now())
  where c.shop_id = p_shop and lower(c.email) = v_email;
  get diagnostics v_consents = row_count;

  insert into public.privacy_requests (shop_id, kind, email_hash, requested_by, orders_count, consents_count)
  values (p_shop, 'erase', encode(extensions.digest(v_email, 'sha256'), 'hex'), auth.uid(), v_orders, v_consents);

  return jsonb_build_object('commandes_anonymisees', v_orders, 'consentements_retires', v_consents);
end
$$;

revoke all on function public.export_customer_data(uuid, text), public.erase_customer_data(uuid, text),
  app.can_handle_privacy_requests() from public, anon, lp_site;
grant execute on function public.export_customer_data(uuid, text), public.erase_customer_data(uuid, text),
  app.can_handle_privacy_requests() to authenticated;
