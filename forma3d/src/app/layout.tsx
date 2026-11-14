import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import { PreferencesProvider } from "@/components/app/Preferences";
import { RegisterServiceWorker } from "@/components/app/RegisterServiceWorker";
import { UpdateNotifier } from "@/components/app/UpdateNotifier";
import { getPublicSettings } from "@/lib/settings.server";
import { LANG_COOKIE, dirOf, isLocale, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { getSession } from "@/lib/supabase/server";
import { DEFAULT_THEME, THEME_BOOT_SCRIPT, THEME_COOKIE, isThemeChoice, type ThemeChoice } from "@/lib/theme";
import "./globals.css";

// Polices auto-hébergées (licence OFL, fichiers dans src/app/fonts) : le build ne dépend d'aucun service externe.
// Interface : Inter (police variable 400 à 600). Valeurs numériques : JetBrains Mono.
const uiFont = localFont({
  src: "./fonts/Inter-latin-var.woff2",
  weight: "400 600",
  display: "swap",
  variable: "--font-sans",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});
const monoFont = localFont({
  src: "./fonts/JetBrainsMono-latin-var.woff2",
  weight: "400 500",
  display: "swap",
  variable: "--font-mono",
  // Petites valeurs seulement : pas de préchargement (le premier affichage reste léger).
  preload: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

/** Écrans de lancement iOS : un par taille d'appareil (largeur × hauteur en pixels CSS, densité). */
const STARTUP_SIZES: [number, number, number][] = [
  // iPhone (portrait)
  [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [375, 812, 3], [414, 896, 2], [375, 667, 2],
];
const STARTUP_IPADS: [number, number, number][] = [
  [1024, 1366, 2], [834, 1194, 2], [820, 1180, 2], [834, 1112, 2], [768, 1024, 2], [744, 1133, 2], [810, 1080, 2],
];
const STARTUP_IMAGES = [
  ...STARTUP_SIZES.map(([w, h, r]) => ({
    url: `/splash/${w * r}x${h * r}.png`,
    media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
  })),
  ...STARTUP_IPADS.flatMap(([w, h, r]) => [
    {
      url: `/splash/${w * r}x${h * r}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`,
    },
    {
      url: `/splash/${h * r}x${w * r}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: landscape)`,
    },
  ]),
];

export async function generateMetadata(): Promise<Metadata> {
  const { site } = await getPublicSettings();
  return {
    title: { default: site.siteName, template: `%s · ${site.siteName}` },
    description: site.heroSubtitle,
    applicationName: site.siteName,
    icons: { icon: site.logoDataUrl ?? "/icon.svg", apple: "/icons/apple-touch-icon.png" },
    // Installation sur l'écran d'accueil (iPad / iPhone) : plein écran, écran de lancement aux couleurs du site.
    appleWebApp: { capable: true, title: site.siteName, statusBarStyle: "black-translucent", startupImage: STARTUP_IMAGES },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#111214",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Langue et thème : choix mémorisé (cookie), sinon celui du compte, sinon détection automatique.
  const store = await cookies();
  const themeCookie = store.get(THEME_COOKIE)?.value;
  const langCookie = store.get(LANG_COOKIE)?.value;
  // Thème sombre par défaut (identité Forma3D) ; « auto » et « clair » restent au choix.
  let theme: ThemeChoice = isThemeChoice(themeCookie) ? themeCookie : DEFAULT_THEME;
  let locale: Locale = await getLocale();
  if (!isThemeChoice(themeCookie) || !isLocale(langCookie)) {
    const session = await getSession().catch(() => null);
    if (session) {
      // Colonnes ajoutées par le script SQL de la phase 4 : sans lui, la requête échoue et on garde les valeurs par défaut.
      const { data } = await session.supabase.from("profiles").select("theme, language").eq("id", session.user.id).maybeSingle();
      const row = data as { theme?: string; language?: string } | null;
      // « auto » est la valeur par défaut de la colonne : seul un choix explicite (clair / sombre) remplace le défaut.
      if (!isThemeChoice(themeCookie) && (row?.theme === "light" || row?.theme === "dark")) theme = row.theme;
      if (!isLocale(langCookie) && isLocale(row?.language)) locale = row.language;
    }
  }

  return (
    <html lang={locale} dir={dirOf(locale)} className={`${uiFont.variable} ${monoFont.variable}${theme === "dark" ? " dark" : ""}`} data-theme={theme} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <PreferencesProvider initialLocale={locale} initialTheme={theme}>
          {children}
          <UpdateNotifier />
          <RegisterServiceWorker />
        </PreferencesProvider>
      </body>
    </html>
  );
}
