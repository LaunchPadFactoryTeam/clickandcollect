import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Lance une tâche après la réponse (envoi des emails après un paiement) : le Worker la mène à terme grâce à
 * waitUntil, sans faire attendre l'appelant. Hors Worker (tests), la tâche tourne simplement en arrière-plan.
 */
export function inBackground(task: () => Promise<unknown>) {
  const run = task().catch((error) =>
    console.error(JSON.stringify({ level: "error", message: "Tâche en arrière-plan échouée", error: String(error) })),
  );
  try {
    getCloudflareContext().ctx.waitUntil(run);
  } catch {
    // Pas de contexte Cloudflare : rien à prolonger.
  }
  return run;
}
