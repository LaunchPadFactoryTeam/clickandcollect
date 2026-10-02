import { buildCheckout } from "@launchpadfactoryteam/commerce";
import type { ClientConfig } from "@launchpadfactoryteam/config";
import type { CatalogProduct, SiteContent } from "@launchpadfactoryteam/content";
import { sha256Hex, type PaymentProvider, type VatRate } from "@launchpadfactoryteam/psp";

/** Durée de validité de la session de paiement. */
export const SESSION_MINUTES = 30;

export interface CheckoutDeps {
  provider: PaymentProvider;
  config: ClientConfig;
  catalog: CatalogProduct[];
  settings: SiteContent["settings"];
  shopId: string;
  /** Origine publique du site (https://domaine), pour les adresses de retour et des CGV. */
  origin: string;
  now: Date;
}

export type HandlerResult = { status: number; body: Record<string, unknown> };

/**
 * POST /api/checkout : recalcule tout côté serveur, puis ouvre la session de paiement.
 * Corps attendu : { cart: [{ productId, quantity }], slotId, ageDeclared, marketing }.
 */
export async function handleCheckout(body: unknown, deps: CheckoutDeps): Promise<HandlerResult> {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const result = buildCheckout(
    { cart: b.cart, slotId: b.slotId, ageDeclared: b.ageDeclared },
    {
      catalog: deps.catalog,
      pickup: deps.config.retrait,
      alcoholFeature: deps.config.features.alcool,
      now: deps.now,
    },
  );
  if (!result.ok) {
    const names = new Map(deps.catalog.map((p) => [p.id, p.name]));
    const products =
      result.code === "UNAVAILABLE" ? result.productIds.map((id) => ({ id, name: names.get(id) ?? null })) : undefined;
    return { status: 409, body: { code: result.code, ...(products ? { products } : {}) } };
  }
  const { settings } = deps;
  try {
    const created = await deps.provider.createCheckout({
      lines: result.lines.map(({ product, quantity }) => ({
        productId: product.id,
        name: product.name,
        format: product.format,
        unitAmountCents: product.priceTtcCents,
        vatRate: product.vatRate as VatRate,
        quantity,
        isAlcohol: product.isAlcohol,
      })),
      metadata: {
        shopId: deps.shopId,
        slotId: result.slot.id,
        slotStart: result.slot.startsAt,
        slotEnd: result.slot.endsAt,
        slotLabel: result.slot.label,
        ageDeclared: result.hasAlcohol && b.ageDeclared === true,
        marketingAccepted: b.marketing === true,
        // Le texte et sa version sont ceux du serveur : le navigateur ne fait que cocher.
        consentVersion: settings.marketingConsentVersion,
        consentHash: await sha256Hex(settings.marketingConsentText),
      },
      returnUrl: `${deps.origin}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      termsUrl: `${deps.origin}/cgv`,
      expiresAt: new Date(deps.now.getTime() + SESSION_MINUTES * 60_000),
    });
    return {
      status: 200,
      body: { ...created, totalCents: result.totals.totalCents, slotLabel: result.slot.label },
    };
  } catch (error) {
    return { status: 502, body: { code: "PROVIDER_ERROR", message: (error as Error).message } };
  }
}
