import type { Config } from 'tailwindcss';

/* =====================================================================
   Le système de design de CinéMood.
   ---------------------------------------------------------------------
   Noir teinté violet, trois couleurs signature (violet électrique, rose
   néon, cyan), et une couleur d'accent variable : c'est l'humeur choisie
   qui la fixe, via les variables CSS `--accent` et `--second` posées sur
   la racine (voir globals.css et src/lib/ui/humeurs.ts).

   Les utilitaires `accent` ci-dessous lisent ces variables : une classe
   comme `border-accent/40` suit donc automatiquement l'humeur du moment.
   ===================================================================== */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Fonds, du plus profond au plus clair.
        nuit: '#06040B',
        encre: '#0C0918',
        ardoise: '#141126',
        fumee: '#1D1833',
        // Palette signature.
        violet: '#7B2CFF',
        violetClair: '#A46BFF',
        rose: '#FF2E93',
        roseClair: '#FF6FB4',
        cyan: '#22D9F0',
        // Accent piloté par l'humeur.
        accent: 'rgb(var(--accent) / <alpha-value>)',
        second: 'rgb(var(--second) / <alpha-value>)',
        accentTexte: 'var(--accent-texte)',
        // Textes. Contraste sur `nuit` : 18:1, 8,4:1 et 4,8:1.
        ivoire: '#F6F4FF',
        cendre: '#A9A3C4',
        estompe: '#7D76A0',
        // Sémantique.
        succes: '#12C8C0',
        alerte: '#FF6B4A',
      },
      fontFamily: {
        // Injectées par next/font dans src/app/layout.tsx.
        affiche: ['var(--police-affiche)', 'Arial Narrow', 'system-ui', 'sans-serif'],
        texte: ['var(--police-texte)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        douce: '14px',
        carte: '20px',
        large: '28px',
      },
      boxShadow: {
        carte: '0 22px 50px -26px rgba(0,0,0,0.95)',
        flottant: '0 14px 34px -16px rgba(0,0,0,0.85)',
        // Ombres colorées : ce qui fait « flotter » les éléments actifs.
        accent: '0 12px 34px -12px rgb(var(--accent) / 0.8)',
        halo: '0 14px 40px -16px rgb(var(--accent) / 0.9)',
      },
      backgroundImage: {
        'voile-accent': 'linear-gradient(100deg, rgb(var(--accent)) 0%, rgb(var(--second)) 100%)',
        'voile-nuit': 'linear-gradient(180deg, rgba(6,4,11,0) 0%, rgba(6,4,11,0.75) 55%, #06040B 100%)',
      },
      keyframes: {
        chatoiement: {
          '0%': { backgroundPosition: '-480px 0' },
          '100%': { backgroundPosition: '480px 0' },
        },
        monte: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        entreeEcran: {
          '0%': { opacity: '0', transform: 'scale(1.012)' },
          '100%': { opacity: '1', transform: 'none' },
        },
        respire: {
          '0%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1.1)' },
        },
      },
      animation: {
        chatoiement: 'chatoiement 1.5s linear infinite',
        monte: 'monte 0.42s cubic-bezier(0.22,0.61,0.36,1) both',
        entreeEcran: 'entreeEcran 0.24s ease-out both',
        respire: 'respire 26s ease-in-out infinite alternate',
      },
      spacing: {
        // Zones sûres iPhone (encoche et barre d'accueil).
        'sur-encoche': 'env(safe-area-inset-top)',
        'sous-barre': 'env(safe-area-inset-bottom)',
      },
    },
  },
  plugins: [],
};

export default config;
