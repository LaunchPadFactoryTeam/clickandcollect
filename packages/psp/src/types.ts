/** Contrat de paiement du core : Stripe en est la première implémentation, un faux fournisseur sert aux tests. */

export type VatRate = 5.5 | 20;

/** Une ligne telle que recalculée par le serveur depuis le catalogue ; jamais un prix venu du navigateur. */
export interface CheckoutLine {
  productId: string;
  name: string;
  format: string;
  unitAmountCents: number;
  vatRate: VatRate;
  quantity: number;
  isAlcohol: boolean;
}

/** Ce qui accompagne la session et revient avec l'événement de paiement. */
export interface CheckoutMetadata {
  shopId: string;
  slotId: string;
  /** Début et fin du créneau en UTC (ISO 8601). */
  slotStart: string;
  slotEnd: string;
  slotLabel: string;
  ageDeclared: boolean;
  marketingAccepted: boolean;
  /** Version et empreinte SHA-256 du texte de la case marketing présenté au client. */
  consentVersion: string;
  consentHash: string;
}

export interface CheckoutInput {
  lines: CheckoutLine[];
  metadata: CheckoutMetadata;
  /** Page de confirmation ; « {CHECKOUT_SESSION_ID} » est remplacé par le fournisseur. */
  returnUrl: string;
  termsUrl: string;
  expiresAt: Date;
}

export interface CreatedCheckout {
  provider: "stripe" | "fake";
  sessionId: string;
  clientSecret: string;
  /** Pour Stripe.js côté navigateur : clé publiable de la plateforme et compte connecté de la boutique. */
  publishableKey?: string;
  accountId?: string;
}

export interface PaidCheckout {
  sessionId: string;
  paymentIntentId: string | null;
  email: string;
  phone: string | null;
  amountTotalCents: number;
  lines: CheckoutLine[];
  metadata: CheckoutMetadata;
}

export type PaymentEvent =
  | { kind: "checkout.paid"; eventId: string; type: string; account: string | null; checkout: PaidCheckout }
  | { kind: "ignored"; eventId: string; type: string; account: string | null };

export interface PaymentProvider {
  readonly name: "stripe" | "fake";
  /** Compte connecté de la boutique : les événements d'un autre compte sont ignorés. */
  readonly accountId: string;
  createCheckout(input: CheckoutInput): Promise<CreatedCheckout>;
  /** Vérifie la signature et normalise l'événement ; lève WebhookSignatureError si la signature est invalide. */
  verifyWebhook(rawBody: string, signature: string | null): Promise<PaymentEvent>;
  refund(paymentId: string, amountCents?: number): Promise<void>;
}

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
