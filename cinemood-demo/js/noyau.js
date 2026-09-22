/* =====================================================================
   noyau.js — État partagé, rendu et briques d'interface.
   ---------------------------------------------------------------------
   Version statique : tout vit sur l'appareil (localStorage). Le moteur
   de recommandation est celui de l'app Next.js, porté tel quel dans
   moteur/ — aucune logique n'est réécrite ici.
   ===================================================================== */

import { CATALOGUE_DEMO } from '../moteur/catalogue.js';
import { PLATEFORME_PAR_ID } from '../moteur/plateformes.js';
import { historiqueVide, vecteurVide } from '../moteur/profil.js';
import { IDENTITE_HUMEUR, accentDe } from '../moteur/humeurs-ui.js';

export { CATALOGUE_DEMO, PLATEFORME_PAR_ID, IDENTITE_HUMEUR };

const CLE = 'cinemood.demo.v1';

/* ---------------------------------------------------------------------
   1. État.
   --------------------------------------------------------------------- */
const ETAT_INITIAL = {
  profil: null,
  historique: historiqueVide(),
  titresConnus: {},
  testTermine: false,
  plateformesChoisies: false,
};

export const etat = { ...ETAT_INITIAL };

/** Contexte du moment : humeur et compagnie, plus l'horloge. */
export const contexte = {
  humeur: null,
  compagnie: 'seul',
  heure: new Date().getHours(),
  jour: new Date().getDay(),
  maintenant: Date.now(),
};

export function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return;
    const lu = JSON.parse(brut);
    Object.assign(etat, {
      profil: lu.profil ?? null,
      historique: { ...historiqueVide(), ...(lu.historique ?? {}) },
      titresConnus: lu.titresConnus ?? {},
      testTermine: Boolean(lu.testTermine),
      plateformesChoisies: Boolean(lu.plateformesChoisies),
    });
  } catch {
    // Navigation privée, quota plein, données corrompues : on repart
    // d'un état vierge plutôt que de bloquer l'app.
  }
}

export function sauvegarder() {
  try {
    localStorage.setItem(CLE, JSON.stringify(etat));
  } catch {
    /* quota dépassé : l'app continue, seule la persistance est perdue */
  }
}

export function reinitialiser() {
  Object.assign(etat, ETAT_INITIAL, { historique: historiqueVide(), titresConnus: {} });
  try { localStorage.removeItem(CLE); } catch { /* rien à faire */ }
}

export function profilVierge() {
  return {
    pseudo: '', anneeNaissance: new Date().getFullYear() - 30,
    typesSouhaites: ['film', 'serie'], genresAdores: [], genresDetestes: [],
    tonalitePreferee: 'intense', dureeMax: null, languePreferee: 'indifferent',
    epoquePreferee: 'indifferent', animationOk: true, plateformes: [], pays: 'FR',
    gouts: vecteurVide(), aEviter: [], interets: [],
  };
}

/* ---------------------------------------------------------------------
   2. Rendu et navigation.
   --------------------------------------------------------------------- */
const vue = () => document.getElementById('vue');

/** Écrit du HTML dans la vue principale et remonte en haut. */
export function rendre(html, { onglets = false } = {}) {
  const cible = vue();
  cible.innerHTML = html;
  cible.classList.toggle('sans-onglets', !onglets);
  document.getElementById('onglets').hidden = !onglets;
  window.scrollTo(0, 0);
}

/** Échappe le texte inséré dans le HTML : les titres contiennent des « & ». */
export function txt(valeur) {
  return String(valeur ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Branche un gestionnaire sur tous les éléments correspondants. */
export function surClic(selecteur, gestionnaire) {
  for (const el of vue().querySelectorAll(selecteur)) {
    el.addEventListener('click', gestionnaire);
  }
}

export function aller(route) {
  if (location.hash === `#${route}`) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = route;
}

/* ---------------------------------------------------------------------
   3. Briques d'interface.
   --------------------------------------------------------------------- */

/** Empreinte stable : un même titre garde toujours la même affiche. */
function empreinte(texte) {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i += 1) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Affiche composée. Sans clé TMDB, on ne dispose d'aucune image : plutôt
 * qu'un rectangle gris, on compose une affiche typographique dont la
 * teinte découle du titre lui-même.
 */
export function affiche(titre, { grande = false, sansTexte = false } = {}) {
  const graine = empreinte(titre.id + titre.titre);
  const teinte = graine % 360;
  // Duotone franc plutôt qu'un gris teinté : sans vraie affiche TMDB,
  // c'est la couleur qui doit porter l'écran. Deux teintes voisines,
  // une tache lumineuse en haut, et le noir qui reprend le dessous.
  const fond = `radial-gradient(90% 60% at 22% 8%, hsl(${teinte} 85% 46% / 0.95) 0%, transparent 62%),`
    + `linear-gradient(152deg, hsl(${teinte} 72% 30%) 0%, hsl(${(teinte + 38) % 360} 68% 17%) 52%, hsl(${(teinte + 66) % 360} 60% 8%) 100%)`;
  const trait = `hsl(${teinte} 90% 70%)`;
  // Dans une carte, le titre est déjà écrit par-dessus le dégradé : une
  // seconde fois dans l'affiche, il se dédoublait et passait sous la
  // pastille de plateforme. L'affiche devient alors un aplat travaillé,
  // signé de l'initiale du titre et de l'emblème de l'app.
  if (sansTexte) {
    const initiale = (titre.titre.match(/\p{L}/u)?.[0] ?? '?').toUpperCase();
    return `<div class="affiche grain" style="background:${fond}" role="img" aria-label="Affiche de ${txt(titre.titre)}">
        <div class="trait" style="background:${trait}"></div>
        <span class="initiale" aria-hidden="true">${txt(initiale)}</span>
        <svg viewBox="0 0 40 40" class="filigrane" aria-hidden="true">
          <circle cx="20" cy="20" r="18" fill="none" stroke="${trait}" stroke-width="0.8"/>
          ${[0, 60, 120, 180, 240, 300].map((a) =>
            `<path d="M20 20 L20 4 A16 16 0 0 1 33.9 12 Z" fill="${trait}" opacity="0.22" transform="rotate(${a} 20 20)"/>`).join('')}
          <circle cx="20" cy="20" r="4.6" fill="rgba(7,6,10,0.9)"/>
        </svg>
      </div>`;
  }

  return `<div class="affiche grain" style="background:${fond}" role="img" aria-label="Affiche de ${txt(titre.titre)}">
      <div class="trait" style="background:${trait}"></div>
      <div>
        <p class="nom" style="font-size:${grande ? '2rem' : '1.05rem'}">${txt(titre.titre)}</p>
        <p class="meta" style="font-size:${grande ? '12px' : '10px'}">${titre.annee} · ${titre.type === 'film' ? 'FILM' : 'SÉRIE'}</p>
      </div>
    </div>`;
}

/** Pastille de plateforme : aucun logo de marque n'est embarqué. */
export function pastille(id, taille = '') {
  const p = PLATEFORME_PAR_ID[id];
  if (!p) return '';
  return `<span class="pastille ${taille}" style="background:${p.couleur}" title="${txt(p.nom)}">
      ${txt(p.initiales || p.nom.slice(0, 2))}<span class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">${txt(p.nom)}</span>
    </span>`;
}

/** Durée lisible : 154 → « 2 h 34 ». */
export function format(titre) {
  if (titre.type === 'serie') return titre.saisons ? `${titre.saisons} saison${titre.saisons > 1 ? 's' : ''}` : 'Série';
  if (!titre.duree) return 'Film';
  return `${Math.floor(titre.duree / 60)} h ${String(titre.duree % 60).padStart(2, '0')}`;
}

export function classificationLisible(c) {
  return c === 'TP' ? 'Tous publics' : `-${c}`;
}

export const ICONES = {
  accueil: 'M3 11.2 12 4l9 7.2M5.6 9.6V20h12.8V9.6',
  decouvrir: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM20 20l-4.2-4.2',
  liste: 'M6.5 3.5h11v17l-5.5-4-5.5 4v-17Z',
  profil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c1.3-3.6 4.1-5.5 7.5-5.5s6.2 1.9 7.5 5.5',
  croix: 'M6 6l12 12M18 6L6 18',
  pouce: 'M7 10.5V20H4V10.5h3Zm3 0 3.2-6.6a1.8 1.8 0 0 1 3.4 1.1L16 9h3.6a1.8 1.8 0 0 1 1.75 2.25l-1.7 6.6A2.4 2.4 0 0 1 17.3 20H10V10.5Z',
  fleche: 'M14.5 5 8 12l6.5 7',
  chevron: 'M9.5 5 16 12l-6.5 7',
  coche: 'M5 12.5 10 17.5 19 7',
  lecture: 'M8 5.2v13.6L19 12 8 5.2Z',
  plus: 'M12 5v14M5 12h14',
};

export function icone(nom, extra = '') {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}><path d="${ICONES[nom]}"/></svg>`;
}

/* ---------------------------------------------------------------------
   3 bis. Couleur d'humeur.
   ---------------------------------------------------------------------
   Toute la direction artistique tient sur deux variables CSS. Les poser
   sur <html> suffit à repeindre l'app entière : halo, boutons, bordures,
   ombres, barre d'onglets. Les valeurs viennent du module partagé avec
   l'app Next.js — aucune couleur n'est écrite en dur ici.
   --------------------------------------------------------------------- */
export function appliquerAccent(humeur) {
  const { accent, second } = accentDe(humeur ?? null);
  const racine = document.documentElement;
  racine.style.setProperty('--accent', accent);
  racine.style.setProperty('--second', second);
  // La barre d'état d'iOS se met au diapason quand l'app est installée.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#06040B');
}

/** L'icône dessinée d'une humeur, sur la même grille 24 × 24. */
export function iconeHumeur(cle, extra = '') {
  const identite = IDENTITE_HUMEUR[cle];
  if (!identite) return '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}><path d="${identite.icone}"/></svg>`;
}

/* ---------------------------------------------------------------------
   4. Barre d'onglets.
   --------------------------------------------------------------------- */
const ONGLETS = [
  ['/accueil', 'Accueil', 'accueil'],
  ['/decouvrir', 'Découvrir', 'decouvrir'],
  ['/ma-liste', 'Ma liste', 'liste'],
  ['/profil', 'Profil', 'profil'],
];

export function dessinerOnglets(routeActive) {
  const nav = document.getElementById('onglets');
  nav.innerHTML = `<ul>${ONGLETS.map(([route, libelle, ic]) => `
      <li><button type="button" data-route="${route}" ${route === routeActive ? 'aria-current="page"' : ''}>
        ${icone(ic)}<span>${libelle}</span>
      </button></li>`).join('')}</ul>`;
  for (const b of nav.querySelectorAll('button')) {
    b.addEventListener('click', () => aller(b.dataset.route));
  }
}

/* ---------------------------------------------------------------------
   5. Lecteur de bande-annonce.
   --------------------------------------------------------------------- */
export function ouvrirBandeAnnonce(titre) {
  const modale = document.getElementById('modale');
  const recherche = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${titre.titre} ${titre.annee} bande-annonce`)}`;

  // Sans clé TMDB, aucune vidéo n'est connue : on bascule proprement
  // vers une recherche YouTube plutôt que d'afficher un lecteur vide.
  const corps = titre.bandeAnnonce
    ? `<div style="width:100%;max-width:720px;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:#000">
         <iframe style="width:100%;height:100%;border:0"
           src="https://www.youtube-nocookie.com/embed/${txt(titre.bandeAnnonce)}?autoplay=1&playsinline=1&rel=0&modestbranding=1"
           title="Bande-annonce de ${txt(titre.titre)}"
           allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
           allowfullscreen></iframe>
       </div>`
    : `<div class="centre" style="padding-inline:32px">
         <p  style="font-size:26px">Bande-annonce indisponible ici</p>
         <p class="cendre" style="margin-top:12px;font-size:15px;line-height:1.6;max-width:24rem;margin-inline:auto">
           Cette démonstration tourne sur un catalogue local : elle ne connaît pas les vidéos TMDB.
           Un seul appui pour l’ouvrir sur YouTube.
         </p>
         <a class="bouton accent" style="margin-top:24px;text-decoration:none" href="${recherche}" target="_blank" rel="noreferrer noopener">
           Chercher sur YouTube
         </a>
       </div>`;

  modale.innerHTML = `<div class="lecteur" role="dialog" aria-modal="true" aria-label="Bande-annonce de ${txt(titre.titre)}">
      <header>
        <p  style="font-size:19px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:16px">${txt(titre.titre)}</p>
        <button type="button" class="rond" id="fermer-lecteur" aria-label="Fermer la bande-annonce">${icone('croix', 'stroke-width="1.8"')}</button>
      </header>
      <div class="corps">${corps}</div>
    </div>`;

  const precedent = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  const fermer = () => {
    modale.innerHTML = '';
    document.body.style.overflow = precedent;
    window.removeEventListener('keydown', auClavier);
  };
  const auClavier = (e) => { if (e.key === 'Escape') fermer(); };
  window.addEventListener('keydown', auClavier);
  document.getElementById('fermer-lecteur').addEventListener('click', fermer);
}

/* ---------------------------------------------------------------------
   6. Squelettes : jamais d'écran vide.
   --------------------------------------------------------------------- */
export function squeletteCartes(n = 2) {
  return Array.from({ length: n }, () => `
    <div class="verre" style="border-radius:20px;overflow:hidden">
      <div class="squelette" style="aspect-ratio:2/3;border-radius:0"></div>
      <div style="padding:16px">
        <div class="squelette" style="height:20px;width:70%"></div>
        <div class="squelette" style="height:12px;width:45%;margin-top:10px"></div>
        <div class="squelette" style="height:12px;width:90%;margin-top:10px"></div>
      </div>
    </div>`).join('');
}
