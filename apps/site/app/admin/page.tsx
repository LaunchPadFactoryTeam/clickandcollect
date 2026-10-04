import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { dayBanner, groupOrders, isOrderStatus, type StatusFilter } from "@launchpadfactoryteam/commerce";
import { AdminShell, AutoRefresh, OrdersScreen } from "@launchpadfactoryteam/ui/admin";
import { NotAuthenticatedError } from "../../lib/admin/data";
import { requireAdmin } from "../../lib/admin/session";
import { actionNotice, dateLabel, toCardView } from "../../lib/admin/views";
import { config } from "../../lib/site";

export const metadata: Metadata = { title: "Commandes" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const filter: StatusFilter = isOrderStatus(params.statut) ? params.statut : "all";
  const { api } = await requireAdmin(filter === "all" ? "/admin" : `/admin?statut=${filter}`);
  const now = new Date();
  const loaded = await Promise.all([
    api.listOrders("all", now),
    filter === "all" ? null : api.listOrders(filter, now),
  ]).catch((error: unknown) => {
    if (error instanceof NotAuthenticatedError) redirect("/admin/connexion");
    throw error;
  });
  const [current, filtered] = loaded;
  const shown = filtered ?? current;
  return (
    <AdminShell
      shopName={config.boutique.nom}
      dateLabel={dateLabel(now)}
      newCount={current.filter((o) => o.status === "new").length}
      section="orders"
    >
      <OrdersScreen
        banner={dayBanner(current, now)}
        filter={filter}
        groups={groupOrders(shown, filter, now).map((g) => ({ title: g.title, orders: g.orders.map(toCardView) }))}
        notice={actionNotice(params, (id) => shown.find((o) => o.id === id))}
      />
      <AutoRefresh />
    </AdminShell>
  );
}
