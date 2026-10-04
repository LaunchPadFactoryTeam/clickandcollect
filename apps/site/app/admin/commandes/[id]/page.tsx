import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell, ErrorScreen, OrderDetailScreen } from "@launchpadfactoryteam/ui/admin";
import { NotAuthenticatedError } from "../../../../lib/admin/data";
import { requireAdmin } from "../../../../lib/admin/session";
import { actionNotice, dateLabel, toDetailView } from "../../../../lib/admin/views";
import { config } from "../../../../lib/site";

export const metadata: Metadata = { title: "Commande" };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { api } = await requireAdmin(`/admin/commandes/${id}`);
  const now = new Date();
  const [order, current] = await Promise.all([api.getOrder(id), api.listOrders("all", now)]).catch((error: unknown) => {
    if (error instanceof NotAuthenticatedError) redirect("/admin/connexion");
    throw error;
  });
  return (
    <AdminShell
      shopName={config.boutique.nom}
      dateLabel={dateLabel(now)}
      newCount={current.filter((o) => o.status === "new").length}
      section="orders"
    >
      {order ? (
        <OrderDetailScreen
          {...toDetailView(order, now)}
          notice={actionNotice(query, (oid) => (oid === order.id ? order : undefined))}
        />
      ) : (
        <ErrorScreen
          title="Commande introuvable"
          text="Cette commande n'existe pas ou n'appartient pas à votre boutique."
        />
      )}
    </AdminShell>
  );
}
