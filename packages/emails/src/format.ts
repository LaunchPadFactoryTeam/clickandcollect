const TZ = "Europe/Paris";
const day = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const time = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/** 1250 → « 12,50 € » (espace insécable). */
export const euros = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")}\u00a0€`;

/** 5.5 → « 5,5 % ». */
export const percent = (rate: number) => `${String(rate).replace(".", ",")}\u00a0%`;

/** « +33612345678 » → « 06 12 34 56 78 » ; un numéro étranger reste tel quel. */
export function phoneText(phone: string): string {
  const national = phone.replace(/[\s.-]/g, "").replace(/^\+33/, "0");
  return /^0\d{9}$/.test(national) ? national.replace(/(\d\d)(?=\d)/g, "$1 ") : phone;
}

/** « mardi 6 octobre, entre 16:00 et 19:00 », à l'heure de Paris. */
export function slotText(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  return `${day.format(start)}, entre ${time.format(start)} et ${time.format(new Date(endIso))}`;
}

/** Lignes de TVA du plus petit taux au plus grand (un objet range « 20 » avant « 5.5 »). */
export const vatLines = (breakdown: Record<string, number>) =>
  Object.entries(breakdown)
    .map(([rate, cents]) => ({ rate: Number(rate), cents }))
    .sort((a, b) => a.rate - b.rate);
