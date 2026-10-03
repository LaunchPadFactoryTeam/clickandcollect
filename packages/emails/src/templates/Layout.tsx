import type { CSSProperties, ReactNode } from "react";
import { Body } from "@react-email/body";
import { Button } from "@react-email/button";
import { Column } from "@react-email/column";
import { Container } from "@react-email/container";
import { Head } from "@react-email/head";
import { Heading } from "@react-email/heading";
import { Html } from "@react-email/html";
import { Link } from "@react-email/link";
import { Preview } from "@react-email/preview";
import { Row } from "@react-email/row";
import { Section } from "@react-email/section";
import { Text } from "@react-email/text";
import { euros, percent, vatLines } from "../format.ts";
import type { OrderInfo, ShopInfo } from "../types.ts";

/**
 * Cadre commun : bandeau aux couleurs de la boutique (son nom en texte, pas d'image : lisible images bloquées),
 * corps sur fond blanc, pied avec l'adresse. Couleurs et fonds toujours explicites, pour que les clients en mode
 * sombre n'aient rien à deviner.
 */
export function Layout({ shop, preview, children }: { shop: ShopInfo; preview: string; children: ReactNode }) {
  const p = shop.palette;
  return (
    <Html lang="fr" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Body style={{ margin: 0, padding: "24px 0", backgroundColor: p.page, color: p.ink, fontFamily: p.fontBody }}>
        <Preview>{preview}</Preview>
        <Container style={{ maxWidth: 600, margin: "0 auto", backgroundColor: p.card }}>
          <Section style={{ backgroundColor: p.brand, padding: "22px 32px" }}>
            <Text style={{ margin: 0, fontFamily: p.fontDisplay, fontSize: 24, lineHeight: "30px", color: p.onBrand }}>
              {shop.name}
            </Text>
          </Section>
          <Section style={{ padding: "32px 32px 8px" }}>{children}</Section>
          <Section style={{ padding: "16px 32px 28px", borderTop: `1px solid ${p.line}` }}>
            <Text style={{ margin: 0, fontSize: 13, lineHeight: "20px", color: p.muted }}>
              {shop.name} · {shop.address} ·{" "}
              <Link
                href={`tel:${shop.phone.replace(/\s/g, "")}`}
                style={{ color: p.muted, textDecoration: "underline" }}
              >
                {shop.phone}
              </Link>
              <br />
              <Link href={`https://${shop.domain}`} style={{ color: p.link, textDecoration: "underline" }}>
                {shop.domain}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function Title({ shop, children }: { shop: ShopInfo; children: ReactNode }) {
  return (
    <Heading
      as="h1"
      style={{
        margin: "0 0 16px",
        fontFamily: shop.palette.fontDisplay,
        fontSize: 26,
        lineHeight: "32px",
        fontWeight: 400,
        color: shop.palette.ink,
      }}
    >
      {children}
    </Heading>
  );
}

export function Paragraph({ shop, children, style }: { shop: ShopInfo; children: ReactNode; style?: CSSProperties }) {
  return (
    <Text style={{ margin: "0 0 16px", fontSize: 16, lineHeight: "24px", color: shop.palette.ink, ...style }}>
      {children}
    </Text>
  );
}

/** Encadré d'informations clés (créneau, adresse) : libellé discret, valeur lisible. */
export function Facts({ shop, rows }: { shop: ShopInfo; rows: [string, ReactNode][] }) {
  const p = shop.palette;
  return (
    <Section
      style={{ margin: "8px 0 24px", padding: "16px 20px", border: `1px solid ${p.line}`, backgroundColor: p.card }}
    >
      {rows.map(([label, value]) => (
        <Text key={label} style={{ margin: "0 0 10px", fontSize: 15, lineHeight: "22px", color: p.ink }}>
          <span style={{ fontSize: 13, color: p.muted }}>{label}</span>
          <br />
          {value}
        </Text>
      ))}
    </Section>
  );
}

export function Action({ shop, href, children }: { shop: ShopInfo; href: string; children: ReactNode }) {
  const p = shop.palette;
  return (
    <Section style={{ margin: "8px 0 24px" }}>
      <Button
        href={href}
        style={{
          backgroundColor: p.brand,
          color: p.onBrand,
          padding: "14px 24px",
          fontSize: 15,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        {children}
      </Button>
    </Section>
  );
}

/** Lignes de la commande, puis total et TVA par taux. */
export function OrderLines({ shop, order }: { shop: ShopInfo; order: OrderInfo }) {
  const p = shop.palette;
  const cell: CSSProperties = {
    padding: "10px 0",
    borderBottom: `1px solid ${p.line}`,
    fontSize: 15,
    lineHeight: "22px",
    color: p.ink,
  };
  return (
    <Section style={{ margin: "0 0 24px" }}>
      {order.items.map((item, i) => (
        <Row key={i}>
          <Column style={cell}>
            {item.quantity} × {item.name}
            {item.format && <span style={{ color: p.muted }}> · {item.format}</span>}
          </Column>
          <Column style={{ ...cell, textAlign: "right", whiteSpace: "nowrap" }}>
            {euros(item.unitPriceCents * item.quantity)}
          </Column>
        </Row>
      ))}
      <Row>
        <Column style={{ ...cell, borderBottom: "none", fontWeight: 600 }}>Total payé</Column>
        <Column style={{ ...cell, borderBottom: "none", fontWeight: 600, textAlign: "right" }}>
          {euros(order.totalCents)}
        </Column>
      </Row>
      {vatLines(order.vatBreakdown).map((l) => (
        <Row key={l.rate}>
          <Column style={{ fontSize: 13, lineHeight: "20px", color: p.muted }}>dont TVA {percent(l.rate)}</Column>
          <Column style={{ fontSize: 13, lineHeight: "20px", color: p.muted, textAlign: "right" }}>
            {euros(l.cents)}
          </Column>
        </Row>
      ))}
      <Row>
        <Column style={{ fontSize: 13, lineHeight: "20px", color: p.muted }}>Retrait en boutique</Column>
        <Column style={{ fontSize: 13, lineHeight: "20px", color: p.muted, textAlign: "right" }}>gratuit</Column>
      </Row>
    </Section>
  );
}
