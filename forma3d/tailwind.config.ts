import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  // Mode sombre piloté par la classe « dark » sur <html> (choix auto / clair / sombre).
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Couleurs pilotées par l'admin (variables CSS posées dans le layout racine).
        brand: {
          from: "rgb(var(--brand-from) / <alpha-value>)",
          to: "rgb(var(--brand-to) / <alpha-value>)",
          accent: "rgb(var(--brand-accent) / <alpha-value>)",
        },
        // Couleurs de surface et de texte : variables CSS inversées en mode sombre (globals.css).
        paper: "rgb(var(--paper) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          soft: "rgb(var(--ink-soft) / <alpha-value>)",
          mute: "rgb(var(--ink-mute) / <alpha-value>)",
        },
        line: "rgb(var(--line) / <alpha-value>)",
        // Toujours sombre (boutons noirs, badge du titre, toasts), dans les deux modes.
        night: "rgb(var(--night) / <alpha-value>)",
        // Fond de page et texte posé dessus (inversés entre clair et sombre).
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        // Palette néon de l'identité.
        neon: {
          blue: "rgb(var(--neon-blue) / <alpha-value>)",
          "blue-strong": "rgb(var(--neon-blue-strong) / <alpha-value>)",
          coral: "rgb(var(--neon-coral) / <alpha-value>)",
          violet: "rgb(var(--neon-violet) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        card: "32px",
      },
      boxShadow: {
        card: "0 30px 80px -30px rgba(40, 30, 120, 0.45), 0 10px 30px -15px rgba(40, 30, 120, 0.25)",
        soft: "0 1px 2px rgba(17,17,20,0.04), 0 8px 24px -12px rgba(17,17,20,0.12)",
        float: "0 30px 60px -20px rgba(30, 20, 90, 0.35)",
        neon: "0 0 0 1px rgb(var(--neon-blue) / 0.5), 0 10px 40px -8px rgb(var(--neon-blue) / 0.65)",
        "neon-coral": "0 10px 40px -8px rgb(var(--neon-coral) / 0.6)",
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
