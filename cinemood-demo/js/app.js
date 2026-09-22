/* =====================================================================
   app.js — Amorçage et routage.
   ---------------------------------------------------------------------
   Routage par ancre (#/accueil) : GitHub Pages sert des fichiers
   statiques, sans réécriture d'URL possible.
   ===================================================================== */

import { charger, etat, rendre } from './noyau.js';
import { accueil, decouvrir, humeur, maListe, plateformes, profil, test, vitrine } from './ecrans.js';

charger();

const ROUTES = {
  '/': vitrine,
  '/plateformes': plateformes,
  '/test': test,
  '/accueil': accueil,
  '/humeur': humeur,
  '/decouvrir': decouvrir,
  '/ma-liste': () => maListe(),
  '/profil': profil,
};

/** Les deux étapes d'installation sont obligatoires avant l'app. */
function routeAutorisee(route) {
  if (['/', '/plateformes', '/test'].includes(route)) return route;
  if (!etat.plateformesChoisies) return '/plateformes';
  if (!etat.testTermine) return '/test';
  return route;
}

function router() {
  const demandee = location.hash.slice(1) || '/';
  const route = routeAutorisee(ROUTES[demandee] ? demandee : '/');

  if (route !== demandee) {
    location.hash = route;
    return;
  }
  try {
    ROUTES[route]();
  } catch (erreur) {
    console.error(erreur);
    rendre(`<div class="pad centre" style="padding-top:25vh">
        <h1 style="font-size:28px">Quelque chose a lâché</h1>
        <p class="cendre" style="margin-top:12px;font-size:15px;line-height:1.6">
          Recharge la page. Si ça recommence, efface tes données depuis le profil.</p>
      </div>`);
  }
}

window.addEventListener('hashchange', router);

// Quelqu'un qui a déjà tout configuré n'a rien à faire sur la vitrine.
if (!location.hash && etat.plateformesChoisies && etat.testTermine) location.hash = '/accueil';
router();
