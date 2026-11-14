import type { Config } from "tailwindcss";

/**
 * Système de design de Forma3D (référence : /design-system).
 * Tout passe par des variables CSS (globals.css), redéfinies pour le thème sombre.
 * Les noms historiques (neon-*, brand-*) pointent vers l'accent unique pour ne rien casser.
 */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  // Mode sombre piloté par la classe « dark » sur <html> (choix auto / clair / sombre).
  darkMode: "class",
  theme: {
    // Échelle de tailles réduite : 12, 13, 14, 16, 20, 28 (+ 40 pour le seul titre de l'accueil).
    fontSize: {
      xs: ["12px", { lineHeight: "16px" }],
      sm: ["13px", { lineHeight: "18px" }],
      base: ["14px", { lineHeight: "20px" }],
      lg: ["16px", { lineHeight: "24px" }],
      xl: ["20px", { lineHeight: "28px" }],
      "2xl": ["20px", { lineHeight: "28px" }],
      "3xl": ["28px", { lineHeight: "34px" }],
      "4xl": ["28px", { lineHeight: "34px" }],
      "5xl": ["28px", { lineHeight: "34px" }],
      "6xl": ["28px", { lineHeight: "34px" }],
      "7xl": ["28px", { lineHeight: "34px" }],
      "8xl": ["28px", { lineHeight: "34px" }],
      "9xl": ["28px", { lineHeight: "34px" }],
      display: ["40px", { lineHeight: "46px", letterSpacing: "-0.02em" }],
      // Parcours Simple : 4 tailles seulement, texte courant à 16 px minimum.
      body: ["16px", { lineHeight: "24px" }],
      lead: ["18px", { lineHeight: "28px" }],
      title: ["24px", { lineHeight: "30px" }],
      hero: ["36px", { lineHeight: "42px", letterSpacing: "-0.01em" }],
    },
    // Peu de graisses : normal (400), moyen (500), titres (600).
    fontWeight: {
      thin: "400",
      extralight: "400",
      light: "400",
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "600",
      extrabold: "600",
      black: "600",
    },
    // Coins peu arrondis : 4 à 8 px (cercles conservés pour les pastilles et avatars).
    borderRadius: {
      none: "0",
      sm: "2px",
      DEFAULT: "4px",
      md: "6px",
      lg: "6px",
      xl: "8px",
      "2xl": "8px",
      "3xl": "8px",
      card: "8px",
      full: "9999px",
    },
    extend: {
      colors: {
        // Accent unique (sélection, action principale) et couleurs sémantiques discrètes.
        accent: { DEFAULT: token("accent"), strong: token("accent-strong") },
        success: token("success"),
        warning: token("warning"),
        danger: token("danger"),
        // Alias historiques → accent.
        brand: { from: token("surface-raised"), to: token("surface-raised"), accent: token("accent") },
        neon: { blue: token("accent"), "blue-strong": token("accent-strong"), coral: token("accent"), violet: token("accent") },
        // Surfaces neutres et textes.
        canvas: token("canvas"),
        surface: token("surface"),
        paper: token("paper"),
        line: token("line"),
        night: token("night"),
        fg: token("fg"),
        ink: { DEFAULT: token("ink"), soft: token("ink-soft"), mute: token("ink-mute") },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      // Ombres très légères, réservées aux menus et éléments flottants.
      boxShadow: {
        card: "none",
        soft: "none",
        float: "0 4px 16px -4px rgb(0 0 0 / 0.24), 0 0 0 1px rgb(var(--line))",
        neon: "none",
        "neon-coral": "none",
      },
      transitionDuration: { DEFAULT: "150ms" },
      transitionTimingFunction: { DEFAULT: "cubic-bezier(0.2, 0, 0, 1)" },
    },
  },
  plugins: [],
};

export default config;
