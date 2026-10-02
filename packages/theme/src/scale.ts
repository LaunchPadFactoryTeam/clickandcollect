/** Jetons fixes du design system : identiques d'un site à l'autre. */

import type { ClientConfig } from "@launchpadfactoryteam/config";

export interface TypeStep {
  name: string;
  size: string;
  lineHeight: number;
  weight: number;
  letterSpacing?: string;
}

export const TYPE_SCALE: readonly TypeStep[] = [
  { name: "display-1", size: "clamp(40px, 6vw, 64px)", lineHeight: 1.02, weight: 600 },
  { name: "display-2", size: "clamp(30px, 4vw, 44px)", lineHeight: 1.08, weight: 600 },
  { name: "heading", size: "clamp(22px, 2.6vw, 28px)", lineHeight: 1.2, weight: 600 },
  { name: "lead", size: "19px", lineHeight: 1.5, weight: 400 },
  { name: "body", size: "16px", lineHeight: 1.6, weight: 400 },
  { name: "small", size: "14px", lineHeight: 1.5, weight: 400 },
  { name: "overline", size: "12px", lineHeight: 1.4, weight: 500, letterSpacing: "0.14em" },
];

/** Trame de 4 px. */
export const SPACING = [4, 8, 12, 16, 24, 32, 48, 64, 96] as const;

export const RADII: Record<ClientConfig["design"]["arrondis"], readonly [number, number, number]> = {
  net: [0, 0, 0],
  doux: [4, 6, 10],
  rond: [10, 18, 28],
};

export const BREAKPOINTS = { md: 720, lg: 1024, xl: 1440 } as const;
export const CONTENT_MAX_WIDTH = 1320;

/** Couleurs de statut de commande : fixes, indépendantes de la charte. */
export const STATUS_COLORS = {
  nouvelle: { label: "Nouvelle", dot: "#1F4B7A", bg: "#E8EFF7", fg: "#174063" },
  preparation: { label: "En préparation", dot: "#9A7108", bg: "#FBF0D9", fg: "#6B4D07" },
  prete: { label: "Prête", dot: "#2A6B40", bg: "#E0F0E4", fg: "#1F5130" },
  retiree: { label: "Retirée", dot: "#767D89", bg: "#EEF0F3", fg: "#454B55" },
} as const;

export const FALLBACK_STACKS = {
  serif: 'Georgia, "Times New Roman", serif',
  "sans-serif": 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
} as const;
