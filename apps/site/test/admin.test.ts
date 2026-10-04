import { describe, expect, it, vi } from "vitest";
import { readAccessToken, serializeCookie, type AuthClient, type Tokens } from "../lib/admin/auth";
import {
  handleAvailability,
  handleForgot,
  handleLogin,
  handleReset,
  handleStatus,
  safeReturn,
} from "../lib/admin/handlers";
import type { LoginLimiter } from "../lib/admin/site-rpc";
import { actionNotice, clientLabel, toDetailView } from "../lib/admin/views";

const form = (fields: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const value of [v].flat()) f.append(k, value);
  return f;
};

const tokens: Tokens = { access_token: "at", refresh_token: "rt", expires_in: 3600 };

/** Compteur d'échecs en mémoire, comme la base : bloqué au 5e échec. */
function memoryLimiter(): LoginLimiter & { failures: number } {
  return {
    failures: 0,
    async blockedUntil() {
      return this.failures >= 5 ? new Date(Date.now() + 15 * 60_000) : null;
    },
    async fail() {
      this.failures += 1;
    },
    async clear() {
      this.failures = 0;
    },
  };
}

function fakeAuth(password = "bon-mot-de-passe"): AuthClient & { calls: number } {
  return {
    calls: 0,
    async password(_email, given) {
      this.calls += 1;
      return given === password ? tokens : null;
    },
    refresh: async () => null,
    logout: vi.fn(async () => {}),
  };
}

describe("connexion", () => {
  it("bons identifiants d'un commerçant de la boutique : cookies de session posés, compteur remis à zéro", async () => {
    const limiter = memoryLimiter();
    limiter.failures = 3;
    const result = await handleLogin(form({ email: "Commandes@Boutique.fr ", mot_de_passe: "bon-mot-de-passe" }), {
      auth: fakeAuth(),
      limiter,
      isMerchant: async () => true,
    });
    expect(result.status).toBe(303);
    expect(result.location).toBe("/admin");
    expect(result.cookies?.map((c) => c.name)).toEqual(["lp_admin_at", "lp_admin_rt"]);
    expect(limiter.failures).toBe(0);
    expect(serializeCookie(result.cookies![0]!)).toMatch(/; HttpOnly; Secure; SameSite=Lax$/);
  });

  it("T7.11 6e essai en 15 minutes : refusé sans interroger Supabase Auth, message de blocage temporaire", async () => {
    const limiter = memoryLimiter();
    const auth = fakeAuth();
    const deps = { auth, limiter, isMerchant: async () => true };
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await handleLogin(form({ email: "a@b.fr", mot_de_passe: "faux" }), deps));
    expect(results.slice(0, 4).every((r) => r.location === "/admin/connexion?erreur=identifiants")).toBe(true);
    expect(results[4]!.location).toBe("/admin/connexion?erreur=bloque");
    const sixth = await handleLogin(form({ email: "a@b.fr", mot_de_passe: "bon-mot-de-passe" }), deps);
    expect(sixth.location).toBe("/admin/connexion?erreur=bloque");
    expect(sixth.cookies).toBeUndefined();
    expect(auth.calls).toBe(5);
  });

  it("compte valide d'une autre boutique : refusé comme un mauvais mot de passe, session fermée, échec compté", async () => {
    const limiter = memoryLimiter();
    const auth = fakeAuth();
    const result = await handleLogin(form({ email: "a@b.fr", mot_de_passe: "bon-mot-de-passe" }), {
      auth,
      limiter,
      isMerchant: async () => false,
    });
    expect(result).toEqual({ status: 303, location: "/admin/connexion?erreur=identifiants", cookies: undefined });
    expect(auth.logout).toHaveBeenCalledWith("at");
    expect(limiter.failures).toBe(1);
  });

  it("champs vides : message, aucun essai compté", async () => {
    const limiter = memoryLimiter();
    const result = await handleLogin(form({ email: "", mot_de_passe: "" }), {
      auth: fakeAuth(),
      limiter,
      isMerchant: async () => true,
    });
    expect(result.location).toBe("/admin/connexion?erreur=champs");
    expect(limiter.failures).toBe(0);
  });

  it("jeton d'accès : revendications lues pour l'affichage et l'expiration", () => {
    const payload = btoa(JSON.stringify({ sub: "u1", email: "a@b.fr", exp: 2_000_000_000 })).replace(/=+$/, "");
    expect(readAccessToken(`x.${payload}.y`)).toEqual({ sub: "u1", email: "a@b.fr", exp: 2_000_000_000 });
    expect(readAccessToken("pas-un-jeton")).toBeNull();
    expect(readAccessToken(undefined)).toBeNull();
  });
});

describe("actions sur les commandes", () => {
  const deps = () => ({
    currentStatus: vi.fn(async () => "new" as const),
    updateStatus: vi.fn(async () => true),
  });

  it("T7.12 action serveur sans session : 401, aucune écriture", async () => {
    const d = deps();
    const result = await handleStatus(false, "o1", form({ statut: "preparing" }), d);
    expect(result.status).toBe(401);
    expect(d.currentStatus).not.toHaveBeenCalled();
    expect(d.updateStatus).not.toHaveBeenCalled();
  });

  it("T7.1 new → preparing : écrit depuis l'état lu, retour à la carte de la liste", async () => {
    const d = deps();
    const result = await handleStatus(
      true,
      "o1",
      form({ statut: "preparing", retour: "/admin?statut=new#commande-o1" }),
      d,
    );
    expect(d.updateStatus).toHaveBeenCalledWith("o1", "new", "preparing");
    expect(result.location).toBe("/admin?statut=new&maj=o1#commande-o1");
  });

  it("passage à « Prête » : envoi immédiat de l'email client ; pas pour les autres statuts", async () => {
    const afterReady = vi.fn();
    const d = { ...deps(), afterReady, currentStatus: vi.fn(async () => "preparing" as const) };
    await handleStatus(true, "o1", form({ statut: "ready" }), d);
    expect(afterReady).toHaveBeenCalledOnce();
    await handleStatus(true, "o1", form({ statut: "new" }), d);
    expect(afterReady).toHaveBeenCalledOnce();
  });

  it("T7.4 saut de statut ou statut inconnu : refusé sans écriture", async () => {
    const d = deps();
    expect((await handleStatus(true, "o1", form({ statut: "collected" }), d)).location).toBe(
      "/admin/commandes/o1?erreur=statut",
    );
    expect((await handleStatus(true, "o1", form({ statut: "annulée" }), d)).location).toBe(
      "/admin/commandes/o1?erreur=statut",
    );
    expect(d.updateStatus).not.toHaveBeenCalled();
  });

  it("commande changée entre-temps (deux postes au comptoir) ou introuvable", async () => {
    const d = deps();
    d.updateStatus.mockResolvedValueOnce(false);
    expect((await handleStatus(true, "o1", form({ statut: "preparing" }), d)).location).toBe(
      "/admin/commandes/o1?erreur=concurrence",
    );
    d.currentStatus.mockResolvedValueOnce(null as never);
    expect((await handleStatus(true, "o2", form({ statut: "preparing" }), d)).status).toBe(404);
  });

  it("adresse de retour : uniquement une page du back-office", () => {
    expect(safeReturn("/admin/commandes/x")).toBe("/admin/commandes/x");
    expect(safeReturn("https://pirate.example/admin")).toBe("/admin");
    expect(safeReturn("//pirate.example")).toBe("/admin");
    expect(safeReturn("/administrateur")).toBe("/admin");
  });
});

describe("disponibilité", () => {
  it("T7.10 Enregistrer : écriture des seules différences dans product_availability, puis revalidation", async () => {
    const calls: string[] = [];
    const save = vi.fn(async () => {
      calls.push("save");
    });
    const result = await handleAvailability(
      true,
      form({ produit: ["tomme", "miel", "terrine", "inconnu"], en_vente: ["miel", "terrine", "inconnu"] }),
      {
        productIds: new Set(["tomme", "miel", "terrine"]),
        saved: async () => ({ terrine: false }),
        save,
        revalidate: async () => {
          calls.push("revalidate");
        },
      },
    );
    expect(save).toHaveBeenCalledWith([
      { productId: "tomme", available: false },
      { productId: "terrine", available: true },
    ]);
    expect(calls).toEqual(["save", "revalidate"]);
    expect(result.location).toBe("/admin/produits?enregistre=2");
  });

  it("rien de modifié : ni écriture ni revalidation ; sans session : 401", async () => {
    const deps = { productIds: new Set(["miel"]), saved: async () => ({}), save: vi.fn(), revalidate: vi.fn() };
    expect((await handleAvailability(true, form({ produit: "miel", en_vente: "miel" }), deps)).location).toBe(
      "/admin/produits?enregistre=0",
    );
    expect((await handleAvailability(false, form({ produit: "miel" }), deps)).status).toBe(401);
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.revalidate).not.toHaveBeenCalled();
  });
});

describe("mot de passe oublié", () => {
  it("T7.8 email inconnu puis email connu : même message neutre, réponse rendue avant toute recherche", async () => {
    const tasks: (() => Promise<unknown>)[] = [];
    const request = vi.fn(async (email: string) => (email === "connu@boutique.fr" ? "connu@boutique.fr" : null));
    const sendLink = vi.fn(async () => {});
    const deps = {
      resets: { request },
      newToken: async () => ({ token: "t".repeat(43), hash: "h".repeat(64) }),
      sendLink,
      origin: "https://boutique.fr",
      background: (task: () => Promise<unknown>) => tasks.push(task),
    };
    const unknown = handleForgot(form({ email: "inconnu@boutique.fr" }), deps);
    const known = handleForgot(form({ email: "Connu@Boutique.fr" }), deps);
    expect(unknown).toEqual(known);
    expect(known).toEqual({ status: 303, location: "/admin/mot-de-passe-oublie?envoye=1", cookies: undefined });
    // Rien n'a été cherché ni envoyé avant la réponse : même délai dans les deux cas.
    expect(request).not.toHaveBeenCalled();
    await Promise.all(tasks.map((t) => t()));
    expect(request).toHaveBeenCalledTimes(2);
    expect(sendLink).toHaveBeenCalledOnce();
    expect(sendLink).toHaveBeenCalledWith(
      "connu@boutique.fr",
      `https://boutique.fr/admin/nouveau-mot-de-passe?jeton=${"t".repeat(43)}`,
    );
  });

  it("nouveau mot de passe : jeton, longueur et confirmation vérifiés ; lien consommé ou expiré", async () => {
    const complete = vi.fn(async () => true);
    const deps = { resets: { complete }, hash: async () => "h".repeat(64) };
    const token = "a".repeat(43);
    expect(
      (await handleReset(form({ jeton: "court", mot_de_passe: "x".repeat(12), confirmation: "x".repeat(12) }), deps))
        .location,
    ).toBe("/admin/nouveau-mot-de-passe?erreur=lien");
    expect(
      (await handleReset(form({ jeton: token, mot_de_passe: "court", confirmation: "court" }), deps)).location,
    ).toMatch(/erreur=longueur$/);
    expect(
      (await handleReset(form({ jeton: token, mot_de_passe: "x".repeat(12), confirmation: "y".repeat(12) }), deps))
        .location,
    ).toMatch(/erreur=confirmation$/);
    expect(complete).not.toHaveBeenCalled();
    expect(
      (await handleReset(form({ jeton: token, mot_de_passe: "x".repeat(12), confirmation: "x".repeat(12) }), deps))
        .location,
    ).toBe("/admin/connexion?reinitialise=1");
    complete.mockResolvedValueOnce(false);
    expect(
      (await handleReset(form({ jeton: token, mot_de_passe: "x".repeat(12), confirmation: "x".repeat(12) }), deps))
        .location,
    ).toBe("/admin/nouveau-mot-de-passe?erreur=lien");
  });
});

describe("mise en forme", () => {
  const NOW = new Date("2026-10-02T10:00:00Z");

  it("détail : créneau relatif, date de paiement, TVA par taux croissant, total de ligne", () => {
    const view = toDetailView(
      {
        id: "o1",
        number: 2471,
        status: "new",
        slotStart: "2026-10-02T14:00:00Z",
        slotEnd: "2026-10-02T17:00:00Z",
        totalCents: 4470,
        customerName: "Camille Besson",
        email: "camille@exemple.fr",
        itemCount: 4,
        phone: "06 12 00 00 00",
        paidAt: "2026-10-02T07:12:00Z",
        vatBreakdown: { "20": 0, "5.5": 233 },
        lines: [{ name: "Miel", format: "Pot 250 g", quantity: 2, unitPriceCents: 1250, vatRate: 5.5 }],
      },
      NOW,
    );
    expect(view.slotLabel).toBe("Aujourd'hui 16:00 – 19:00");
    expect(view.paidLabel).toBe("2 oct. à 09:12");
    expect(view.vat.map((v) => v.rate)).toEqual([5.5, 20]);
    expect(view.lines[0]!.totalCents).toBe(2500);
  });

  it("client sans nom : son email ; message après action", () => {
    expect(clientLabel({ customerName: null, email: "a@b.fr", number: 3 })).toBe("a@b.fr");
    expect(actionNotice({ maj: "o1" }, () => ({ number: 12, status: "ready" }))).toEqual({
      tone: "info",
      text: "Commande #12 : Prête.",
    });
    expect(actionNotice({ erreur: "statut" }, () => undefined)?.tone).toBe("error");
  });
});
