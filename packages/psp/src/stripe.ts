import { decodeMetadata, encodeMetadata } from "./metadata.ts";
import { verifySignature } from "./signature.ts";
import {
  PaymentProviderError,
  type CheckoutInput,
  type CheckoutLine,
  type CreatedCheckout,
  type PaidCheckout,
  type PaymentEvent,
  type PaymentProvider,
  type VatRate,
} from "./types.ts";

/**
 * Stripe Connect, comptes Standard, charges directes : chaque appel porte l'en-tête Stripe-Account du commerçant,
 * l'argent ne transite jamais par la plateforme. Appels HTTP directs (pas de SDK) : le Worker reste léger.
 */

export interface StripeOptions {
  /** Clé secrète de la plateforme (STRIPE_SECRET_KEY). */
  secretKey: string;
  /** Secret du point de terminaison webhook (STRIPE_WEBHOOK_SECRET). */
  webhookSecret: string;
  /** Compte connecté de la boutique (STRIPE_ACCOUNT_ID). */
  accountId: string;
  /** Clé publiable de la plateforme, transmise à Stripe.js. */
  publishableKey: string;
  fetch?: typeof fetch;
  apiBase?: string;
}

type FormValue = string | number | boolean | null | undefined | FormValue[] | { [key: string]: FormValue };

/** Encodage « application/x-www-form-urlencoded » à la manière de Stripe : a[b][0][c]=… */
export function toForm(value: Record<string, FormValue>): string {
  const pairs: string[] = [];
  const walk = (prefix: string, v: FormValue) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((item, i) => walk(`${prefix}[${i}]`, item));
    else if (typeof v === "object") for (const [k, sub] of Object.entries(v)) walk(prefix ? `${prefix}[${k}]` : k, sub);
    else pairs.push(`${encodeURIComponent(prefix)}=${encodeURIComponent(String(v))}`);
  };
  walk("", value);
  return pairs.join("&");
}

export const TERMS_MESSAGE = (termsUrl: string) =>
  `J'accepte les [conditions générales de vente](${termsUrl}). Les denrées périssables ne sont pas soumises au droit de rétractation.`;

interface StripeLineItem {
  description: string;
  quantity: number;
  price: { unit_amount: number; product: { metadata?: Record<string, string> } | string };
}

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe" as const;
  readonly accountId: string;
  private readonly opts: Required<Omit<StripeOptions, "fetch">> & { fetch: typeof fetch };
  private taxRates: Promise<Record<VatRate, string>> | null = null;

  constructor(options: StripeOptions) {
    this.accountId = options.accountId;
    this.opts = { apiBase: "https://api.stripe.com", ...options, fetch: options.fetch ?? fetch.bind(globalThis) };
  }

  private async call<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, FormValue>,
    idempotencyKey?: string,
  ) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.opts.secretKey}`,
      "Stripe-Account": this.accountId,
    };
    if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
    const res = await this.opts.fetch(`${this.opts.apiBase}${path}`, {
      method,
      headers,
      body: body ? toForm(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok)
      throw new PaymentProviderError(`Stripe ${method} ${path} : ${json.error?.message ?? res.status}`, res.status);
    return json;
  }

  /**
   * Taux de TVA inclusifs 5,5 % et 20 % du compte connecté, créés au premier besoin puis réutilisés :
   * rattachés à chaque ligne, ils font apparaître la TVA par taux sur le reçu Stripe.
   */
  ensureTaxRates(): Promise<Record<VatRate, string>> {
    this.taxRates ??= (async () => {
      const list = await this.call<{ data: { id: string; percentage: number; inclusive: boolean; active: boolean }[] }>(
        "GET",
        "/v1/tax_rates?active=true&inclusive=true&limit=100",
      );
      const found = (p: number) => list.data.find((t) => t.inclusive && t.active && t.percentage === p)?.id;
      const create = async (p: VatRate) =>
        (
          await this.call<{ id: string }>("POST", "/v1/tax_rates", {
            display_name: "TVA",
            description: `TVA ${String(p).replace(".", ",")} %`,
            percentage: p,
            inclusive: true,
            country: "FR",
            jurisdiction: "FR",
            tax_type: "vat",
          })
        ).id;
      return { 5.5: found(5.5) ?? (await create(5.5)), 20: found(20) ?? (await create(20)) };
    })().catch((error) => {
      this.taxRates = null;
      throw error;
    });
    return this.taxRates;
  }

  /** Paramètres de la session, séparés de l'appel pour être testés tels quels (T5.5, T5.6). */
  async sessionParams(input: CheckoutInput): Promise<Record<string, FormValue>> {
    const rates = await this.ensureTaxRates();
    const metadata = encodeMetadata(input.metadata);
    return {
      ui_mode: "embedded",
      mode: "payment",
      locale: "fr",
      return_url: input.returnUrl,
      expires_at: Math.floor(input.expiresAt.getTime() / 1000),
      phone_number_collection: { enabled: true },
      consent_collection: { terms_of_service: "required" },
      custom_text: { terms_of_service_acceptance: { message: TERMS_MESSAGE(input.termsUrl) } },
      line_items: input.lines.map((l) => ({
        quantity: l.quantity,
        tax_rates: [rates[l.vatRate]],
        price_data: {
          currency: "eur",
          unit_amount: l.unitAmountCents,
          tax_behavior: "inclusive",
          product_data: {
            name: l.name,
            description: l.format || undefined,
            metadata: {
              product_id: l.productId,
              format: l.format,
              vat_rate: String(l.vatRate),
              is_alcohol: String(l.isAlcohol),
            },
          },
        },
      })),
      metadata,
      payment_intent_data: { metadata },
    };
  }

  async createCheckout(input: CheckoutInput): Promise<CreatedCheckout> {
    const session = await this.call<{ id: string; client_secret: string }>(
      "POST",
      "/v1/checkout/sessions",
      await this.sessionParams(input),
      crypto.randomUUID(),
    );
    return {
      provider: "stripe",
      sessionId: session.id,
      clientSecret: session.client_secret,
      publishableKey: this.opts.publishableKey,
      accountId: this.accountId,
    };
  }

  /** Session payée, relue chez Stripe avec ses lignes : les montants enregistrés sont ceux réellement débités. */
  async paidCheckout(sessionId: string): Promise<PaidCheckout> {
    const session = await this.call<{
      id: string;
      payment_intent: string | null;
      amount_total: number;
      customer_details: { email: string | null; phone: string | null } | null;
      metadata: Record<string, string>;
    }>("GET", `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
    const items = await this.call<{ data: StripeLineItem[] }>(
      "GET",
      `/v1/checkout/sessions/${encodeURIComponent(sessionId)}/line_items?limit=100&expand[]=data.price.product`,
    );
    const email = session.customer_details?.email;
    if (!email) throw new PaymentProviderError(`Session ${sessionId} payée sans email`);
    return {
      sessionId: session.id,
      paymentIntentId: session.payment_intent,
      email,
      phone: session.customer_details?.phone ?? null,
      amountTotalCents: session.amount_total,
      lines: items.data.map(fromStripeLine),
      metadata: decodeMetadata(session.metadata),
    };
  }

  async verifyWebhook(rawBody: string, signature: string | null): Promise<PaymentEvent> {
    await verifySignature(rawBody, signature, this.opts.webhookSecret);
    const event = JSON.parse(rawBody) as {
      id: string;
      type: string;
      account?: string;
      data: { object: { id: string; payment_status?: string } };
    };
    const base = { eventId: event.id, type: event.type, account: event.account ?? null };
    const paid =
      (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") ||
      event.type === "checkout.session.async_payment_succeeded";
    // Un événement d'un autre compte connecté n'est jamais relu chez Stripe : on n'a pas le droit d'y toucher.
    if (!paid || base.account !== this.accountId) return { kind: "ignored", ...base };
    return { kind: "checkout.paid", ...base, checkout: await this.paidCheckout(event.data.object.id) };
  }

  async refund(paymentId: string, amountCents?: number): Promise<void> {
    await this.call("POST", "/v1/refunds", { payment_intent: paymentId, amount: amountCents }, crypto.randomUUID());
  }

  /** Domaine de la boutique enregistré sur le compte connecté : condition d'affichage d'Apple Pay. */
  async registerPaymentDomain(domain: string): Promise<void> {
    await this.call("POST", "/v1/payment_method_domains", { domain_name: domain, enabled: true });
  }
}

function fromStripeLine(item: StripeLineItem): CheckoutLine {
  const meta = typeof item.price.product === "object" ? (item.price.product.metadata ?? {}) : {};
  return {
    productId: meta.product_id ?? "",
    name: item.description,
    format: meta.format ?? "",
    unitAmountCents: item.price.unit_amount,
    vatRate: meta.vat_rate === "20" ? 20 : 5.5,
    quantity: item.quantity,
    isAlcohol: meta.is_alcohol === "true",
  };
}
