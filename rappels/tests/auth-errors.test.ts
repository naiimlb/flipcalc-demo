import { describe, expect, it } from "vitest";
import { frenchError } from "@/lib/auth";

describe("messages d'erreur de connexion / inscription (français)", () => {
  it("mauvais identifiants", () => {
    expect(frenchError({ message: "Invalid login credentials", status: 400, code: "invalid_credentials" })).toBe("Email ou mot de passe incorrect.");
  });
  it("email déjà utilisé", () => {
    expect(frenchError({ message: "User already registered", status: 422, code: "user_already_exists" })).toBe("Cet email a déjà un compte. Connecte-toi.");
    expect(frenchError({ message: "A user with this email address has already been registered", code: "email_exists" })).toBe("Cet email a déjà un compte. Connecte-toi.");
  });
  it("mot de passe trop faible, trop d'essais, pas de réseau, inscriptions fermées", () => {
    expect(frenchError({ message: "Password should be at least 6 characters", code: "weak_password" })).toBe("Mot de passe trop court : 8 caractères minimum.");
    expect(frenchError({ message: "x", status: 429 })).toBe("Trop d'essais. Réessaie dans une minute.");
    expect(frenchError({ message: "TypeError: Failed to fetch" })).toBe("Pas de connexion. Vérifie ton réseau.");
    expect(frenchError({ message: "Signups not allowed for this instance", code: "signup_disabled" })).toBe("Les inscriptions sont fermées pour le moment.");
  });
  it("erreur inconnue : message générique, sans détail technique", () => {
    expect(frenchError({ message: "boom: détail interne" })).toBe("Oups, une erreur est survenue. Réessaie.");
  });
});
