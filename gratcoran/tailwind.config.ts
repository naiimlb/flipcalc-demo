import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        elevated: "rgb(var(--elevated) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        emerald: { DEFAULT: "#10b981", deep: "#059669" },
        sea: { DEFAULT: "#2563eb", light: "#3b82f6" },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "system-ui",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        quran: ["var(--font-quran)", "serif"],
      },
      backgroundImage: {
        brand: "linear-gradient(135deg, #10b981 0%, #0ea5a4 45%, #2563eb 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
