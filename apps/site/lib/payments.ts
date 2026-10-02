import { FakeProvider, StripeProvider, type PaymentProvider } from "@launchpadfactoryteam/psp";
import type { SiteEnv } from "./env";

/** Le fournisseur configuré, ou null si le paiement n'est pas encore branché sur ce site. */
export function getProvider(e: SiteEnv): PaymentProvider | null {
  if (e.LP_PSP === "fake") return new FakeProvider(e.FAKE_PSP_SECRET ?? "faux-secret-de-test-du-fournisseur");
  if (e.STRIPE_SECRET_KEY && e.STRIPE_WEBHOOK_SECRET && e.STRIPE_ACCOUNT_ID && e.STRIPE_PUBLISHABLE_KEY) {
    return new StripeProvider({
      secretKey: e.STRIPE_SECRET_KEY,
      webhookSecret: e.STRIPE_WEBHOOK_SECRET,
      accountId: e.STRIPE_ACCOUNT_ID,
      publishableKey: e.STRIPE_PUBLISHABLE_KEY,
    });
  }
  return null;
}
