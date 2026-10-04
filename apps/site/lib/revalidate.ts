import { timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";

/** Vérifie le secret partagé envoyé par le webhook Sanity ou la tâche planifiée (en-tête x-lp-revalidate-secret ou x-lp-cron-secret). */
export function isAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Relit le catalogue (contenus et disponibilités) : les pages sont régénérées à la requête suivante. */
export async function revalidateCatalogue() {
  revalidateTag("catalogue", "max");
  revalidatePath("/", "layout");
}
