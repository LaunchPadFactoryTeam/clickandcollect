import { decodeMetadata, encodeMetadata } from "./metadata.ts";
import { sha256Hex, signPayload, verifySignature } from "./signature.ts";
import type { CheckoutInput, CheckoutLine, CreatedCheckout, PaymentEvent, PaymentProvider } from "./types.ts";

/**
 * Faux fournisseur : le tunnel complet tourne sans Stripe (tests de bout en bout, démonstrations).
 * Sans état : l'identifiant de session transporte lui-même les lignes et les métadonnées, ce qui le rend
 * utilisable par plusieurs instances du Worker. Ses événements sont signés comme ceux de Stripe.
 */

export const FAKE_ACCOUNT_ID = "acct_fake";
const PREFIX = "cs_fake_";

interface FakeSession {
  /** Unique par session, comme chez Stripe : deux paniers identiques font deux sessions distinctes. */
  nonce: string;
  lines: CheckoutLine[];
  metadata: Record<string, string>;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(text: string): string {
  let binary = "";
  for (const byte of encoder.encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(data: string): string {
  const binary = atob(data.replaceAll("-", "+").replaceAll("_", "/"));
  return decoder.decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export class FakeProvider implements PaymentProvider {
  readonly name = "fake" as const;
  readonly accountId = FAKE_ACCOUNT_ID;
  readonly refunds: { paymentId: string; amountCents?: number }[] = [];

  constructor(private readonly webhookSecret: string) {}

  async createCheckout(input: CheckoutInput): Promise<CreatedCheckout> {
    const session: FakeSession = {
      nonce: crypto.randomUUID(),
      lines: input.lines,
      metadata: encodeMetadata(input.metadata),
    };
    const sessionId = PREFIX + toBase64Url(JSON.stringify(session));
    return { provider: "fake", sessionId, clientSecret: sessionId };
  }

  /** Événement « session payée » tel que Stripe l'enverrait, signé avec le secret du faux fournisseur. */
  async paidEvent(
    sessionId: string,
    customer: { email: string; phone?: string; name?: string },
    account = FAKE_ACCOUNT_ID,
  ) {
    // Identifiant stable pour une même session (un rejeu garde le même), distinct d'une session à l'autre.
    const rawBody = JSON.stringify({
      id: `evt_fake_${(await sha256Hex(sessionId)).slice(0, 24)}`,
      type: "checkout.session.completed",
      account,
      data: {
        object: {
          id: sessionId,
          payment_status: "paid",
          customer_details: { email: customer.email, phone: customer.phone ?? null, name: customer.name ?? null },
        },
      },
    });
    return { rawBody, signature: await signPayload(rawBody, this.webhookSecret) };
  }

  async verifyWebhook(rawBody: string, signature: string | null): Promise<PaymentEvent> {
    await verifySignature(rawBody, signature, this.webhookSecret);
    const event = JSON.parse(rawBody) as {
      id: string;
      type: string;
      account?: string;
      data: {
        object: {
          id: string;
          payment_status?: string;
          customer_details?: { email: string; phone: string | null; name?: string | null };
        };
      };
    };
    const base = { eventId: event.id, type: event.type, account: event.account ?? null };
    const object = event.data.object;
    if (
      event.type !== "checkout.session.completed" ||
      object.payment_status !== "paid" ||
      base.account !== this.accountId
    ) {
      return { kind: "ignored", ...base };
    }
    if (!object.id.startsWith(PREFIX)) throw new Error(`Session inconnue du faux fournisseur : ${object.id}`);
    const session = JSON.parse(fromBase64Url(object.id.slice(PREFIX.length))) as FakeSession;
    return {
      kind: "checkout.paid",
      ...base,
      checkout: {
        sessionId: object.id,
        paymentIntentId: `pi_fake_${event.id.slice(-16)}`,
        email: object.customer_details?.email ?? "",
        phone: object.customer_details?.phone ?? null,
        name: object.customer_details?.name ?? null,
        amountTotalCents: session.lines.reduce((sum, l) => sum + l.unitAmountCents * l.quantity, 0),
        lines: session.lines,
        metadata: decodeMetadata(session.metadata),
      },
    };
  }

  async refund(paymentId: string, amountCents?: number): Promise<void> {
    this.refunds.push({ paymentId, amountCents });
  }
}
