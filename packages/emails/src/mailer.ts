import type { OutgoingEmail } from "./types.ts";

/** Envoi d'un email ; renvoie l'identifiant du message chez le prestataire. */
export interface Mailer {
  readonly name: "brevo" | "fake";
  send(email: OutgoingEmail): Promise<{ messageId: string }>;
}

export class MailError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "MailError";
  }
}

export interface BrevoOptions {
  apiKey: string;
  /** Expéditeur : une adresse du domaine authentifié (SPF, DKIM) de la boutique. */
  sender: { email: string; name: string };
  fetch?: typeof fetch;
}

/** API transactionnelle Brevo (POST /v3/smtp/email). */
export class BrevoMailer implements Mailer {
  readonly name = "brevo" as const;
  private readonly fetch: typeof fetch;

  constructor(private readonly opts: BrevoOptions) {
    this.fetch = opts.fetch ?? fetch.bind(globalThis);
  }

  async send(email: OutgoingEmail): Promise<{ messageId: string }> {
    const res = await this.fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": this.opts.apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: this.opts.sender,
        to: email.to,
        replyTo: email.replyTo,
        subject: email.subject,
        htmlContent: email.html,
        textContent: email.text,
        tags: [email.tag],
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string };
    if (!res.ok || !body.messageId)
      throw new MailError(`Brevo a répondu ${res.status} : ${body.message ?? "sans détail"}`, res.status);
    return { messageId: body.messageId };
  }
}

/** Faux prestataire (tests, démonstration) : garde les emails en mémoire, ne les envoie pas. */
export class FakeMailer implements Mailer {
  readonly name = "fake" as const;
  readonly sent: (OutgoingEmail & { messageId: string })[] = [];

  async send(email: OutgoingEmail): Promise<{ messageId: string }> {
    const messageId = `<fake-${crypto.randomUUID()}@launchpad.test>`;
    this.sent.push({ ...email, messageId });
    return { messageId };
  }
}
