import { Link } from "@react-email/link";
import { phoneText, slotText } from "../format.ts";
import type { OrderInfo, ShopInfo } from "../types.ts";
import { Action, Facts, Layout, OrderLines, Paragraph, Title } from "./Layout.tsx";

/** Confirmation au client, à l'enregistrement du paiement. */
export function OrderConfirmation({ shop, order }: { shop: ShopInfo; order: OrderInfo }) {
  const slot = slotText(order.slotStart, order.slotEnd);
  return (
    <Layout shop={shop} preview={`Commande n° ${order.number} confirmée : retrait ${slot}.`}>
      <Title shop={shop}>Merci, votre commande n° {order.number} est confirmée</Title>
      <Paragraph shop={shop}>
        Nous la préparons pour votre créneau de retrait. Présentez simplement votre nom ou ce numéro en boutique.
      </Paragraph>
      <Facts
        shop={shop}
        rows={[
          ["Retrait", slot],
          [
            "Adresse",
            <>
              {shop.address} ·{" "}
              <Link href={shop.mapUrl} style={{ color: shop.palette.link, textDecoration: "underline" }}>
                Voir le plan
              </Link>
            </>,
          ],
        ]}
      />
      <OrderLines shop={shop} order={order} />
      <Paragraph shop={shop} style={{ fontSize: 14, color: shop.palette.muted }}>
        Un empêchement ? Appelez-nous au {shop.phone}. Les denrées périssables ne sont pas soumises au droit de
        rétractation.
      </Paragraph>
    </Layout>
  );
}

/** Alerte au commerçant : une commande payée vient d'arriver. */
export function MerchantNewOrder({ shop, order, adminUrl }: { shop: ShopInfo; order: OrderInfo; adminUrl: string }) {
  const slot = slotText(order.slotStart, order.slotEnd);
  return (
    <Layout shop={shop} preview={`Nouvelle commande n° ${order.number}, retrait ${slot}.`}>
      <Title shop={shop}>Nouvelle commande n° {order.number}</Title>
      <Facts
        shop={shop}
        rows={[
          ["Retrait", slot],
          ["Client", [order.email, order.phone && phoneText(order.phone)].filter(Boolean).join(" · ")],
        ]}
      />
      <OrderLines shop={shop} order={order} />
      <Action shop={shop} href={adminUrl}>
        Voir la commande
      </Action>
    </Layout>
  );
}

/** Au client, au premier passage de la commande au statut « prête ». */
export function OrderReady({ shop, order }: { shop: ShopInfo; order: OrderInfo }) {
  const slot = slotText(order.slotStart, order.slotEnd);
  return (
    <Layout shop={shop} preview={`Votre commande n° ${order.number} vous attend : retrait ${slot}.`}>
      <Title shop={shop}>Votre commande n° {order.number} est prête</Title>
      <Paragraph shop={shop}>Elle vous attend en boutique pour votre créneau de retrait.</Paragraph>
      <Facts
        shop={shop}
        rows={[
          ["Retrait", slot],
          [
            "Adresse",
            <>
              {shop.address} ·{" "}
              <Link href={shop.mapUrl} style={{ color: shop.palette.link, textDecoration: "underline" }}>
                Voir le plan
              </Link>
            </>,
          ],
          [
            "Horaires d'ouverture",
            shop.openingHours.map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line}
              </span>
            )),
          ],
        ]}
      />
      <Paragraph shop={shop} style={{ fontSize: 14, color: shop.palette.muted }}>
        Un empêchement ? Appelez-nous au {shop.phone}.
      </Paragraph>
    </Layout>
  );
}

/** Au commerçant qui a demandé à réinitialiser son mot de passe du back-office. */
export function PasswordReset({ shop, resetUrl }: { shop: ShopInfo; resetUrl: string }) {
  return (
    <Layout shop={shop} preview="Lien pour choisir un nouveau mot de passe, valable une heure.">
      <Title shop={shop}>Réinitialiser votre mot de passe</Title>
      <Paragraph shop={shop}>
        Vous avez demandé à changer le mot de passe de l'espace commerçant de {shop.name}. Ce lien est valable une heure
        et ne sert qu'une fois.
      </Paragraph>
      <Action shop={shop} href={resetUrl}>
        Choisir un nouveau mot de passe
      </Action>
      <Paragraph shop={shop} style={{ fontSize: 14, color: shop.palette.muted }}>
        Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.
      </Paragraph>
    </Layout>
  );
}

/** Message envoyé depuis le formulaire de contact du site, au commerçant (répondre écrit au client). */
export function ContactMessage({
  shop,
  from,
  message,
}: {
  shop: ShopInfo;
  from: { name: string; email: string };
  message: string;
}) {
  return (
    <Layout shop={shop} preview={`Message de ${from.name} depuis le site.`}>
      <Title shop={shop}>Message de {from.name}</Title>
      <Facts shop={shop} rows={[["De", `${from.name} · ${from.email}`]]} />
      {message.split(/\n{2,}/).map((para, i) => (
        <Paragraph key={i} shop={shop} style={{ whiteSpace: "pre-line" }}>
          {para}
        </Paragraph>
      ))}
      <Paragraph shop={shop} style={{ fontSize: 14, color: shop.palette.muted }}>
        Répondez directement à cet email pour écrire à {from.name}.
      </Paragraph>
    </Layout>
  );
}
