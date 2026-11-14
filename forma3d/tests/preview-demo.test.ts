import { afterEach, describe, expect, it, vi } from "vitest";
import { isDemoMode, supabaseConfig } from "@/lib/supabase/env";

afterEach(() => vi.unstubAllEnvs());

describe("mode démonstration forcé en Preview", () => {
  it("ignore la configuration Supabase quand la Preview force la démo", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemple.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("NEXT_PUBLIC_FORMA3D_FORCE_DEMO", "1");
    expect(supabaseConfig()).toBeNull();
    expect(isDemoMode()).toBe(true);
  });

  it("utilise Supabase hors Preview", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemple.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("NEXT_PUBLIC_FORMA3D_FORCE_DEMO", "");
    expect(supabaseConfig()).toEqual({ url: "https://exemple.supabase.co", key: "sb_publishable_test" });
  });
});
