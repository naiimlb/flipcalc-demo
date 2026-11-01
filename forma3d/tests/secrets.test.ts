import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, secretHint } from "@/lib/secrets";

describe("chiffrement des clés d'API", () => {
  const key = randomBytes(32);

  it("chiffre et déchiffre", () => {
    const secret = "sk-ant-api03-exemple-de-cle-1234";
    const payload = encryptSecret(secret, key);
    expect(payload).not.toContain(secret);
    expect(payload.startsWith("v1:")).toBe(true);
    expect(decryptSecret(payload, key)).toBe(secret);
  });

  it("utilise un IV différent à chaque fois", () => {
    expect(encryptSecret("abc", key)).not.toBe(encryptSecret("abc", key));
  });

  it("détecte une altération ou une mauvaise clé", () => {
    const payload = encryptSecret("valeur-secrete", key);
    const parts = payload.split(":");
    const tampered = [parts[0], parts[1], parts[2], Buffer.from("autre chose").toString("base64")].join(":");
    expect(() => decryptSecret(tampered, key)).toThrow();
    expect(() => decryptSecret(payload, randomBytes(32))).toThrow();
  });

  it("n'expose que les 4 derniers caractères", () => {
    expect(secretHint("sk-ant-api03-abcdefgh-WXYZ")).toBe("…WXYZ");
    expect(secretHint("court")).toBe("…");
  });
});
