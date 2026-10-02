/** @launchpadfactoryteam/psp — Interface PSP, implémentation Stripe et faux fournisseur de test (lot 5). */
export { FakeProvider, FAKE_ACCOUNT_ID } from "./fake.ts";
export { decodeMetadata, encodeMetadata } from "./metadata.ts";
export { hmacSha256Hex, sha256Hex, signPayload, SIGNATURE_TOLERANCE_SECONDS, verifySignature } from "./signature.ts";
export { StripeProvider, TERMS_MESSAGE, toForm, type StripeOptions } from "./stripe.ts";
export {
  PaymentProviderError,
  WebhookSignatureError,
  type CheckoutInput,
  type CheckoutLine,
  type CheckoutMetadata,
  type CreatedCheckout,
  type PaidCheckout,
  type PaymentEvent,
  type PaymentProvider,
  type VatRate,
} from "./types.ts";
