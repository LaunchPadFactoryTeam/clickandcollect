import { createHash, randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { payOrder, sql } from "./db";
import { content, seriousViolations } from "./helpers";

/**
 * Back-office commerçant, avec la base Supabase locale (Supabase Auth compris), le faux fournisseur de paiement et
 * le faux prestataire d'emails (E2E_TUNNEL=1). Compte de démonstration : packages/db/supabase/seed.sql.
 */
test.skip(!process.env.E2E_TUNNEL, "back-office : E2E_TUNNEL=1 et Supabase local (avec Auth) requis");

const MERCHANT = { email: "commandes@maison-ferrand.fr", password: "demo-maison-ferrand" };

async function login(page: Page, account = MERCHANT) {
  await page.goto("/admin/connexion");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Mot de passe").fill(account.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Commande payée au nom d'un client propre au test (les deux projets tournent en parallèle sur la même base). */
async function paidOrder(page: Page) {
  const name = `Client ${randomUUID().slice(0, 8)}`;
  const sessionId = await payOrder(page, { name, email: `${name.replace(" ", ".").toLowerCase()}@exemple.fr` });
  const [order] = await sql<{ id: string; number: number }>(
    "select id, number from orders where stripe_session_id = $1",
    [sessionId],
  );
  return { name, ...order! };
}

test("connexion : mauvais mot de passe refusé, puis liste des commandes du jour", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/connexion$/);
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByLabel("Email").fill(MERCHANT.email);
  await page.getByLabel("Mot de passe").fill("pas-le-bon");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.locator(".bo-notice--error")).toHaveText("Email ou mot de passe incorrect.");
  await login(page);
  await expect(page.getByText("Commandes aujourd'hui")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Filtrer par statut" }).getByRole("link")).toHaveText([
    "Toutes",
    "Nouvelle",
    "En préparation",
    "Prête",
    "Retirée",
  ]);
  expect(await seriousViolations(page)).toEqual([]);
});

test("une commande payée apparaît, avance jusqu'à « Prête » (email client), recule d'un cran depuis le détail", async ({
  page,
}) => {
  const order = await paidOrder(page);
  await login(page);
  const card = page.locator(".bo-card", { hasText: order.name });
  await expect(card).toContainText(`#${order.number} · 1 article`);
  await expect(card.locator(".bo-badge")).toHaveText("Nouvelle");

  await card.getByRole("button", { name: /Mettre en préparation/ }).click();
  await expect(page.getByRole("status")).toHaveText(`Commande #${order.number} : En préparation.`);
  await card.getByRole("button", { name: /Marquer prête/ }).click();
  await expect(card.locator(".bo-badge")).toHaveText("Prête");
  // Lot 6 : le passage à « Prête » met l'email du client en file, une seule fois.
  await expect
    .poll(
      async () =>
        (await sql("select 1 from email_outbox where kind = 'order_ready' and payload ->> 'order_id' = $1", [order.id]))
          .length,
    )
    .toBe(1);

  await card.getByRole("link", { name: `Détail de la commande #${order.number}` }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(order.name);
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole("button", { name: /En préparation : revenir à cette étape/ }).click();
  await expect(page.locator(".bo-badge")).toHaveText("En préparation");
  await page.getByRole("button", { name: /Prête : passer à cette étape/ }).click();
  await expect(page.locator(".bo-badge")).toHaveText("Prête");
  expect(
    (await sql("select 1 from email_outbox where kind = 'order_ready' and payload ->> 'order_id' = $1", [order.id]))
      .length,
  ).toBe(1);
  const events = await sql<{ to_status: string }>(
    "select to_status from order_status_events where order_id = $1 order by id",
    [order.id],
  );
  expect(events.map((e) => e.to_status)).toEqual(["new", "preparing", "ready", "preparing", "ready"]);
});

test("filtre « Retirée » : une commande retirée ne quitte la liste du jour que sous ce filtre les jours suivants", async ({
  page,
}) => {
  const order = await paidOrder(page);
  await sql("update orders set status = 'preparing' where id = $1", [order.id]);
  await sql("update orders set status = 'ready' where id = $1", [order.id]);
  await sql(
    "update orders set status = 'collected', slot_start = now() - interval '2 days', slot_end = now() - interval '2 days' + interval '1 hour' where id = $1",
    [order.id],
  );
  await login(page);
  await expect(page.locator(".bo-card", { hasText: order.name })).toHaveCount(0);
  await page.getByRole("link", { name: "Retirée" }).click();
  await expect(page.locator(".bo-card", { hasText: order.name }).locator(".bo-badge")).toHaveText("Retirée");
  await expect(page.locator(".bo-card", { hasText: order.name }).getByRole("button")).toHaveCount(0);
});

test("un commerçant ne voit jamais une commande d'une autre boutique, même en changeant l'identifiant dans l'adresse", async ({
  page,
  request,
}) => {
  const shop = randomUUID();
  const orderId = randomUUID();
  await sql("insert into shops (id, slug, name, domain, core_version) values ($1, $2, 'Autre boutique', $3, '1.0.0')", [
    shop,
    `autre-${shop.slice(0, 8)}`,
    `autre-${shop.slice(0, 8)}.fr`,
  ]);
  await sql(
    `insert into orders (id, shop_id, slot_start, slot_end, email, customer_name, total_cents, stripe_session_id, paid_at)
     values ($1, $2, now(), now() + interval '1 hour', 'secret@autre.fr', 'Client secret', 1000, $3, now())`,
    [orderId, shop, `cs_autre_${orderId}`],
  );
  await login(page);
  await page.goto(`/admin/commandes/${orderId}`);
  await expect(page.getByRole("heading", { name: "Commande introuvable" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Client secret");
  // Même en forgeant le formulaire avec la session du commerçant : rien n'est écrit.
  const res = await page.request.post(`/api/admin/commandes/${orderId}/statut`, {
    form: { statut: "preparing" },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(404);
  expect((await sql<{ status: string }>("select status from orders where id = $1", [orderId]))[0]!.status).toBe("new");
  // Sans session : 401.
  const anonymous = await request.post(`/api/admin/commandes/${orderId}/statut`, {
    form: { statut: "preparing" },
    maxRedirects: 0,
  });
  expect(anonymous.status()).toBe(401);
});

test("disponibilité : un produit coupé puis enregistré n'est plus ajoutable sur le site en moins d'une minute", async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  // Un produit différent par projet : les deux projets tournent en parallèle sur la même base.
  const candidates = content.catalog.filter((p) => p.available && !p.isAlcohol);
  const product = candidates[info.project.name === "mobile" ? 1 : 2]!;
  await sql("delete from product_availability where product_id = $1", [product.id]);
  await login(page);
  await page.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Produits" }).click();
  await expect(page.getByRole("heading", { name: "Disponibilité" })).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  const toggle = page.getByRole("switch", { name: new RegExp(product.name.replace(/[()]/g, ".")) });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(toggle).toHaveAccessibleName(`${product.name} Coupé`);
  await expect(page.locator(".bo-savebar")).toContainText("1 modification");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("status")).toContainText("1 modification enregistrée");
  const saved = Date.now();

  await expect
    .poll(
      async () => {
        await page.goto(`/produits/${product.slug}`);
        return page.getByRole("button", { name: `${product.name} indisponible` }).count();
      },
      { timeout: 60_000, intervals: [2_000] },
    )
    .toBe(1);
  expect(Date.now() - saved).toBeLessThan(60_000);
  await expect(page.getByText("Indisponible", { exact: true }).first()).toBeVisible();

  // Remise en vente pour les autres tests.
  await page.goto("/admin/produits");
  await page.getByRole("switch", { name: new RegExp(product.name.replace(/[()]/g, ".")) }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("status")).toContainText("1 modification enregistrée");
});

test("5 échecs de connexion en 15 minutes : le compte est bloqué, même avec le bon mot de passe", async ({ page }) => {
  const email = `bloque.${randomUUID().slice(0, 8)}@exemple.fr`;
  for (let i = 0; i < 5; i++) {
    await page.goto("/admin/connexion");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Mot de passe").fill(`faux-${i}`);
    await page.getByRole("button", { name: "Se connecter" }).click();
  }
  await expect(page.locator(".bo-notice--error")).toContainText("bloqué pendant 15 minutes");
});

test("mot de passe oublié : message neutre, lien à usage unique, nouveau mot de passe", async ({ page }) => {
  const userId = randomUUID();
  const email = `reset.${userId.slice(0, 8)}@exemple.fr`;
  await sql(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data,
       raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2,
       extensions.crypt('ancien-mot-de-passe', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}',
       '{}', now(), now(), '', '', '', '')`,
    [userId, email],
  );
  await sql("insert into shop_users (user_id, shop_id) select $1, id from shops where slug = 'maison-ferrand'", [
    userId,
  ]);

  for (const address of [`inconnu.${userId.slice(0, 8)}@exemple.fr`, email]) {
    await page.goto("/admin/mot-de-passe-oublie");
    await page.getByLabel("Email").fill(address);
    await page.getByRole("button", { name: "Recevoir le lien" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "Si un compte existe pour cet email, un lien vient de lui être envoyé. Il est valable une heure.",
    );
  }
  await expect
    .poll(async () => (await sql("select 1 from password_resets where user_id = $1", [userId])).length)
    .toBe(1);

  // Le jeton n'existe que dans l'email (faux prestataire ici) : on en pose un connu à la place.
  const token = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  await sql(`update password_resets set token_hash = $2 where user_id = $1 and used_at is null`, [
    userId,
    createHash("sha256").update(token).digest("hex"),
  ]);
  await page.goto(`/admin/nouveau-mot-de-passe?jeton=${token}`);
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByLabel("Nouveau mot de passe").fill("nouveau-mot-de-passe");
  await page.getByLabel("Confirmation").fill("nouveau-mot-de-passe");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByRole("status")).toHaveText("Mot de passe enregistré : connectez-vous avec le nouveau.");
  await login(page, { email, password: "nouveau-mot-de-passe" });

  await page.goto(`/admin/nouveau-mot-de-passe?jeton=${token}`);
  await expect(page.getByText("Ce lien a expiré ou a déjà servi.")).toBeVisible();
});

test("cibles tactiles d'au moins 48 px ; déconnexion", async ({ page }) => {
  await login(page);
  for (const path of ["/admin", "/admin/produits"]) {
    await page.goto(path);
    const small = await page.locator(".bo-app a, .bo-app button, .bo-app input:not([type=hidden])").evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => ({ el: el.outerHTML.slice(0, 80), ...el.getBoundingClientRect().toJSON() }))
        .filter((r) => r.height < 48 || r.width < 48),
    );
    expect(small).toEqual([]);
  }
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/admin\/connexion\?deconnecte=1$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/connexion$/);
});
