/**
 * Intégration : le jeton de site à travers l'API REST de Supabase (passerelle + PostgREST), comme en production.
 * Exécuté quand LP_SUPABASE_URL, LP_SUPABASE_JWT_SECRET et LP_SUPABASE_DB_URL sont définis
 * (voir tools/scripts/test-db.sh) ; ignoré sinon.
 */
import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { createSiteClient, signSiteToken } from "../src/index.ts";

const URL = process.env.LP_SUPABASE_URL;
const SECRET = process.env.LP_SUPABASE_JWT_SECRET;
const DB_URL = process.env.LP_SUPABASE_DB_URL;
const FERRAND = "f0000000-0000-4000-8000-000000000001"; // boutique des données de démonstration (seed.sql)
const OTHER = "99999999-0000-4000-8000-000000000000";

const site = (shopId: string) => {
  const token = signSiteToken({ shopId, jwtSecret: SECRET! });
  return createSiteClient(URL!, process.env.LP_SUPABASE_ANON_KEY ?? token, token);
};

describe.skipIf(!URL || !SECRET || !DB_URL)("API Supabase avec un jeton de site", () => {
  const created: string[] = [];

  afterAll(async () => {
    if (!created.length) return;
    const db = new pg.Client({ connectionString: DB_URL });
    await db.connect();
    await db.query("delete from public.orders where stripe_session_id = any($1)", [created]);
    await db.end();
  });

  it("le site Maison Ferrand lit ses 6 commandes de démonstration", async () => {
    const { data, error } = await site(FERRAND).from("orders").select("number, status").order("number");
    expect(error).toBeNull();
    expect(data!.map((o) => o.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("le jeton d'une autre boutique ne voit aucune commande de Maison Ferrand", async () => {
    const { data, error } = await site(OTHER).from("orders").select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("le site ne peut pas écrire une commande pour une autre boutique", async () => {
    const { error } = await site(OTHER).from("orders").insert({
      shop_id: FERRAND,
      slot_start: "2026-10-03T08:00:00Z",
      slot_end: "2026-10-03T10:00:00Z",
      email: "intrus@exemple.fr",
      total_cents: 100,
      stripe_session_id: "cs_integration_intrus",
      paid_at: "2026-10-02T10:00:00Z",
    });
    expect(error?.code).toBe("42501");
  });

  it("le site crée une commande de sa boutique, numérotée par la base", async () => {
    const session = `cs_integration_${Date.now()}`;
    const { data, error } = await site(FERRAND)
      .from("orders")
      .insert({
        shop_id: FERRAND,
        slot_start: "2026-10-03T08:00:00Z",
        slot_end: "2026-10-03T10:00:00Z",
        email: "integration@exemple.fr",
        total_cents: 1250,
        stripe_session_id: session,
        paid_at: "2026-10-02T10:00:00Z",
      })
      .select("number, status")
      .single();
    created.push(session);
    expect(error).toBeNull();
    expect(data!.status).toBe("new");
    expect(data!.number).toBeGreaterThan(6);
  });

  it("le site n'a aucun accès aux comptes du back-office", async () => {
    const { error } = await site(FERRAND).from("shop_users").select("*");
    expect(error?.code).toBe("42501");
  });
});
