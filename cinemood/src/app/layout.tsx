import type { Metadata, Viewport } from 'next';
import { Inter, Oswald } from 'next/font/google';

import { FournisseurApp } from '@/lib/etat/magasin';
import { ReglagesPWA } from '@/components/ReglagesPWA';
import './globals.css';

/* Condensée grasse pour les titres — le registre de l'affiche de cinéma —
   et sans-serif moderne pour le texte courant. Oswald a de vraies
   graisses : si le réseau lâche, la police de repli reste grasse et la
   mise en page ne s'effondre pas. */
const policeTitre = Oswald({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--police-affiche',
  display: 'swap',
});

const policeTexte = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--police-texte',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CinéMood — ce que tu devrais regarder ce soir',
  description:
    'CinéMood choisit un film ou une série selon ton humeur, ta génération et les plateformes auxquelles tu es abonné. Plus jamais quarante minutes à faire défiler un catalogue.',
  applicationName: 'CinéMood',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'CinéMood',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/icons/icone.svg', type: 'image/svg+xml' },
      { url: '/icons/icone-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icone-180.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
  other: { 'mobile-web-app-capable': 'yes' },
};

export const viewport: Viewport = {
  themeColor: '#06040B',
  width: 'device-width',
  initialScale: 1,
  // Indispensable pour que les zones sûres iOS soient exploitables.
  viewportFit: 'cover',
  // On laisse le zoom manuel : l'interdire est un problème d'accessibilité.
  maximumScale: 5,
  userScalable: true,
};

export default function RacineLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${policeTitre.variable} ${policeTexte.variable}`}>
      <body className="min-h-[100dvh] bg-nuit">
        <ReglagesPWA />
        <FournisseurApp>{children}</FournisseurApp>
      </body>
    </html>
  );
}
