import { describe, expect, it } from "vitest";
import { loginUrl, nextFromSearch, safeNext } from "@/lib/redirect";

describe("redirection après connexion", () => {
  it("garde un lien interne, avec sa journée", () => {
    expect(safeNext("/taches/abc?j=2026-11-26")).toBe("/taches/abc?j=2026-11-26");
    expect(loginUrl("/taches/abc?j=2026-11-26")).toBe("/connexion?suite=%2Ftaches%2Fabc%3Fj%3D2026-11-26");
    expect(nextFromSearch("?suite=%2Ftaches%2Fabc%3Fj%3D2026-11-26")).toBe("/taches/abc?j=2026-11-26");
  });
  it("refuse tout ce qui sort de l'app ou boucle sur la connexion", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "evil", "", null, undefined, "/connexion", "/connexion?suite=/", "/inscription", "/x\n/y"]) {
      expect(safeNext(bad as string)).toBeNull();
    }
    expect(nextFromSearch("?suite=https%3A%2F%2Fevil.example")).toBeNull();
    expect(nextFromSearch("")).toBeNull();
  });
  it("l'accueil n'a pas besoin de redirection", () => {
    expect(loginUrl("/")).toBe("/connexion");
  });
});
