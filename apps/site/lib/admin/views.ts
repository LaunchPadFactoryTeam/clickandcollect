import { relativeDay, STATUS_LABELS, TIME_ZONE, type OrderStatus } from "@launchpadfactoryteam/commerce";
import type { OrderCardView, OrderDetailView } from "@launchpadfactoryteam/ui/admin";
import type { AdminOrder, AdminOrderDetail } from "./data";

/** Mise en forme des données du back-office pour les écrans. */

const time = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const paidDay = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, day: "numeric", month: "short" });
const today = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });

/** « Jeudi 2 octobre ». */
export function dateLabel(now: Date): string {
  const s = today.format(now);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const clientLabel = (o: { customerName: string | null; email: string | null; number: number }) =>
  o.customerName || o.email || `Commande #${o.number}`;

export function toCardView(o: AdminOrder): OrderCardView {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    client: clientLabel(o),
    itemCount: o.itemCount,
    totalCents: o.totalCents,
  };
}

export function toDetailView(o: AdminOrderDetail, now: Date): OrderDetailView {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    client: clientLabel(o),
    slotLabel: `${relativeDay(o.slotStart, now)} ${time.format(new Date(o.slotStart))} – ${time.format(new Date(o.slotEnd))}`,
    paidLabel: `${paidDay.format(new Date(o.paidAt))} à ${time.format(new Date(o.paidAt))}`,
    email: o.email,
    phone: o.phone,
    lines: o.lines.map((l) => ({
      name: l.name,
      format: l.format,
      quantity: l.quantity,
      totalCents: l.unitPriceCents * l.quantity,
    })),
    vat: Object.entries(o.vatBreakdown)
      .map(([rate, cents]) => ({ rate: Number(rate), cents }))
      .sort((a, b) => a.rate - b.rate),
    totalCents: o.totalCents,
  };
}

/** Message affiché après une action (paramètres de l'adresse de retour). */
export function actionNotice(
  params: { maj?: string; erreur?: string },
  findOrder: (id: string) => { number: number; status: OrderStatus } | undefined,
): { tone: "error" | "info"; text: string } | undefined {
  if (params.erreur === "statut") return { tone: "error", text: "Ce changement de statut n'est pas possible." };
  if (params.erreur === "concurrence")
    return { tone: "error", text: "Cette commande a été modifiée entre-temps : voici son état à jour." };
  const order = params.maj ? findOrder(params.maj) : undefined;
  if (order) return { tone: "info", text: `Commande #${order.number} : ${STATUS_LABELS[order.status]}.` };
  return undefined;
}
