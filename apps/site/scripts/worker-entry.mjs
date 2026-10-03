#!/usr/bin/env node
// Écrit .open-next/lp-worker.js : le Worker d'OpenNext, augmenté de la tâche planifiée qui rejoue la file d'envoi
// des emails toutes les 5 minutes (déclencheur « crons » de wrangler.jsonc). Lancé après opennextjs-cloudflare build.
// Usage : node scripts/worker-entry.mjs [dossier .open-next]
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const WORKER_ENTRY = `// Généré par @launchpadfactoryteam/site (scripts/worker-entry.mjs) — ne pas modifier.
import handler from "./worker.js";
export * from "./worker.js";

export default {
  fetch: handler.fetch,
  /** Toutes les 5 minutes : rejeu des emails en attente, par le Worker lui-même (liaison WORKER_SELF_REFERENCE). */
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      env.WORKER_SELF_REFERENCE.fetch("https://worker.internal/api/emails/outbox", {
        method: "POST",
        headers: { "x-lp-cron-secret": env.CRON_SECRET ?? "" },
      }).then(async (res) => {
        if (!res.ok) console.error(JSON.stringify({ level: "error", message: "Rejeu des emails en échec", status: res.status }));
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
