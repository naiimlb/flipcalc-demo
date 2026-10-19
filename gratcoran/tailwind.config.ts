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
          "var(--font-sans)",
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
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        pop: { from: { opacity: "0", transform: "scale(0.92)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        rise: "rise 0.32s cubic-bezier(0.22, 1, 0.36, 1) both",
        pop: "pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
      backgroundImage: {
        brand: "linear-gradient(135deg, #10b981 0%, #0ea5a4 45%, #2563eb 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
