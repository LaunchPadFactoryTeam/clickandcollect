import type { ClientConfig } from "@launchpadfactoryteam/config";

export type PickupConfig = ClientConfig["retrait"];

export const TIME_ZONE = "Europe/Paris";
/** Horizon de réservation : aujourd'hui et les 13 jours suivants. */
export const HORIZON_DAYS = 14;
/** L'heure « à partir de » est arrondie au quart d'heure supérieur. */
const ROUND_MINUTES = 15;

/** Dans l'ordre de Date.getUTCDay() : 0 = dimanche. */
const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;

export interface PickupSlot {
  /** Identifiant stable, ex. "2026-10-06T16:00" (date et heure de Paris). */
  id: string;
  /** Date de Paris, AAAA-MM-JJ. */
  date: string;
  start: string;
  end: string;
  /** Début et fin en UTC (ISO 8601), tels qu'enregistrés en base. */
  startsAt: string;
  endsAt: string;
  /** « Aujourd'hui », « Demain » ou « Samedi 10 octobre ». */
  dayLabel: string;
  /** « Aujourd'hui · 16:00 – 19:00 ». */
  label: string;
  /** Créneau entamé : heure de retrait au plus tôt, « à partir de 17:30 ». */
  note?: string;
}

const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Composantes de l'heure de Paris pour un instant donné. */
function parisParts(t: number) {
  const p = Object.fromEntries(parts.formatToParts(t).map((x) => [x.type, x.value]));
  return { y: +p.year!, m: +p.month!, d: +p.day!, h: +p.hour!, mi: +p.minute!, s: +p.second! };
}

/** Décalage de Paris par rapport à UTC à l'instant t, en millisecondes (+1 h l'hiver, +2 h l'été). */
function offsetAt(t: number): number {
  const p = parisParts(t);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(t / 1000) * 1000;
}

/** Instant UTC correspondant à une date et une heure de Paris. */
export function parisToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [h, mi] = time.split(":").map(Number) as [number, number];
  const wall = Date.UTC(y, m - 1, d, h, mi);
  const first = wall - offsetAt(wall);
  // Second passage : l'heure de Paris visée peut tomber de l'autre côté d'un changement d'heure.
  return new Date(wall - offsetAt(first));
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (t: number) => {
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
};

const longDate = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

function dayLabel(offset: number, calendarDay: number): string {
  if (offset === 0) return "Aujourd'hui";
  if (offset === 1) return "Demain";
  const s = longDate.format(calendarDay);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function roundUp(t: number): number {
  const step = ROUND_MINUTES * 60_000;
  return Math.ceil(t / step) * step;
}

/**
 * Créneaux de retrait proposés à l'instant `now` : créneaux hebdomadaires dépliés sur 14 jours, jours de fermeture
 * retirés, créneaux dont la fin tombe avant maintenant + délai de préparation retirés, créneau entamé signalé
 * « à partir de HH:MM ». Fonction pure : le serveur l'appelle à nouveau pour revalider le choix du client.
 */
export function computeSlots(config: PickupConfig, now: Date): PickupSlot[] {
  const earliest = now.getTime() + config.delai_preparation_heures * 3_600_000;
  const today = parisParts(now.getTime());
  const closed = new Set(config.fermetures);
  const slots: PickupSlot[] = [];

  for (let offset = 0; offset < HORIZON_DAYS; offset++) {
    const calendarDay = Date.UTC(today.y, today.m - 1, today.d + offset);
    const date = ymd(calendarDay);
    if (closed.has(date)) continue;
    const ranges = config.creneaux[WEEKDAYS[new Date(calendarDay).getUTCDay()]!] ?? [];
    for (const range of ranges) {
      const [start, end] = range.split("-") as [string, string];
      const startsAt = parisToUtc(date, start);
      const endsAt = parisToUtc(date, end);
      if (endsAt.getTime() <= earliest) continue;
      const day = dayLabel(offset, calendarDay);
      const slot: PickupSlot = {
        id: `${date}T${start}`,
        date,
        start,
        end,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        dayLabel: day,
        label: `${day} · ${start} – ${end}`,
      };
      if (startsAt.getTime() < earliest) {
        const from = parisParts(roundUp(earliest));
        // Un arrondi qui atteint la fin du créneau ne laisse plus le temps de passer : créneau retiré.
        if (roundUp(earliest) >= endsAt.getTime()) continue;
        slot.note = `à partir de ${pad(from.h)}:${pad(from.mi)}`;
      }
      slots.push(slot);
    }
  }
  return slots;
}

/** Le créneau choisi est-il encore proposé ? Utilisé par le serveur à la création de la session de paiement. */
export function findSlot(config: PickupConfig, slotId: string, now: Date): PickupSlot | undefined {
  return computeSlots(config, now).find((s) => s.id === slotId);
}
