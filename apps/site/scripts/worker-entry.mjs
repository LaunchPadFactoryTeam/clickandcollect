#!/usr/bin/env node
// Écrit .open-next/lp-worker.js : le Worker d'OpenNext, augmenté de la tâche planifiée qui rejoue la file d'envoi
// des emails toutes les 5 minutes et applique les durées de conservation chaque mois (déclencheurs « crons » de
// wrangler.jsonc). Lancé après opennextjs-cloudflare build.
// Usage : node scripts/worker-entry.mjs [dossier .open-next]
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Déclencheur mensuel (wrangler.jsonc) : durées de conservation des données personnelles, le 1er à 3 h UTC. */
export const RETENTION_CRON = "0 3 1 * *";

export const WORKER_ENTRY = `// Généré par @launchpadfactoryteam/site (scripts/worker-entry.mjs) — ne pas modifier.
import handler from "./worker.js";
export * from "./worker.js";

/** Tâches planifiées, appelées par le Worker lui-même (liaison WORKER_SELF_REFERENCE) avec le secret CRON_SECRET. */
const TASKS = {
  "${RETENTION_CRON}": { path: "/api/rgpd/conservation", label: "Conservation des données" },
};
const DEFAULT_TASK = { path: "/api/emails/outbox", label: "Rejeu des emails" };

export default {
  fetch: handler.fetch,
  /** Toutes les 5 minutes : rejeu des emails en attente ; le 1er du mois : durées de conservation. */
  async scheduled(controller, env, ctx) {
    const task = TASKS[controller.cron] ?? DEFAULT_TASK;
    ctx.waitUntil(
      env.WORKER_SELF_REFERENCE.fetch("https://worker.internal" + task.path, {
        method: "POST",
        headers: { "x-lp-cron-secret": env.CRON_SECRET ?? "" },
      }).then(async (res) => {
        if (!res.ok) console.error(JSON.stringify({ level: "error", message: task.label + " en échec", status: res.status }));
      }),
    );
  },
};
`;

export function writeWorkerEntry(dir) {
  if (!existsSync(join(dir, "worker.js")))
    throw new Error(`Worker OpenNext introuvable dans ${dir} : lancer d'abord le build`);
  writeFileSync(join(dir, "lp-worker.js"), WORKER_ENTRY);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = resolve(process.argv[2] ?? ".open-next");
  writeWorkerEntry(dir);
  console.log(`Point d'entrée du Worker écrit : ${join(dir, "lp-worker.js")}`);
}
