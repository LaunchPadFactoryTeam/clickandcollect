import { JOURS, type ClientConfig } from "@launchpadfactoryteam/config";

/**
 * Faits de la boutique dérivés de la configuration, en texte sélectionnable :
 * utilisés par les pages, les données structurées et llms.txt (règle GEO « informations clés en texte »).
 */

export interface PostalAddress {
  street: string;
  postalCode: string;
  city: string;
}

/** « 12 rue des Halles, 34000 Montpellier » → rue, code postal, ville. */
export function splitAddress(adresse: string): PostalAddress {
  const m = /^(.*?),\s*(\d{5})\s+(.+)$/.exec(adresse.trim());
  if (!m) return { street: adresse.trim(), postalCode: "", city: "" };
  return { street: m[1]!.trim(), postalCode: m[2]!, city: m[3]!.trim() };
}

export function siteUrl(config: ClientConfig): string {
  return `https://${config.boutique.domaine}`;
}

/** « +33467000000 » → « 04 67 00 00 00 ». */
export function displayPhone(e164: string): string {
  const m = /^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : e164;
}

const range = (plage: string) => plage.replace("-", "–");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface PickupLine {
  days: string;
  slots: string;
}

/**
 * Créneaux de retrait regroupés par jours consécutifs identiques :
 * « Mardi au samedi » / « 10:00–12:00 · 16:00–19:00 ».
 */
export function pickupSummary(creneaux: ClientConfig["retrait"]["creneaux"]): PickupLine[] {
  const lines: PickupLine[] = [];
  let start: number | null = null;
  let current = "";
  const flush = (end: number) => {
    if (start === null) return;
    const days = start === end ? cap(JOURS[start]!) : `${cap(JOURS[start]!)} au ${JOURS[end]}`;
    lines.push({ days, slots: current });
    start = null;
  };
  JOURS.forEach((jour, i) => {
    const slots = (creneaux[jour] ?? []).map(range).join(" · ");
    if (slots && slots === current && start !== null) return;
    flush(i - 1);
    if (slots) {
      start = i;
      current = slots;
    } else current = "";
  });
  flush(JOURS.length - 1);
  return lines;
}

export function preparationLabel(heures: number): string {
  if (heures === 0) return "Préparée sans délai";
  return `${heures} heure${heures > 1 ? "s" : ""} minimum`;
}
