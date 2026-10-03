import { contactMessageEmail, type OutgoingEmail, type ShopInfo } from "@launchpadfactoryteam/emails";

export type ContactResult = { status: 303; location: string } | { status: 400 | 502 | 503; message: string };

export interface ContactDeps {
  shop: ShopInfo;
  /** Adresse publique de la boutique, qui reçoit les messages. */
  to: string;
  send: ((email: OutgoingEmail) => Promise<{ messageId: string }>) | null;
  log: (messageId: string | null, status: "sent" | "failed") => Promise<void>;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

/**
 * POST /api/contact, depuis le formulaire HTML (sans JavaScript). Le message part au commerçant, avec l'adresse du
 * client en « répondre à ». Succès : redirection vers /contact/merci. Un robot qui remplit le champ piège est
 * redirigé de la même façon, sans envoi.
 */
export async function handleContact(form: FormData, deps: ContactDeps): Promise<ContactResult> {
  if (field(form, "site_web")) return { status: 303, location: "/contact/merci" };
  const name = field(form, "nom");
  const email = field(form, "email");
  const message = field(form, "message");
  if (
    !name ||
    name.length > 120 ||
    !EMAIL.test(email) ||
    !message ||
    message.length > 5000 ||
    form.get("consentement") !== "oui"
  ) {
    return {
      status: 400,
      message:
        "Merci de renseigner votre nom, un email valide, votre message, et d'accepter le traitement de vos données.",
    };
  }
  const fallback = `En attendant, appelez ${deps.shop.name} au ${deps.shop.phone}.`;
  if (!deps.send)
    return { status: 503, message: `L'envoi de messages depuis le site n'est pas encore ouvert. ${fallback}` };
  try {
    const { messageId } = await deps.send(contactMessageEmail(deps.shop, deps.to, { name, email }, message));
    await deps.log(messageId, "sent").catch(() => {});
    return { status: 303, location: "/contact/merci" };
  } catch {
    await deps.log(null, "failed").catch(() => {});
    return { status: 502, message: `Votre message n'a pas pu partir. ${fallback}` };
  }
}
