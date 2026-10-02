-- Lot 5 : enregistrement d'un paiement Stripe en une seule transaction.
-- Appelée par le webhook du site (rôle lp_site, via PostgREST) : idempotence sur event_id, puis commande, lignes,
-- consentement marketing et emails à envoyer. Toute erreur annule l'ensemble, y compris l'event_id : Stripe rejoue.
-- Security invoker : les droits et la RLS de lp_site s'appliquent, la boutique est celle du jeton.

create function public.record_paid_checkout(p jsonb) returns jsonb
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

  insert into public.orders (shop_id, slot_start, slot_end, email, phone, customer_hash, total_cents, vat_breakdown,
                             stripe_session_id, stripe_payment_intent_id, paid_at)
  values (v_shop, (p ->> 'slot_start')::timestamptz, (p ->> 'slot_end')::timestamptz, p ->> 'email', p ->> 'phone',
          p ->> 'customer_hash', (p ->> 'total_cents')::integer, coalesce(p -> 'vat_breakdown', '{}'::jsonb),
          p ->> 'session_id', p ->> 'payment_intent_id', now())
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

revoke all on function public.record_paid_checkout(jsonb) from public, anon, authenticated;
grant execute on function public.record_paid_checkout(jsonb) to lp_site;
