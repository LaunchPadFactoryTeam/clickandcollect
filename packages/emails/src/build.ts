import { createElement } from "react";
import { slotText } from "./format.ts";
import { renderEmail } from "./render.ts";
import { ContactMessage, MerchantNewOrder, OrderConfirmation, OrderReady, PasswordReset } from "./templates/emails.tsx";
import type { OrderInfo, OutgoingEmail, ShopInfo } from "./types.ts";

/** Chaque fonction rend un email complet : destinataires, objet, HTML et texte brut. */

export function orderConfirmationEmail(shop: ShopInfo, order: OrderInfo): OutgoingEmail {
  return {
    to: [{ email: order.email }],
    subject: `Commande n° ${order.number} confirmée · ${shop.name}`,
    tag: "order_confirmation",
    ...renderEmail(createElement(OrderConfirmation, { shop, order })),
  };
}

export function merchantNewOrderEmail(shop: ShopInfo, order: OrderInfo, to: string): OutgoingEmail {
  return {
    to: [{ email: to }],
    replyTo: { email: order.email },
    subject: `Nouvelle commande n° ${order.number} · retrait ${slotText(order.slotStart, order.slotEnd)}`,
    tag: "merchant_new_order",
    ...renderEmail(
      createElement(MerchantNewOrder, { shop, order, adminUrl: `https://${shop.domain}/admin/commandes/${order.id}` }),
    ),
  };
}

export function orderReadyEmail(shop: ShopInfo, order: OrderInfo): OutgoingEmail {
  return {
    to: [{ email: order.email }],
    subject: `Votre commande n° ${order.number} est prête · ${shop.name}`,
    tag: "order_ready",
    ...renderEmail(createElement(OrderReady, { shop, order })),
  };
}

export function passwordResetEmail(shop: ShopInfo, to: string, resetUrl: string): OutgoingEmail {
  return {
    to: [{ email: to }],
    subject: `Réinitialiser votre mot de passe · ${shop.name}`,
    tag: "password_reset",
    ...renderEmail(createElement(PasswordReset, { shop, resetUrl })),
  };
}

export function contactMessageEmail(
  shop: ShopInfo,
  to: string,
  from: { name: string; email: string },
  message: string,
): OutgoingEmail {
  return {
    to: [{ email: to }],
    replyTo: { email: from.email, name: from.name },
    subject: `Message de ${from.name} depuis ${shop.domain}`,
    tag: "contact_message",
    ...renderEmail(createElement(ContactMessage, { shop, from, message })),
  };
}
