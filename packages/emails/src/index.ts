/** @launchpadfactoryteam/emails — gabarits React Email aux couleurs de la boutique, client Brevo, file d'envoi (lot 6). */
export {
  contactMessageEmail,
  merchantNewOrderEmail,
  orderConfirmationEmail,
  orderReadyEmail,
  passwordResetEmail,
} from "./build.ts";
export { euros, percent, slotText, vatLines } from "./format.ts";
export { BrevoMailer, FakeMailer, MailError, type BrevoOptions, type Mailer } from "./mailer.ts";
export {
  MAX_ATTEMPTS,
  processOutbox,
  RETRY_MINUTES,
  type EmailEventKind,
  type OutboxDeps,
  type OutboxReport,
  type OutboxRow,
} from "./outbox.ts";
export { contrast, emailPalette, MIN_CONTRAST, type EmailPalette } from "./palette.ts";
export { htmlToText, renderEmail } from "./render.ts";
export type { OrderInfo, OutgoingEmail, ShopInfo } from "./types.ts";
