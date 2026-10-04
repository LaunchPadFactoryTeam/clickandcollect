import { describe, expect, it } from "vitest";
import {
  canTransition,
  dayBanner,
  groupOrders,
  nextActionLabel,
  nextStatus,
  pendingChanges,
  slotTitle,
  type BackOfficeOrder,
} from "../src/index.ts";

/** Les 6 commandes de la maquette du back-office, vues le jeudi 2 octobre 2026 à 12:00 (Paris). */
const NOW = new Date("2026-10-02T10:00:00Z");
const TODAY = ["2026-10-02T14:00:00Z", "2026-10-02T17:00:00Z"] as const;
const TOMORROW = ["2026-10-03T08:00:00Z", "2026-10-03T10:00:00Z"] as const;
const YESTERDAY = ["2026-10-01T14:00:00Z", "2026-10-01T17:00:00Z"] as const;
const order = (
  number: number,
  status: BackOfficeOrder["status"],
  slot: readonly [string, string],
  totalCents: number,
) => ({
  id: `o${number}`,
  number,
  status,
  slotStart: slot[0],
  slotEnd: slot[1],
  totalCents,
});
const MOCKUP: BackOfficeOrder[] = [
  order(2471, "new", TODAY, 4470),
  order(2470, "preparing", TODAY, 5040),
  order(2469, "ready", TODAY, 4170),
  order(2468, "new", TOMORROW, 3210),
  order(2467, "new", TOMORROW, 2240),
  order(2466, "collected", YESTERDAY, 1800),
];

describe("transitions de statut", () => {
  it("T7.1 new → preparing : acceptée", () => {
    expect(canTransition("new", "preparing")).toBe(true);
    expect(nextStatus("new")).toBe("preparing");
  });

  it("T7.2 collected → suivant : refusée, aucun bouton d'avancement", () => {
    expect(nextStatus("collected")).toBeNull();
    expect(nextActionLabel("collected")).toBeNull();
  });

  it("T7.3 ready → preparing (retour) : acceptée", () => {
    expect(canTransition("ready", "preparing")).toBe(true);
  });

  it("T7.4 new → collected (saut de 3 crans) : refusée, comme tout saut ou statut inchangé", () => {
    expect(canTransition("new", "collected")).toBe(false);
    expect(canTransition("new", "ready")).toBe(false);
    expect(canTransition("ready", "ready")).toBe(false);
  });

  it("T7.5 libellés d'action", () => {
    expect(nextActionLabel("new")).toBe("Mettre en préparation");
    expect(nextActionLabel("preparing")).toBe("Marquer prête");
    expect(nextActionLabel("ready")).toBe("Marquer retirée");
  });
});

describe("liste des commandes", () => {
  it("T7.6 regroupement : Aujourd'hui 16:00 – 19:00 (3) puis Demain 10:00 – 12:00 (2) ; la commande retirée d'hier seulement sous « Retirée »", () => {
    const groups = groupOrders(MOCKUP, "all", NOW);
    expect(groups.map((g) => [g.title, g.orders.map((o) => o.number)])).toEqual([
      ["Aujourd'hui · 16:00 – 19:00", [2471, 2470, 2469]],
      ["Demain · 10:00 – 12:00", [2468, 2467]],
    ]);
    expect(groupOrders(MOCKUP, "collected", NOW)).toEqual([{ title: "Hier · 16:00 – 19:00", orders: [MOCKUP[5]] }]);
    expect(groupOrders(MOCKUP, "new", NOW).flatMap((g) => g.orders.map((o) => o.number))).toEqual([2471, 2468, 2467]);
  });

  it("une commande retirée aujourd'hui reste dans la liste du jour ; les retirées les plus récentes d'abord", () => {
    const collectedToday = order(2472, "collected", TODAY, 1000);
    expect(groupOrders([...MOCKUP, collectedToday], "all", NOW)[0]!.orders.map((o) => o.number)).toContain(2472);
    expect(groupOrders([...MOCKUP, collectedToday], "collected", NOW).map((g) => g.title)).toEqual([
      "Aujourd'hui · 16:00 – 19:00",
      "Hier · 16:00 – 19:00",
    ]);
  });

  it("T7.7 bandeau du jour : 3 commandes, total encaissé, 3 au prochain créneau", () => {
    expect(dayBanner(MOCKUP, NOW)).toEqual({ count: 3, totalCents: 4470 + 5040 + 4170, nextSlotCount: 3 });
    // Après la fin du dernier créneau du jour, plus rien à remettre aujourd'hui.
    expect(dayBanner(MOCKUP, new Date("2026-10-02T17:30:00Z")).nextSlotCount).toBe(0);
  });

  it("créneaux au-delà de demain : jour de la semaine en toutes lettres, heure de Paris (heure d'hiver comprise)", () => {
    expect(slotTitle("2026-10-09T08:00:00Z", "2026-10-09T10:00:00Z", NOW)).toBe("Vendredi 9 octobre · 10:00 – 12:00");
    expect(slotTitle("2026-11-03T09:00:00Z", "2026-11-03T11:00:00Z", NOW)).toBe("Mardi 3 novembre · 10:00 – 12:00");
  });
});

describe("disponibilité", () => {
  it("T7.9 2 interrupteurs modifiés, non enregistrés : « 2 modifications »", () => {
    const saved = { tomme: true, miel: true, terrine: false };
    expect(pendingChanges(saved, { tomme: false, miel: true, terrine: true })).toEqual(["tomme", "terrine"]);
    expect(pendingChanges(saved, { ...saved })).toEqual([]);
    // Produit jamais enregistré : en vente par défaut.
    expect(pendingChanges({}, { nouveau: true })).toEqual([]);
  });
});
