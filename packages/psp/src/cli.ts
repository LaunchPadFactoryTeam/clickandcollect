import { StripeProvider } from "./stripe.ts";

/**
 * lp-psp enregistrer-domaine <domaine> : enregistre le domaine de la boutique sur son compte connecté Stripe,
 * condition d'affichage d'Apple Pay (et de Google Pay) dans le formulaire intégré. À lancer une fois par boutique.
 * Variables : STRIPE_SECRET_KEY (plateforme), STRIPE_ACCOUNT_ID (compte connecté).
 */
export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const [command, domain] = argv;
  if (command !== "enregistrer-domaine" || !domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    console.error("Usage : lp-psp enregistrer-domaine <domaine>   (ex. maison-ferrand.fr)");
    return 2;
  }
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_ACCOUNT_ID) {
    console.error("STRIPE_SECRET_KEY et STRIPE_ACCOUNT_ID sont nécessaires.");
    return 2;
  }
  const stripe = new StripeProvider({
    secretKey: env.STRIPE_SECRET_KEY,
    accountId: env.STRIPE_ACCOUNT_ID,
    webhookSecret: "inutile-ici",
    publishableKey: "inutile-ici",
  });
  try {
    await stripe.registerPaymentDomain(domain);
    console.log(
      `Domaine ${domain} enregistré sur le compte ${env.STRIPE_ACCOUNT_ID} : Apple Pay et Google Pay activables.`,
    );
    return 0;
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }
}
