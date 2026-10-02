import type { z } from "zod";
import { configSchema, JOURS, type ClientConfig } from "./schema.ts";

export interface ConfigIssue {
  /** Chemin de la clé fautive, ex. "boutique.nom". Vide pour une erreur globale. */
  path: string;
  message: string;
}

export class ConfigError extends Error {
  readonly issues: ConfigIssue[];
  constructor(issues: ConfigIssue[], source?: string) {
    const head = source ? `Configuration invalide (${source})` : "Configuration invalide";
    super([head, ...issues.map((i) => `  - ${i.path || "(racine)"} : ${i.message}`)].join("\n"));
    this.name = "ConfigError";
    this.issues = issues;
  }
}

export interface ValidateOptions {
  /** Version du core installée ; si fournie, core_version doit lui être égale. */
  coreVersion?: string;
  /** Date de référence pour le contrôle des créneaux (défaut : maintenant). */
  now?: Date;
  /** Nom du fichier, pour les messages d'erreur. */
  source?: string;
}

/** Horizon sur lequel au moins un créneau doit exister. */
export const HORIZON_JOURS = 14;

function toIssues(error: z.ZodError): ConfigIssue[] {
  return error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
}

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export function parisDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
}

/** Jours d'ouverture (AAAA-MM-JJ) dans l'horizon, fermetures exclues. */
export function openDays(config: ClientConfig, now: Date, horizon = HORIZON_JOURS): string[] {
  const start = Date.parse(`${parisDate(now)}T12:00:00Z`);
  const closed = new Set(config.retrait.fermetures);
  const days: string[] = [];
  for (let i = 0; i < horizon; i++) {
    const d = new Date(start + i * 864e5);
    const iso = d.toISOString().slice(0, 10);
    const jour = JOURS[(d.getUTCDay() + 6) % 7]!;
    if (!closed.has(iso) && (config.retrait.creneaux[jour]?.length ?? 0) > 0) days.push(iso);
  }
  return days;
}

export function validateConfig(raw: unknown, options: ValidateOptions = {}): ClientConfig {
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) throw new ConfigError(toIssues(parsed.error), options.source);
  const config = parsed.data;

  const issues: ConfigIssue[] = [];
  if (options.coreVersion && config.core_version !== options.coreVersion) {
    issues.push({
      path: "core_version",
      message: `La configuration vise le core ${config.core_version}, mais le core installé est ${options.coreVersion}`,
    });
  }
  if (openDays(config, options.now ?? new Date()).length === 0) {
    issues.push({
      path: "retrait.creneaux",
      message: `Aucun créneau de retrait dans les ${HORIZON_JOURS} prochains jours (fermetures comprises)`,
    });
  }
  if (issues.length) throw new ConfigError(issues, options.source);
  return config;
}

/** Règle alcool : un produit alcoolisé exige features.alcool. */
export function checkAlcoholFeature(
  config: ClientConfig,
  products: ReadonlyArray<{ name: string; isAlcohol: boolean }>,
): void {
  if (config.features.alcool) return;
  const offenders = products.filter((p) => p.isAlcohol).map((p) => p.name);
  if (offenders.length) {
    throw new ConfigError([
      {
        path: "features.alcool",
        message: `Produits alcoolisés au catalogue alors que l'option est désactivée : ${offenders.join(", ")}`,
      },
    ]);
  }
}
