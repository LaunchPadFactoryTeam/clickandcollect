import { TIME_ZONE } from "./slots.ts";

/** Statuts d'une commande, dans l'ordre du comptoir. */
export type OrderStatus = "new" | "preparing" | "ready" | "collected";
export const ORDER_STEPS: readonly OrderStatus[] = ["new", "preparing", "ready", "collected"];

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Nouvelle",
  preparing: "En préparation",
  ready: "Prête",
  collected: "Retirée",
};

const NEXT_ACTIONS: Record<OrderStatus, string | null> = {
  new: "Mettre en préparation",
  preparing: "Marquer prête",
  ready: "Marquer retirée",
  collected: null,
};

/** Statut suivant, ou null pour une commande retirée. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  return ORDER_STEPS[ORDER_STEPS.indexOf(status) + 1] ?? null;
}

/** Libellé du bouton d'avancement, ou null s'il n'y en a pas. */
export const nextActionLabel = (status: OrderStatus) => NEXT_ACTIONS[status];

/** Un cran à la fois : en avant, ou un retour d'un cran depuis le détail. La base applique la même règle. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return Math.abs(ORDER_STEPS.indexOf(to) - ORDER_STEPS.indexOf(from)) === 1;
}

export const isOrderStatus = (value: unknown): value is OrderStatus => ORDER_STEPS.includes(value as OrderStatus);

/** Commande telle qu'affichée dans la liste du back-office. */
export interface BackOfficeOrder {
  id: string;
  number: number;
  status: OrderStatus;
  slotStart: string;
  slotEnd: string;
  totalCents: number;
}

export type StatusFilter = "all" | OrderStatus;

export interface OrderGroup<T extends BackOfficeOrder> {
  /** « Aujourd'hui · 16:00 – 19:00 ». */
  title: string;
  orders: T[];
}

const dateKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const hourMinute = new Intl.DateTimeFormat("fr-FR", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const longDay = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Date de Paris (AAAA-MM-JJ) d'un instant. */
export const parisDate = (t: Date | string) => dateKey.format(new Date(t));

/** Nombre de jours entre deux dates de Paris (AAAA-MM-JJ). */
const dayDiff = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/** « Aujourd'hui », « Demain », « Hier », sinon « Jeudi 9 octobre ». */
export function relativeDay(t: Date | string, now: Date): string {
  const diff = dayDiff(parisDate(now), parisDate(t));
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  const label = longDay.format(new Date(t));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** « Aujourd'hui · 16:00 – 19:00 ». */
export function slotTitle(start: string, end: string, now: Date): string {
  return `${relativeDay(start, now)} · ${hourMinute.format(new Date(start))} – ${hourMinute.format(new Date(end))}`;
}

/**
 * Liste du back-office : du créneau le plus proche au plus lointain, groupée par jour et créneau, la commande la plus
 * récente en tête de son créneau (comme la maquette).
 * Sans filtre, les commandes retirées des jours passés sont masquées ; le filtre « Retirée » les montre, les plus
 * récentes en premier.
 */
export function groupOrders<T extends BackOfficeOrder>(
  orders: readonly T[],
  filter: StatusFilter,
  now: Date,
): OrderGroup<T>[] {
  const today = parisDate(now);
  const kept = orders.filter((o) =>
    filter === "all" ? o.status !== "collected" || parisDate(o.slotStart) >= today : o.status === filter,
  );
  const direction = filter === "collected" ? -1 : 1;
  const sorted = [...kept].sort(
    (a, b) => direction * (Date.parse(a.slotStart) - Date.parse(b.slotStart)) || b.number - a.number,
  );
  const groups: OrderGroup<T>[] = [];
  for (const order of sorted) {
    const title = slotTitle(order.slotStart, order.slotEnd, now);
    const last = groups.at(-1);
    if (last?.title === title) last.orders.push(order);
    else groups.push({ title, orders: [order] });
  }
  return groups;
}

export interface DayBanner {
  /** Commandes dont le créneau est aujourd'hui. */
  count: number;
  /** Total payé de ces commandes, en centimes. */
  totalCents: number;
  /** Commandes à remettre au prochain créneau du jour (en cours ou à venir), hors commandes retirées. */
  nextSlotCount: number;
}

/** Bandeau du jour, à l'heure de Paris. */
export function dayBanner(orders: readonly BackOfficeOrder[], now: Date): DayBanner {
  const today = parisDate(now);
  const todays = orders.filter((o) => parisDate(o.slotStart) === today);
  const upcoming = todays
    .filter((o) => o.status !== "collected" && Date.parse(o.slotEnd) > now.getTime())
    .sort((a, b) => Date.parse(a.slotStart) - Date.parse(b.slotStart));
  const next = upcoming[0];
  return {
    count: todays.length,
    totalCents: todays.reduce((sum, o) => sum + o.totalCents, 0),
    nextSlotCount: next
      ? upcoming.filter((o) => o.slotStart === next.slotStart && o.slotEnd === next.slotEnd).length
      : 0,
  };
}

/** Compteur « 2 modifications » de la page Disponibilité : produits dont l'état diffère de l'état enregistré. */
export function pendingChanges(
  saved: Readonly<Record<string, boolean>>,
  current: Readonly<Record<string, boolean>>,
): string[] {
  return Object.keys(current).filter((id) => current[id] !== (saved[id] ?? true));
}
