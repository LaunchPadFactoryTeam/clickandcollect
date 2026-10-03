import type { OutgoingEmail } from "./types.ts";

/**
 * File d'envoi (table email_outbox). Les emails y sont écrits dans la transaction qui les motive (paiement,
 * passage à « prête ») ; ce traitement les envoie juste après, puis toutes les 5 minutes pour les échecs.
 * Au 5e échec, l'email est abandonné et une alerte part vers l'équipe.
 */

export const MAX_ATTEMPTS = 5;
export const RETRY_MINUTES = 5;

export interface OutboxRow {
  id: number;
  kind: string;
  payload: Record<string, unknown>;
  attempts: number;
}

export type EmailEventKind =
  "order_confirmation" | "merchant_new_order" | "order_ready" | "password_reset" | "contact_message";

export interface OutboxDeps {
  /** Réserve les emails dus (bail de quelques minutes) : deux traitements simultanés n'envoient pas deux fois. */
  claim(limit: number): Promise<OutboxRow[]>;
  /** Compose l'email d'une ligne ; null s'il n'a plus lieu d'être (commande anonymisée, par exemple). */
  compose(row: OutboxRow): Promise<OutgoingEmail | null>;
  send(email: OutgoingEmail): Promise<{ messageId: string }>;
  markSent(row: OutboxRow, at: Date): Promise<void>;
  markRetry(row: OutboxRow, attempts: number, nextAttemptAt: Date, error: string): Promise<void>;
  markFailed(row: OutboxRow, attempts: number, at: Date, error: string): Promise<void>;
  logEvent(event: {
    kind: string;
    orderId: string | null;
    messageId: string | null;
    status: "sent" | "failed";
  }): Promise<void>;
  alert(message: string, details: Record<string, unknown>): Promise<void>;
  now(): Date;
}

export interface OutboxReport {
  sent: number;
  retried: number;
  failed: number;
}

const orderIdOf = (row: OutboxRow) => (typeof row.payload.order_id === "string" ? row.payload.order_id : null);

export async function processOutbox(deps: OutboxDeps, limit = 20): Promise<OutboxReport> {
  const report: OutboxReport = { sent: 0, retried: 0, failed: 0 };
  for (const row of await deps.claim(limit)) {
    try {
      const email = await deps.compose(row);
      if (!email) {
        await deps.markFailed(row, row.attempts, deps.now(), "Email sans objet (données effacées)");
        report.failed++;
        continue;
      }
      const { messageId } = await deps.send(email);
      await deps.markSent(row, deps.now());
      await deps.logEvent({ kind: row.kind, orderId: orderIdOf(row), messageId, status: "sent" });
      report.sent++;
    } catch (error) {
      const attempts = row.attempts + 1;
      const message = error instanceof Error ? error.message : String(error);
      if (attempts >= MAX_ATTEMPTS) {
        await deps.markFailed(row, attempts, deps.now(), message);
        await deps.logEvent({ kind: row.kind, orderId: orderIdOf(row), messageId: null, status: "failed" });
        await deps.alert("Email abandonné après 5 essais", {
          outboxId: row.id,
          kind: row.kind,
          orderId: orderIdOf(row),
          error: message,
        });
        report.failed++;
      } else {
        await deps.markRetry(row, attempts, new Date(deps.now().getTime() + RETRY_MINUTES * 60_000), message);
        report.retried++;
      }
    }
  }
  return report;
}
