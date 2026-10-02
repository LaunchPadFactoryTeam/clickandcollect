import { env } from "../../../lib/env";
import { findOrderBySession, hasDatabase } from "../../../lib/orders";

export const dynamic = "force-dynamic";

/**
 * Page de confirmation : la commande existe-t-elle déjà pour cette session de paiement ?
 * Tant que le webhook n'est pas arrivé, « pending ». L'identifiant de session, imprévisible, sert de clé d'accès.
 */
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  const e = env();
  const noStore = { headers: { "Cache-Control": "no-store" } };
  if (!sessionId || !/^cs_[\w-]+$/.test(sessionId))
    return Response.json({ error: "session_id attendu" }, { status: 400, ...noStore });
  if (!hasDatabase(e)) return Response.json({ status: "pending" }, noStore);
  const order = await findOrderBySession(e, sessionId);
  if (!order) return Response.json({ status: "pending" }, noStore);
  return Response.json(
    {
      status: "paid",
      number: order.number,
      slotStart: order.slot_start,
      slotEnd: order.slot_end,
      totalCents: order.total_cents,
    },
    noStore,
  );
}
