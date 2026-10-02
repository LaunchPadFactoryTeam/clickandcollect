import { describe, expect, it } from "vitest";
import { isAuthorized } from "../lib/revalidate";

const SECRET = "un-secret-de-revalidation-de-32-caracteres";

describe("revalidation à la demande", () => {
  it("accepte le bon secret", () => {
    expect(isAuthorized(SECRET, SECRET)).toBe(true);
  });
  it("refuse un secret absent, faux ou de longueur différente", () => {
    expect(isAuthorized(null, SECRET)).toBe(false);
    expect(isAuthorized(`${SECRET}x`, SECRET)).toBe(false);
    expect(isAuthorized(SECRET.replace("u", "v"), SECRET)).toBe(false);
  });
  it("refuse tout si le secret serveur n'est pas configuré ou trop court", () => {
    expect(isAuthorized("x", undefined)).toBe(false);
    expect(isAuthorized("court", "court")).toBe(false);
  });
});
