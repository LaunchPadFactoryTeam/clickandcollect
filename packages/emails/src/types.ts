import type { EmailPalette } from "./palette.ts";

/** Ce qu'un email sait de la boutique : identité, adresse, horaires, charte. */
export interface ShopInfo {
  name: string;
  domain: string;
  /** Adresse sur une ligne : « 12 rue des Halles, 34000 Montpellier ». */
  address: string;
  phone: string;
  /** Horaires d'ouverture déjà mis en forme, une ligne par groupe de jours. */
  openingHours: string[];
  /** Lien vers le plan (fiche Google de la boutique, ou recherche de l'adresse). */
  mapUrl: string;
  palette: EmailPalette;
}

/** Une commande telle qu'enregistrée en base (copie figée au paiement). */
export interface OrderInfo {
  id: string;
  number: number;
  slotStart: string;
  slotEnd: string;
  email: string;
  phone: string | null;
  totalCents: number;
  vatBreakdown: Record<string, number>;
  items: { name: string; format: string; quantity: number; unitPriceCents: number; vatRate: number }[];
}

/** Un email prêt à partir. */
export interface OutgoingEmail {
  to: { email: string; name?: string }[];
  subject: string;
  html: string;
  text: string;
  replyTo?: { email: string; name?: string };
  /** Étiquette du type d'email, reprise dans le journal et chez Brevo. */
  tag: string;
}
