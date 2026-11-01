import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Couleurs pilotées par l'admin (variables CSS posées dans le layout racine).
        brand: {
          from: "rgb(var(--brand-from) / <alpha-value>)",
          to: "rgb(var(--brand-to) / <alpha-value>)",
          accent: "rgb(var(--brand-accent) / <alpha-value>)",
        },
        paper: "#F4F4F6",
        ink: { DEFAULT: "#111114", soft: "#3B3B44", mute: "#7A7A86" },
        line: "#E6E6EC",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        card: "32px",
      },
      boxShadow: {
        card: "0 30px 80px -30px rgba(40, 30, 120, 0.45), 0 10px 30px -15px rgba(40, 30, 120, 0.25)",
        soft: "0 1px 2px rgba(17,17,20,0.04), 0 8px 24px -12px rgba(17,17,20,0.12)",
        float: "0 30px 60px -20px rgba(30, 20, 90, 0.35)",
      },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      animation: {
        shimmer: "shimmer 2.2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
