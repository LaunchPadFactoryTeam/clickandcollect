-- Lot 6 : file d'envoi des emails.

-- Dernière erreur d'envoi, pour le diagnostic depuis le hub.
alter table public.email_outbox add column last_error text;
grant update (last_error) on public.email_outbox to lp_site;

-- Messages du formulaire de contact : comptés dans le journal (quota Brevo), envoyés directement.
alter table public.email_events drop constraint email_events_kind_check;
alter table public.email_events add constraint email_events_kind_check
  check (kind in ('order_confirmation', 'merchant_new_order', 'order_ready', 'password_reset', 'monthly_export', 'contact_message'));

-- Réserve les emails dus de la boutique du site : bail de 10 minutes pendant l'envoi. Deux traitements simultanés
-- (juste après le paiement et tâche planifiée) ne prennent jamais le même email (skip locked).
create function public.claim_email_outbox(p_limit integer default 20) returns setof public.email_outbox
language sql security invoker set search_path = ''
as $$
  update public.email_outbox o
  set next_attempt_at = now() + interval '10 minutes'
  where o.id in (
    select e.id from public.email_outbox e
    where e.shop_id = app.site_shop_id() and e.sent_at is null and e.failed_at is null and e.next_attempt_at <= now()
    order by e.next_attempt_at
    limit least(greatest(p_limit, 1), 100)
    for update skip locked
  )
  returning o.*
$$;

revoke all on function public.claim_email_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(integer) to lp_site;

-- « Commande prête » : un seul email, au premier passage au statut ready, même après un retour arrière.
-- ready_email_sent_at marque l'email mis en file ; il n'est jamais remis à zéro.
create function app.queue_ready_email() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'ready' and old.status is distinct from 'ready' and new.ready_email_sent_at is null
     and new.anonymized_at is null then
    new.ready_email_sent_at := now();
    insert into public.email_outbox (shop_id, kind, payload)
    values (new.shop_id, 'order_ready', jsonb_build_object('order_id', new.id, 'number', new.number));
  end if;
  return new;
end
$$;

create trigger orders_queue_ready_email
before update of status on public.orders
for each row execute function app.queue_ready_email();
