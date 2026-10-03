import type { ClientConfig } from "@launchpadfactoryteam/config";
import { formatOpeningHours, type SiteContent } from "@launchpadfactoryteam/content";
import {
  BrevoMailer,
  emailPalette,
  FakeMailer,
  merchantNewOrderEmail,
  orderConfirmationEmail,
  orderReadyEmail,
  processOutbox,
  type Mailer,
  type OrderInfo,
  type OutboxDeps,
  type OutboxReport,
  type OutgoingEmail,
  type ShopInfo,
} from "@launchpadfactoryteam/emails";
import { displayPhone } from "@launchpadfactoryteam/seo";
import { alert } from "./alert";
import { shopIdFromToken, type SiteEnv } from "./env";
import { claimOutbox, fetchOrder, hasDatabase, logEmailEvent, updateOutbox, type StoredOrder } from "./orders";

export function shopInfo(
  config: ClientConfig,
  settings: SiteContent["settings"],
  tokens: { isDark: boolean; variables: Record<string, string> },
): ShopInfo {
  const address = config.boutique.adresse;
  return {
    name: config.boutique.nom,
    domain: config.boutique.domaine,
    address,
    phone: displayPhone(config.boutique.telephone),
    openingHours: formatOpeningHours(settings.openingHours),
    mapUrl:
      settings.googleBusinessUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
    palette: emailPalette(tokens),
  };
}

/** Le prestataire configuré, ou null : les emails restent alors en file jusqu'à ce qu'une clé Brevo soit posée. */
export function getMailer(e: SiteEnv, config: ClientConfig, settings: SiteContent["settings"]): Mailer | null {
  if (e.LP_EMAIL === "fake") return new FakeMailer();
  if (!e.BREVO_API_KEY) return null;
  return new BrevoMailer({
    apiKey: e.BREVO_API_KEY,
    sender: { email: e.EMAIL_FROM ?? settings.email, name: config.boutique.nom },
  });
}

export function toOrderInfo(o: StoredOrder): OrderInfo | null {
  if (!o.email || o.anonymized_at) return null;
  return {
    id: o.id,
    number: o.number,
    slotStart: o.slot_start,
    slotEnd: o.slot_end,
    email: o.email,
    phone: o.phone,
    totalCents: o.total_cents,
    vatBreakdown: o.vat_breakdown,
    items: o.order_items.map((i) => ({
      name: i.name,
      format: i.format,
      quantity: i.quantity,
      unitPriceCents: i.unit_price_cents,
      vatRate: Number(i.vat_rate),
    })),
  };
}

/** Compose l'email d'une ligne de la file ; null s'il n'a plus de destinataire (commande anonymisée). */
export async function composeEmail(
  row: { kind: string; payload: Record<string, unknown> },
  ctx: { shop: ShopInfo; notificationEmail: string; loadOrder: (id: string) => Promise<StoredOrder | null> },
): Promise<OutgoingEmail | null> {
  const orderId = typeof row.payload.order_id === "string" ? row.payload.order_id : null;
  if (!orderId) throw new Error(`Email ${row.kind} sans commande`);
  const stored = await ctx.loadOrder(orderId);
  const order = stored && toOrderInfo(stored);
  if (!order) return null;
  switch (row.kind) {
    case "order_confirmation":
      return orderConfirmationEmail(ctx.shop, order);
    case "merchant_new_order":
      return merchantNewOrderEmail(ctx.shop, order, ctx.notificationEmail);
    case "order_ready":
      return orderReadyEmail(ctx.shop, order);
    default:
      throw new Error(`Type d'email inconnu : ${row.kind}`);
  }
}

/**
 * Envoie les emails dus de la boutique. Appelé juste après l'enregistrement d'un paiement, puis toutes les
 * 5 minutes par la tâche planifiée du Worker (rejeu des échecs).
 */
export async function processPendingEmails(
  e: SiteEnv,
  site: {
    config: ClientConfig;
    settings: SiteContent["settings"];
    tokens: { isDark: boolean; variables: Record<string, string> };
  },
): Promise<OutboxReport | null> {
  const shopId = shopIdFromToken(e.SUPABASE_SHOP_JWT);
  const mailer = getMailer(e, site.config, site.settings);
  if (!mailer || !shopId || !hasDatabase(e)) return null;
  const shop = shopInfo(site.config, site.settings, site.tokens);
  const deps: OutboxDeps = {
    claim: (limit) => claimOutbox(e, limit),
    compose: (row) =>
      composeEmail(row, {
        shop,
        notificationEmail: site.config.boutique.email_notifications,
        loadOrder: (id) => fetchOrder(e, id),
      }),
    send: (email) => mailer.send(email),
    markSent: (row, at) => updateOutbox(e, row.id, { sent_at: at.toISOString() }),
    markRetry: (row, attempts, next, error) =>
      updateOutbox(e, row.id, { attempts, next_attempt_at: next.toISOString(), last_error: error.slice(0, 500) }),
    markFailed: (row, attempts, at, error) =>
      updateOutbox(e, row.id, { attempts, failed_at: at.toISOString(), last_error: error.slice(0, 500) }),
    logEvent: ({ kind, orderId, messageId, status }) =>
      logEmailEvent(e, { shop_id: shopId, kind, order_id: orderId, provider_message_id: messageId, status }),
    alert: (message, details) => alert(e.ALERT_WEBHOOK_URL, message, details),
    now: () => new Date(),
  };
  return processOutbox(deps);
}
