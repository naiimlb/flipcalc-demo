import type { Config } from 'tailwindcss';

/* =====================================================================
   Le système de design de CinéMood tient dans ce fichier.
   Noir profond, accents dorés, verre dépoli : l'app doit avoir l'air
   d'un service payant, pas d'un template.
   ===================================================================== */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Fonds, du plus profond au plus clair.
        nuit: '#07060A',
        encre: '#0D0C12',
        ardoise: '#15141C',
        fumee: '#1E1C26',
        // Accents champagne / doré.
        or: '#D8BD85',
        orClair: '#F0DFBB',
        orSombre: '#9C8355',
        // Textes.
        ivoire: '#F7F5F1',
        cendre: '#A29C93',
        estompe: '#6B665F',
        // Sémantique.
        succes: '#6FCF97',
        alerte: '#E88A6B',
      },
      fontFamily: {
        // Injectées par next/font dans src/app/layout.tsx.
        titre: ['var(--police-titre)', 'Georgia', 'serif'],
        texte: ['var(--police-texte)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        douce: '14px',
        carte: '20px',
        large: '28px',
      },
      boxShadow: {
        carte: '0 18px 40px -20px rgba(0,0,0,0.9)',
        flottant: '0 10px 30px -12px rgba(0,0,0,0.8)',
        or: '0 8px 26px -10px rgba(216,189,133,0.45)',
      },
      backgroundImage: {
        'voile-or': 'linear-gradient(135deg, #F0DFBB 0%, #D8BD85 45%, #9C8355 100%)',
        'voile-nuit': 'linear-gradient(180deg, rgba(7,6,10,0) 0%, rgba(7,6,10,0.75) 55%, #07060A 100%)',
        'lueur': 'radial-gradient(120% 90% at 50% 0%, rgba(216,189,133,0.16) 0%, rgba(7,6,10,0) 60%)',
      },
      keyframes: {
        chatoiement: {
          '0%': { backgroundPosition: '-480px 0' },
          '100%': { backgroundPosition: '480px 0' },
        },
        apparition: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulsationDouce: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        chatoiement: 'chatoiement 1.5s linear infinite',
        apparition: 'apparition 0.4s ease-out both',
        pulsationDouce: 'pulsationDouce 1.8s ease-in-out infinite',
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
