import {
  parisDate,
  parisToUtc,
  type BackOfficeOrder,
  type OrderStatus,
  type StatusFilter,
} from "@launchpadfactoryteam/commerce";
import type { SiteEnv } from "../env";

/**
 * Données du back-office, lues et écrites avec le jeton du commerçant (rôle authenticated) : la RLS du lot 2
 * le limite à ses boutiques, et chaque requête est en plus filtrée sur la boutique du site.
 */

export interface AdminOrder extends BackOfficeOrder {
  customerName: string | null;
  email: string | null;
  itemCount: number;
}

export interface AdminOrderDetail extends AdminOrder {
  phone: string | null;
  paidAt: string;
  vatBreakdown: Record<string, number>;
  lines: { name: string; format: string; quantity: number; unitPriceCents: number; vatRate: number }[];
}

export class NotAuthenticatedError extends Error {
  constructor() {
    super("Session refusée par la base");
    this.name = "NotAuthenticatedError";
  }
}

interface OrderRow {
  id: string;
  number: number;
  status: OrderStatus;
  slot_start: string;
  slot_end: string;
  total_cents: number;
  customer_name: string | null;
  email: string | null;
  order_items: { quantity: number }[];
}

interface OrderDetailRow extends Omit<OrderRow, "order_items"> {
  phone: string | null;
  paid_at: string;
  vat_breakdown: Record<string, number>;
  order_items: { name: string; format: string; quantity: number; unit_price_cents: number; vat_rate: number }[];
}

export class AdminApi {
  constructor(
    private readonly e: SiteEnv,
    private readonly accessToken: string,
    readonly shopId: string,
  ) {}

  private async rest<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.e.SUPABASE_URL}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.e.SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      cache: "no-store",
    });
    if (res.status === 401) throw new NotAuthenticatedError();
    const text = await res.text();
    if (!res.ok) throw new Error(`Base : ${res.status} sur ${path.split("?")[0]} : ${text}`);
    // Écriture avec Prefer: return=minimal : réponse sans corps.
    return (text ? JSON.parse(text) : null) as T;
  }

  /** Le compte connecté est-il commerçant de la boutique de ce site ? */
  async isMerchant(): Promise<boolean> {
    const rows = await this.rest<unknown[]>(`shop_users?select=shop_id&shop_id=eq.${this.shopId}`);
    return rows.length > 0;
  }

  /**
   * Sans filtre : commandes à venir ou en cours, et celles d'aujourd'hui même retirées (pour le bandeau du jour).
   * Filtre « Retirée » : les 100 dernières.
   */
  async listOrders(filter: StatusFilter, now: Date): Promise<AdminOrder[]> {
    const select = "select=id,number,status,slot_start,slot_end,total_cents,customer_name,email,order_items(quantity)";
    const startOfToday = parisToUtc(parisDate(now), "00:00").toISOString();
    const where =
      filter === "all"
        ? `or=(status.neq.collected,slot_start.gte.${startOfToday})&order=slot_start.asc`
        : `status=eq.${filter}&order=slot_start.${filter === "collected" ? "desc" : "asc"}&limit=100`;
    const rows = await this.rest<OrderRow[]>(`orders?${select}&shop_id=eq.${this.shopId}&${where}`);
    return rows.map(toOrder);
  }

  async getOrder(id: string): Promise<AdminOrderDetail | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const rows = await this.rest<OrderDetailRow[]>(
      `orders?select=id,number,status,slot_start,slot_end,total_cents,customer_name,email,phone,paid_at,vat_breakdown,` +
        `order_items(name,format,quantity,unit_price_cents,vat_rate)&id=eq.${id}&shop_id=eq.${this.shopId}`,
    );
    const row = rows[0];
    if (!row) return null;
    return {
      ...toOrder({ ...row, order_items: row.order_items }),
      phone: row.phone,
      paidAt: row.paid_at,
      vatBreakdown: row.vat_breakdown,
      lines: row.order_items.map((l) => ({
        name: l.name,
        format: l.format,
        quantity: l.quantity,
        unitPriceCents: l.unit_price_cents,
        vatRate: Number(l.vat_rate),
      })),
    };
  }

  /** Change le statut si la commande est toujours dans l'état affiché ; faux si quelqu'un l'a changé entre-temps. */
  async updateStatus(id: string, from: OrderStatus, to: OrderStatus): Promise<boolean> {
    const rows = await this.rest<unknown[]>(`orders?id=eq.${id}&shop_id=eq.${this.shopId}&status=eq.${from}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: to }),
    });
    return rows.length === 1;
  }

  /** Produits coupés ou remis en vente, par identifiant ; un produit absent est en vente. */
  async availability(): Promise<Record<string, boolean>> {
    const rows = await this.rest<{ product_id: string; available: boolean }[]>(
      `product_availability?select=product_id,available&shop_id=eq.${this.shopId}`,
    );
    return Object.fromEntries(rows.map((r) => [r.product_id, r.available]));
  }

  async saveAvailability(changes: { productId: string; available: boolean }[]): Promise<void> {
    if (changes.length === 0) return;
    await this.rest<null>("product_availability?on_conflict=shop_id,product_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(
        changes.map((c) => ({ shop_id: this.shopId, product_id: c.productId, available: c.available })),
      ),
    });
  }
}

function toOrder(row: OrderRow): AdminOrder {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    slotStart: row.slot_start,
    slotEnd: row.slot_end,
    totalCents: row.total_cents,
    customerName: row.customer_name,
    email: row.email,
    itemCount: row.order_items.reduce((sum, i) => sum + i.quantity, 0),
  };
}
