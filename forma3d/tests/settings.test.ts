import { describe, expect, it } from "vitest";
import { DEFAULT_FEATURES, DEFAULT_SITE, FeatureFlagsSchema, SiteSettingsSchema, hexToRgbTriplet, mergeWithDefaults } from "@/lib/settings";

describe("réglages", () => {
  it("fusionne avec les valeurs par défaut en ignorant les champs invalides", () => {
    const merged = mergeWithDefaults(SiteSettingsSchema, DEFAULT_SITE, {
      siteName: "Atelier",
      colorFrom: "bleu",
      inconnu: 42,
      logoDataUrl: "javascript:alert(1)",
    });
    expect(merged.siteName).toBe("Atelier");
    expect(merged.colorFrom).toBe(DEFAULT_SITE.colorFrom);
    expect(merged.logoDataUrl).toBeNull();
    expect(merged).not.toHaveProperty("inconnu");
  });

  it("borne les quotas", () => {
    const merged = mergeWithDefaults(FeatureFlagsSchema, DEFAULT_FEATURES, { hourlyLimit: -5, dailyLimit: 50, devMode: "oui" });
    expect(merged.hourlyLimit).toBe(DEFAULT_FEATURES.hourlyLimit);
    expect(merged.dailyLimit).toBe(50);
    expect(merged.devMode).toBe(false);
  });

  it("convertit les couleurs pour les variables CSS", () => {
    expect(hexToRgbTriplet("#5b6ee1")).toBe("91 110 225");
  });
});

describe("Meshy derrière un interrupteur", () => {
  it("est désactivé par défaut, y compris pour des réglages enregistrés avant l'interrupteur", () => {
    expect(DEFAULT_FEATURES.meshy).toBe(false);
    expect(mergeWithDefaults(FeatureFlagsSchema, DEFAULT_FEATURES, { exportGlb: false }).meshy).toBe(false);
  });
});
