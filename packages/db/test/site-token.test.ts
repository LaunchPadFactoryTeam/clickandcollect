import { describe, expect, it } from "vitest";
import { signSiteToken, verifySiteToken } from "../src/index.ts";

const SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const SHOP = "aaaaaaaa-0000-0000-0000-000000000000";
const NOW = new Date("2026-10-02T10:00:00Z");

describe("jeton de site", () => {
  it("porte le rôle lp_site et la boutique, signé HS256", () => {
    const token = signSiteToken({ shopId: SHOP, jwtSecret: SECRET, now: NOW });
    const [header] = token.split(".");
    expect(JSON.parse(Buffer.from(header!, "base64url").toString())).toEqual({ alg: "HS256", typ: "JWT" });
    const claims = verifySiteToken(token, SECRET, NOW);
    expect(claims).toMatchObject({ role: "lp_site", shop_id: SHOP, iss: "launchpad" });
    expect(claims.exp - claims.iat).toBe(365 * 86400);
  });

  it("refuse une signature faite avec un autre secret", () => {
    const token = signSiteToken({ shopId: SHOP, jwtSecret: SECRET, now: NOW });
    expect(() => verifySiteToken(token, `${SECRET}-autre`, NOW)).toThrow("Signature invalide");
  });

  it("refuse un jeton dont la boutique a été modifiée", () => {
    const token = signSiteToken({ shopId: SHOP, jwtSecret: SECRET, now: NOW });
    const [h, p, s] = token.split(".");
    const claims = JSON.parse(Buffer.from(p!, "base64url").toString());
    claims.shop_id = "bbbbbbbb-0000-0000-0000-000000000000";
    const forged = `${h}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${s}`;
    expect(() => verifySiteToken(forged, SECRET, NOW)).toThrow("Signature invalide");
  });

  it("refuse un jeton expiré", () => {
    const token = signSiteToken({ shopId: SHOP, jwtSecret: SECRET, expiresInDays: 1, now: NOW });
    expect(() => verifySiteToken(token, SECRET, new Date("2026-10-04T10:00:00Z"))).toThrow("expiré");
  });

  it("refuse un shop_id qui n'est pas un UUID et un secret trop court", () => {
    expect(() => signSiteToken({ shopId: "boutique-a", jwtSecret: SECRET })).toThrow("shop_id invalide");
    expect(() => signSiteToken({ shopId: SHOP, jwtSecret: "court" })).toThrow("32 caractères");
  });
});
