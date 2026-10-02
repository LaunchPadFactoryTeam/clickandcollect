import type { CheckoutMetadata } from "./types.ts";

/** Métadonnées de session : des chaînes, 500 caractères au plus chacune (limite Stripe). */
export function encodeMetadata(m: CheckoutMetadata): Record<string, string> {
  return {
    shop_id: m.shopId,
    slot_id: m.slotId,
    slot_start: m.slotStart,
    slot_end: m.slotEnd,
    slot_label: m.slotLabel.slice(0, 500),
    age_declared: String(m.ageDeclared),
    marketing: String(m.marketingAccepted),
    consent_version: m.consentVersion,
    consent_hash: m.consentHash,
  };
}

export function decodeMetadata(raw: Record<string, string | undefined> | null | undefined): CheckoutMetadata {
  const r = raw ?? {};
  const need = (k: string) => {
    const v = r[k];
    if (!v) throw new Error(`Métadonnée de session manquante : ${k}`);
    return v;
  };
  return {
    shopId: need("shop_id"),
    slotId: need("slot_id"),
    slotStart: need("slot_start"),
    slotEnd: need("slot_end"),
    slotLabel: r.slot_label ?? "",
    ageDeclared: r.age_declared === "true",
    marketingAccepted: r.marketing === "true",
    consentVersion: r.consent_version ?? "",
    consentHash: r.consent_hash ?? "",
  };
}
