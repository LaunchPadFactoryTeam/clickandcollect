import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell, AvailabilityForm } from "@launchpadfactoryteam/ui/admin";
import { NotAuthenticatedError } from "../../../lib/admin/data";
import { requireAdmin } from "../../../lib/admin/session";
import { dateLabel } from "../../../lib/admin/views";
import { config, defaultAvailability, getContent } from "../../../lib/site";

export const metadata: Metadata = { title: "Disponibilité" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { enregistre } = await searchParams;
  const { api } = await requireAdmin("/admin/produits");
  const now = new Date();
  const [saved, current, content] = await Promise.all([
    api.availability(),
    api.listOrders("all", now),
    getContent(),
  ]).catch((error: unknown) => {
    if (error instanceof NotAuthenticatedError) redirect("/admin/connexion");
    throw error;
  });
  const state = { ...defaultAvailability(), ...saved };
  const products = content.catalog.map((p) => ({
    id: p.id,
    name: p.name,
    format: p.format,
    priceCents: p.priceTtcCents,
    imageUrl: p.images?.[0]?.url,
    available: state[p.id] ?? true,
  }));
  return (
    <AdminShell
      shopName={config.boutique.nom}
      dateLabel={dateLabel(now)}
      newCount={current.filter((o) => o.status === "new").length}
      section="products"
    >
      <AvailabilityForm
        key={JSON.stringify(state)}
        products={products}
        savedCount={enregistre === undefined ? undefined : Number(enregistre) || 0}
      />
    </AdminShell>
  );
}
