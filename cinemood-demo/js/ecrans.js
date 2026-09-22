/* =====================================================================
   ecrans.js — Les écrans de CinéMood (version statique).
   ===================================================================== */

import { recommander, classerPourDecouverte } from '../moteur/moteur.js';
import { appliquerSignal, construireProfilDepuisTest, enregistrerExpositions, enregistrerSignal } from '../moteur/profil.js';
import { profilCinema, LIBELLE_TONALITE } from '../moteur/explication.js';
import { generation } from '../moteur/epoque.js';
import { PLATEFORMES } from '../moteur/plateformes.js';
import { TABLE_COMPAGNIE, TABLE_HUMEURS } from '../moteur/poids.js';
import {
  CATALOGUE_DEMO, PLATEFORME_PAR_ID, affiche, aller, classificationLisible, contexte,
  dessinerOnglets, etat, format, icone, ouvrirBandeAnnonce, pastille, profilVierge,
  reinitialiser, rendre, sauvegarder, squeletteCartes, surClic, txt,
} from './noyau.js';

const ANNEE = new Date().getFullYear();

const GENRES = ['Action', 'Animation', 'Aventure', 'Comédie', 'Crime', 'Documentaire', 'Drame',
  'Familial', 'Fantastique', 'Guerre', 'Histoire', 'Horreur', 'Musique', 'Mystère', 'Romance',
  'Science-Fiction', 'Thriller', 'Western'];

/* =====================================================================
   Vitrine publique.
   ===================================================================== */
export function vitrine() {
  const arguments_ = [
    ['Tes plateformes, uniquement', 'Jamais un titre que tu ne peux pas lancer dans la minute.'],
    ['Ton humeur du soir', 'Fatigué, remonté à bloc, besoin de rire : la sélection change vraiment.'],
    ['Ta génération', 'Ce qui est sorti quand tu avais quinze ans compte autant que les nouveautés.'],
  ];

  rendre(`<div class="grain" style="position:absolute;inset:0;pointer-events:none"></div>
    <div class="pad" style="min-height:100dvh;display:flex;flex-direction:column;padding-top:max(env(safe-area-inset-top),32px)">
      <header style="display:flex;align-items:center;gap:12px">
        ${logo()}<span class="serif" style="font-size:22px;letter-spacing:0.02em">Ciné<span class="texte-or">Mood</span></span>
      </header>

      <section style="flex:1;display:flex;flex-direction:column;justify-content:center;padding-block:36px">
        <h1 class="apparition" style="font-size:clamp(38px,11vw,50px);font-weight:300;text-wrap:balance">
          Arrête de chercher.<br><span class="texte-or">Commence à regarder.</span>
        </h1>
        <p class="cendre apparition" style="margin-top:18px;font-size:16px;line-height:1.6;max-width:28rem">
          CinéMood choisit pour toi un film ou une série, selon ton humeur du moment, ce que tu as
          aimé jusqu’ici et les plateformes auxquelles tu es réellement abonné.
        </p>
        <ul class="apparition" style="margin-top:28px;list-style:none">
          ${arguments_.map(([t, d]) => `<li style="display:flex;gap:16px;margin-top:20px">
            <span style="margin-top:9px;height:1px;width:28px;flex:0 0 auto;background:var(--voile-or)"></span>
            <div><p style="font-size:15px;font-weight:500">${t}</p>
            <p class="muet" style="margin-top:2px">${d}</p></div></li>`).join('')}
        </ul>
      </section>

      <footer style="padding-bottom:max(env(safe-area-inset-bottom),32px)">
        <button class="bouton or large" id="commencer" style="min-height:56px;font-size:17px">Commencer</button>
        <p class="muet centre" style="margin-top:16px">
          Deux minutes de questions, et CinéMood te connaît mieux qu’un algorithme de catalogue.
        </p>
      </footer>
    </div>`);

  surClic('#commencer', () => aller('/plateformes'));
}

function logo() {
  return `<svg viewBox="0 0 40 40" style="width:36px;height:36px" role="img" aria-label="Logo CinéMood">
    <defs><linearGradient id="dl" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F0DFBB"/><stop offset="60%" stop-color="#D8BD85"/><stop offset="100%" stop-color="#9C8355"/>
    </linearGradient></defs>
    <circle cx="20" cy="20" r="18" fill="none" stroke="url(#dl)" stroke-width="1.4"/>
    ${[0, 60, 120, 180, 240, 300].map((a) =>
      `<path d="M20 20 L20 4 A16 16 0 0 1 33.9 12 Z" fill="url(#dl)" opacity="${(0.16 + (a / 360) * 0.5).toFixed(2)}" transform="rotate(${a} 20 20)"/>`).join('')}
    <circle cx="20" cy="20" r="4.6" fill="#07060A"/></svg>`;
}

/* =====================================================================
   Étape 1 — Plateformes (obligatoire).
   ===================================================================== */
export function plateformes() {
  let selection = [...(etat.profil?.plateformes ?? [])];
  let sansAbonnement = false;
  let pays = etat.profil?.pays ?? 'FR';

  const PAYS = [['FR', 'France'], ['BE', 'Belgique'], ['CH', 'Suisse'], ['CA', 'Canada'], ['LU', 'Luxembourg']];
  const vignette = (p) => `<button type="button" class="tactile" data-plateforme="${p.id}"
      aria-pressed="false" style="display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:10px;min-height:88px;border-radius:18px;padding-inline:6px;cursor:pointer;
      border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.025);color:var(--estompe);transition:all .15s">
      ${pastille(p.id, 'grande')}<span style="font-size:11.5px;text-align:center;line-height:1.25">${txt(p.nom)}</span>
    </button>`;

  rendre(`<div class="pad" style="padding-top:40px;padding-bottom:180px">
      <p style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(216,189,133,0.7)">Étape 1 sur 2</p>
      <h1 style="margin-top:12px;font-size:40px;text-wrap:balance">Quelles plateformes as-tu ?</h1>
      <p class="cendre" style="margin-top:12px;font-size:15px;line-height:1.6">
        CinéMood ne te proposera jamais un titre indisponible sur tes services.
        Tu pourras modifier ça quand tu veux.
      </p>

      <h2 style="margin-top:36px;font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:var(--estompe);font-family:Inter,sans-serif">Abonnements</h2>
      <div class="grille-3" style="margin-top:16px">${PLATEFORMES.filter((p) => !p.gratuite).map(vignette).join('')}</div>

      <h2 style="margin-top:36px;font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:var(--estompe);font-family:Inter,sans-serif">Gratuit, sans abonnement</h2>
      <p class="muet" style="margin-top:4px">Coche-les aussi : il y a de vraies pépites.</p>
      <div class="grille-3" style="margin-top:16px">${PLATEFORMES.filter((p) => p.gratuite).map(vignette).join('')}</div>

      <button type="button" id="aucun" aria-pressed="false" style="margin-top:28px;display:flex;align-items:center;gap:14px;
        width:100%;min-height:58px;border-radius:14px;padding-inline:20px;text-align:left;cursor:pointer;
        border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.02);color:var(--cendre)">
        <span id="coche" style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;
          flex:0 0 auto;border-radius:7px;border:1px solid rgba(255,255,255,0.2)"></span>
        <span>Je n’ai aucun abonnement
          <span class="muet" style="display:block;margin-top:2px">Recommandations sur les offres gratuites uniquement</span>
        </span>
      </button>

      <h2 style="margin-top:36px;font-size:13px;letter-spacing:0.16em;text-transform:uppercase;color:var(--estompe);font-family:Inter,sans-serif">Mon pays</h2>
      <p class="muet" style="margin-top:4px">Il détermine les disponibilités et les classifications d’âge.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:16px">
        ${PAYS.map(([code, nom]) => `<button type="button" class="puce" data-pays="${code}" aria-pressed="${code === pays}">${nom}</button>`).join('')}
      </div>
    </div>

    <div class="barre-bas verre-fort"><div>
      <button class="bouton or large" id="continuer" disabled>Continuer</button>
      <p class="muet centre" id="compte" style="margin-top:10px">Sélectionne au moins une plateforme</p>
    </div></div>`);

  const rafraichir = () => {
    for (const b of document.querySelectorAll('[data-plateforme]')) {
      const actif = !sansAbonnement && selection.includes(b.dataset.plateforme);
      b.setAttribute('aria-pressed', String(actif));
      b.style.borderColor = actif ? 'rgba(216,189,133,0.6)' : 'rgba(255,255,255,0.07)';
      b.style.background = actif ? 'rgba(216,189,133,0.1)' : 'rgba(255,255,255,0.025)';
      b.style.color = actif ? 'var(--or-clair)' : 'var(--estompe)';
    }
    const aucun = document.getElementById('aucun');
    aucun.setAttribute('aria-pressed', String(sansAbonnement));
    aucun.style.borderColor = sansAbonnement ? 'rgba(216,189,133,0.6)' : 'rgba(255,255,255,0.08)';
    aucun.style.background = sansAbonnement ? 'rgba(216,189,133,0.1)' : 'rgba(255,255,255,0.02)';
    document.getElementById('coche').innerHTML = sansAbonnement
      ? `<svg viewBox="0 0 24 24" style="width:16px;height:16px" fill="none" stroke="#07060A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17.5 19 7"/></svg>` : '';
    document.getElementById('coche').style.background = sansAbonnement ? 'var(--or)' : 'transparent';
    document.getElementById('coche').style.borderColor = sansAbonnement ? 'var(--or)' : 'rgba(255,255,255,0.2)';

    const peut = sansAbonnement || selection.length > 0;
    document.getElementById('continuer').disabled = !peut;
    document.getElementById('compte').textContent = !peut
      ? 'Sélectionne au moins une plateforme'
      : sansAbonnement ? 'Offres gratuites uniquement'
      : `${selection.length} plateforme${selection.length > 1 ? 's' : ''} sélectionnée${selection.length > 1 ? 's' : ''}`;
  };

  surClic('[data-plateforme]', (e) => {
    const id = e.currentTarget.dataset.plateforme;
    sansAbonnement = false;
    selection = selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id];
    rafraichir();
  });
  surClic('#aucun', () => { sansAbonnement = !sansAbonnement; selection = []; rafraichir(); });
  surClic('[data-pays]', (e) => {
    pays = e.currentTarget.dataset.pays;
    for (const b of document.querySelectorAll('[data-pays]')) b.setAttribute('aria-pressed', String(b.dataset.pays === pays));
  });
  surClic('#continuer', () => {
    etat.profil = { ...(etat.profil ?? profilVierge()), plateformes: sansAbonnement ? [] : selection, pays };
    etat.plateformesChoisies = true;
    sauvegarder();
    aller('/test');
  });

  rafraichir();
}

/* =====================================================================
   Étape 2 — Test de personnalité, dix écrans.
   ===================================================================== */
const NB_ECRANS = 10;

export function test() {
  let etape = 0;
  const b = {
    pseudo: etat.profil?.pseudo ?? '', anneeNaissance: etat.profil?.anneeNaissance ?? null,
    genrePersonne: '', typesSouhaites: ['film', 'serie'], genresAdores: [], genresDetestes: [],
    favoris: [], enfance: [], tonalitePreferee: null, dureeMax: null,
    languePreferee: 'indifferent', epoquePreferee: 'indifferent', animationOk: true,
    interets: '', aEviter: '',
  };

  const grilleFavoris = echantillonVarie(CATALOGUE_DEMO, 24);

  const valide = () => [
    b.pseudo.trim().length >= 1,
    b.anneeNaissance !== null && b.anneeNaissance >= 1920 && b.anneeNaissance <= ANNEE - 5,
    true, b.typesSouhaites.length > 0, true, b.favoris.length >= 1, true,
    b.tonalitePreferee !== null, true, true,
  ][etape];

  function dessiner() {
    rendre(`<div class="verre-fort" style="position:sticky;top:0;z-index:30;padding:20px 20px 16px;padding-top:max(env(safe-area-inset-top),20px)">
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--estompe)">
          <button type="button" id="retour" style="display:flex;align-items:center;gap:4px;background:none;border:none;
            color:var(--cendre);cursor:pointer;margin-left:-8px;padding-inline:8px;font-size:12px">
            ${icone('fleche', 'style="width:16px;height:16px"')} Retour
          </button>
          <span>${etape + 1} / ${NB_ECRANS}</span>
        </div>
        <div class="progression" style="margin-top:12px"><i style="width:${((etape + 1) / NB_ECRANS) * 100}%"></i></div>
      </div>

      <div class="pad apparition" style="padding-top:32px;padding-bottom:140px">${contenu()}</div>

      <div class="barre-bas verre-fort"><div>
        <button class="bouton or large" id="suivant" ${valide() ? '' : 'disabled'}>
          ${etape === NB_ECRANS - 1 ? 'Voir mon profil cinéma' : 'Continuer'}
        </button>
      </div></div>`, { onglets: false });

    brancher();
  }

  function question(titre, sousTitre, corps) {
    return `<h1 style="font-size:35px;text-wrap:balance">${titre}</h1>
      ${sousTitre ? `<p class="cendre" style="margin-top:12px;font-size:15px;line-height:1.6">${sousTitre}</p>` : ''}
      <div style="margin-top:28px">${corps}</div>`;
  }

  const puces = (liste, actifs, attribut) => liste.map((x) =>
    `<button type="button" class="puce" data-${attribut}="${txt(String(x))}" aria-pressed="${actifs.includes(x)}">${txt(String(x))}</button>`).join('');

  const grandChoix = (options, estActif, attribut) => options.map(([valeur, libelle, detail]) =>
    `<button type="button" data-${attribut}="${valeur}" aria-pressed="${estActif(valeur)}"
      style="display:block;width:100%;border-radius:18px;padding:16px 20px;text-align:left;cursor:pointer;margin-top:12px;
      border:1px solid ${estActif(valeur) ? 'rgba(216,189,133,0.6)' : 'rgba(255,255,255,0.08)'};
      background:${estActif(valeur) ? 'rgba(216,189,133,0.1)' : 'rgba(255,255,255,0.025)'}">
      <span style="font-size:17px;color:var(--ivoire)">${libelle}</span>
      <span class="muet" style="display:block;margin-top:4px">${detail}</span></button>`).join('');

  function grilleAffiches(titres, selection, maximum) {
    return `<p class="muet" style="margin-bottom:16px">${selection.length} / ${maximum} sélectionné${selection.length > 1 ? 's' : ''}</p>
      <ul class="grille-3" style="list-style:none">${titres.map((t) => {
        const actif = selection.includes(t.id);
        const complet = selection.length >= maximum && !actif;
        return `<li><button type="button" data-titre="${txt(t.id)}" aria-pressed="${actif}" ${complet ? 'disabled' : ''}
          style="position:relative;display:block;width:100%;border:none;background:none;padding:0;cursor:pointer;
          border-radius:14px;overflow:hidden;opacity:${complet ? 0.35 : 1}">
          ${affiche(t)}
          ${actif ? `<span style="position:absolute;inset:0;background:rgba(7,6,10,0.5);
            box-shadow:inset 0 0 0 2px var(--or);border-radius:14px">
            <span style="position:absolute;top:8px;right:8px;display:flex;align-items:center;justify-content:center;
              width:26px;height:26px;border-radius:999px;background:var(--voile-or)">
              <svg viewBox="0 0 24 24" style="width:14px;height:14px" fill="none" stroke="#07060A" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17.5 19 7"/></svg>
            </span></span>` : ''}
        </button></li>`;
      }).join('')}</ul>`;
  }

  function contenu() {
    switch (etape) {
      case 0:
        return question('Comment on t’appelle ?', 'Un prénom ou un pseudo, comme tu préfères.',
          `<input type="text" class="champ" id="pseudo" autocomplete="given-name" placeholder="Ton prénom"
            value="${txt(b.pseudo)}" style="min-height:60px;font-size:18px">`);
      case 1: {
        const annees = []; for (let a = 1950; a <= ANNEE - 5; a += 5) annees.push(a);
        return question('Tu es né·e en quelle année ?',
          'Deux usages : ne jamais te proposer de contenu interdit à ton âge, et retrouver les films de ta jeunesse.',
          `<div style="display:flex;flex-wrap:wrap;gap:8px">${annees.reverse().map((a) =>
            `<button type="button" class="puce" data-annee="${a}" aria-pressed="${b.anneeNaissance === a}">${a}</button>`).join('')}</div>
           <label style="display:block;margin-top:20px"><span class="muet" style="display:block;margin-bottom:8px">Ou saisis-la directement</span>
           <input type="number" inputmode="numeric" class="champ" id="annee" min="1920" max="${ANNEE - 5}"
             placeholder="1990" value="${b.anneeNaissance ?? ''}"></label>`);
      }
      case 2:
        return question('Ton genre ?',
          'Facultatif, et sans aucun effet sur tes recommandations : CinéMood ne s’en sert jamais pour filtrer.',
          `<div style="display:flex;flex-wrap:wrap;gap:8px">${
            ['Femme', 'Homme', 'Non binaire', 'Je préfère ne pas répondre'].map((g) =>
            `<button type="button" class="puce" data-genre-personne="${g}" aria-pressed="${b.genrePersonne === g}">${g}</button>`).join('')}</div>`);
      case 3:
        return question('Films, séries, ou les deux ?', '',
          grandChoix([
            ['film', 'Plutôt des films', 'Une histoire, une soirée.'],
            ['serie', 'Plutôt des séries', 'De quoi tenir plusieurs semaines.'],
            ['film,serie', 'Les deux', 'Selon l’envie du moment.'],
          ], (v) => b.typesSouhaites.join(',') === v, 'types'));
      case 4:
        return question('Tes genres', 'Ce que tu adores, et ce qu’il vaut mieux éviter.',
          `<p style="font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(216,189,133,0.7);margin-bottom:12px">J’adore</p>
           <div style="display:flex;flex-wrap:wrap;gap:8px">${puces(GENRES, b.genresAdores, 'adore')}</div>
           <p style="font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(232,138,107,0.8);margin:32px 0 12px">J’évite</p>
           <div style="display:flex;flex-wrap:wrap;gap:8px">${puces(GENRES, b.genresDetestes, 'evite')}</div>`);
      case 5:
        return question('Choisis tes 5 préférés',
          'C’est la question la plus utile du test : ces titres orientent tout le reste.',
          grilleAffiches(grilleFavoris, b.favoris, 5));
      case 6: {
        const grille = b.anneeNaissance ? titresDEnfance(CATALOGUE_DEMO, b.anneeNaissance, 18) : [];
        return question('Et ceux de ton enfance ?',
          b.anneeNaissance ? 'Sortis entre tes 6 et tes 16 ans. Coche ce qui te parle.'
            : 'Renseigne ton année de naissance pour voir cette grille.',
          grille.length ? grilleAffiches(grille, b.enfance, 6)
            : `<p class="cendre" style="font-size:15px;line-height:1.6">Aucune suggestion pour cette période dans le catalogue. Passe à la suite.</p>`);
      }
      case 7:
        return question('Ton ambiance préférée', 'Celle vers laquelle tu reviens toujours.',
          grandChoix([
            ['leger', 'Léger', 'Rire, respirer, ne pas réfléchir.'],
            ['intense', 'Intense', 'Tension, rythme, adrénaline.'],
            ['emouvant', 'Émouvant', 'Ce qui serre la gorge.'],
            ['reflechi', 'Réfléchi', 'Ce qui trotte encore le lendemain.'],
            ['flippant', 'Flippant', 'Les frissons, assumés.'],
          ], (v) => b.tonalitePreferee === v, 'tonalite'));
      case 8:
        return question('Quelques réglages pratiques', '',
          `${sousQuestion('Durée maximale d’un film', [90, 120, 150, 0].map((v) =>
            `<button type="button" class="puce" data-duree="${v}" aria-pressed="${(b.dureeMax ?? 0) === v}">${v === 0 ? 'Peu importe' : `${Math.floor(v / 60)} h ${String(v % 60).padStart(2, '0')}`}</button>`).join(''))}
           ${sousQuestion('Version originale ou française ?', [['vo', 'VO sous-titrée'], ['vf', 'VF'], ['indifferent', 'Peu importe']].map(([v, l]) =>
            `<button type="button" class="puce" data-langue="${v}" aria-pressed="${b.languePreferee === v}">${l}</button>`).join(''))}
           ${sousQuestion('Plutôt récent ou plutôt classique ?', [['recent', 'Récent'], ['classique', 'Classique'], ['indifferent', 'Un peu des deux']].map(([v, l]) =>
            `<button type="button" class="puce" data-epoque="${v}" aria-pressed="${b.epoquePreferee === v}">${l}</button>`).join(''))}
           ${sousQuestion('Animation et anime ?', [['1', 'Oui, j’aime'], ['0', 'Non merci']].map(([v, l]) =>
            `<button type="button" class="puce" data-animation="${v}" aria-pressed="${b.animationOk === (v === '1')}">${l}</button>`).join(''))}`);
      default:
        return question('Une dernière chose, si tu veux',
          'Entièrement facultatif. Rien ici n’est obligatoire, et tu peux passer.',
          `<label style="display:block"><span class="cendre" style="display:block;margin-bottom:8px;font-size:13px">Ce qui te passionne, en dehors du cinéma</span>
            <input type="text" class="champ" id="interets" placeholder="musique, voyage, sciences…" value="${txt(b.interets)}"></label>
           <label style="display:block;margin-top:24px"><span class="cendre" style="display:block;margin-bottom:8px;font-size:13px">Des sujets que tu préfères ne jamais voir</span>
            <input type="text" class="champ" id="eviter" placeholder="violence conjugale, suicide…" value="${txt(b.aEviter)}">
            <span class="muet" style="display:block;margin-top:8px">Ces mots écartent définitivement les titres concernés.</span></label>`);
    }
  }

  const sousQuestion = (libelle, corps) =>
    `<div style="margin-bottom:28px"><p class="cendre" style="margin-bottom:12px;font-size:13px">${libelle}</p>
     <div style="display:flex;flex-wrap:wrap;gap:8px">${corps}</div></div>`;

  function brancher() {
    const majEtRedessiner = () => dessiner();
    surClic('#retour', () => { if (etape === 0) aller('/plateformes'); else { etape -= 1; dessiner(); } });
    surClic('#suivant', () => {
      if (etape === NB_ECRANS - 1) return terminer();
      etape += 1; dessiner();
    });

    const champPseudo = document.getElementById('pseudo');
    if (champPseudo) champPseudo.addEventListener('input', (e) => {
      b.pseudo = e.target.value.slice(0, 24);
      document.getElementById('suivant').disabled = !valide();
    });
    const champAnnee = document.getElementById('annee');
    if (champAnnee) champAnnee.addEventListener('input', (e) => {
      b.anneeNaissance = e.target.value ? Number(e.target.value) : null;
      document.getElementById('suivant').disabled = !valide();
      for (const x of document.querySelectorAll('[data-annee]')) x.setAttribute('aria-pressed', String(Number(x.dataset.annee) === b.anneeNaissance));
    });
    for (const [id, champ] of [['interets', 'interets'], ['eviter', 'aEviter']]) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', (e) => { b[champ] = e.target.value.slice(0, 120); });
    }

    surClic('[data-annee]', (e) => { b.anneeNaissance = Number(e.currentTarget.dataset.annee); majEtRedessiner(); });
    surClic('[data-genre-personne]', (e) => {
      const v = e.currentTarget.dataset.genrePersonne;
      b.genrePersonne = b.genrePersonne === v ? '' : v; majEtRedessiner();
    });
    surClic('[data-types]', (e) => { b.typesSouhaites = e.currentTarget.dataset.types.split(','); majEtRedessiner(); });
    surClic('[data-adore]', (e) => {
      const g = e.currentTarget.dataset.adore;
      b.genresAdores = bascule(b.genresAdores, g);
      b.genresDetestes = b.genresDetestes.filter((x) => x !== g); majEtRedessiner();
    });
    surClic('[data-evite]', (e) => {
      const g = e.currentTarget.dataset.evite;
      b.genresDetestes = bascule(b.genresDetestes, g);
      b.genresAdores = b.genresAdores.filter((x) => x !== g); majEtRedessiner();
    });
    surClic('[data-titre]', (e) => {
      const id = e.currentTarget.dataset.titre;
      const cle = etape === 5 ? 'favoris' : 'enfance';
      b[cle] = bascule(b[cle], id); majEtRedessiner();
    });
    surClic('[data-tonalite]', (e) => { b.tonalitePreferee = e.currentTarget.dataset.tonalite; majEtRedessiner(); });
    surClic('[data-duree]', (e) => { const v = Number(e.currentTarget.dataset.duree); b.dureeMax = v === 0 ? null : v; majEtRedessiner(); });
    surClic('[data-langue]', (e) => { b.languePreferee = e.currentTarget.dataset.langue; majEtRedessiner(); });
    surClic('[data-epoque]', (e) => { b.epoquePreferee = e.currentTarget.dataset.epoque; majEtRedessiner(); });
    surClic('[data-animation]', (e) => { b.animationOk = e.currentTarget.dataset.animation === '1'; majEtRedessiner(); });
  }

  function terminer() {
    const parId = new Map(CATALOGUE_DEMO.map((t) => [t.id, t]));
    etat.profil = construireProfilDepuisTest({
      pseudo: b.pseudo.trim(), anneeNaissance: b.anneeNaissance ?? ANNEE - 30,
      genrePersonne: b.genrePersonne || undefined, typesSouhaites: b.typesSouhaites,
      genresAdores: b.genresAdores, genresDetestes: b.genresDetestes,
      favoris: b.favoris.map((id) => parId.get(id)).filter(Boolean),
      enfance: b.enfance.map((id) => parId.get(id)).filter(Boolean),
      tonalitePreferee: b.tonalitePreferee ?? 'intense', dureeMax: b.dureeMax,
      languePreferee: b.languePreferee, epoquePreferee: b.epoquePreferee,
      animationOk: b.animationOk, plateformes: etat.profil?.plateformes ?? [],
      pays: etat.profil?.pays ?? 'FR',
      aEviter: decouper(b.aEviter), interets: decouper(b.interets),
    });
    etat.testTermine = true;
    sauvegarder();
    ecranProfilCinema();
  }

  dessiner();
}

function ecranProfilCinema() {
  const carte = profilCinema(etat.profil);
  rendre(`<div class="pad centre apparition" style="min-height:100dvh;display:flex;flex-direction:column;justify-content:center;padding-block:56px">
      <p style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(216,189,133,0.7)">Ton profil cinéma</p>
      <h1 style="margin-top:16px;font-size:48px;text-wrap:balance">${txt(carte.titre)}</h1>
      <p class="cendre" style="margin-top:20px;font-size:15px;line-height:1.6">${txt(carte.resume)}</p>
      <div style="width:64px;height:1px;margin:32px auto 0;background:var(--voile-or)"></div>
      <p class="muet" style="margin-top:32px">Tout reste modifiable dans ton profil. Plus tu utiliseras CinéMood,
        plus la sélection te ressemblera.</p>
      <button class="bouton or large" id="go" style="margin-top:40px">Découvrir ma sélection</button>
    </div>`);
  surClic('#go', () => aller('/accueil'));
}

/* =====================================================================
   Accueil — humeur, contexte, sélection.
   ===================================================================== */
export function accueil() {
  dessinerOnglets('/accueil');
  const prenom = etat.profil?.pseudo || 'toi';

  rendre(`<div class="tirer" id="tirer"><i></i></div>
    <header class="pad" style="padding-top:max(env(safe-area-inset-top),20px);padding-bottom:4px">
      <p style="font-size:13px;letter-spacing:0.2em;color:rgba(216,189,133,0.7)">${salutation()}</p>
      <h1 style="margin-top:4px;font-size:42px">${txt(prenom)}</h1>
    </header>

    <section style="margin-top:28px" aria-label="Humeur et contexte">
      <h2 class="pad" style="font-size:25px">Quelle est ton humeur ce soir ?</h2>
      <div class="rail" style="margin-top:16px;padding-bottom:4px">
        ${Object.entries(TABLE_HUMEURS).map(([cle, r]) => `
          <button type="button" data-humeur="${cle}" aria-pressed="${contexte.humeur === cle}"
            style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
            width:104px;min-height:96px;padding:14px 6px;
            border-radius:18px;cursor:pointer;border:1px solid ${contexte.humeur === cle ? 'rgba(216,189,133,0.6)' : 'rgba(255,255,255,0.07)'};
            background:${contexte.humeur === cle ? 'rgba(216,189,133,0.12)' : 'rgba(255,255,255,0.03)'};
            color:${contexte.humeur === cle ? 'var(--or-clair)' : 'var(--cendre)'}">
            <span style="font-size:26px;line-height:1" aria-hidden="true">${r.emoji}</span>
            <span style="font-size:11.5px;line-height:1.25;text-align:center;hyphens:auto">${txt(r.libelle)}</span>
          </button>`).join('')}
        <div style="width:8px"></div>
      </div>

      <div class="pad" style="margin-top:20px">
        <p class="muet" style="margin-bottom:10px">Avec qui ?</p>
        <div style="display:flex;gap:8px">
          ${['seul', 'couple', 'potes', 'famille'].map((cle) => {
            const r = TABLE_COMPAGNIE[cle]; const actif = contexte.compagnie === cle;
            return `<button type="button" data-compagnie="${cle}" aria-pressed="${actif}"
              style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;
              border-radius:999px;cursor:pointer;font-size:13px;padding-inline:8px;
              border:1px solid ${actif ? 'rgba(216,189,133,0.6)' : 'rgba(255,255,255,0.07)'};
              background:${actif ? 'rgba(216,189,133,0.12)' : 'transparent'};
              color:${actif ? 'var(--or-clair)' : 'var(--cendre)'}">
              <span aria-hidden="true">${r.emoji}</span><span>${txt(r.libelle)}</span></button>`;
          }).join('')}
        </div>
        <p class="muet" id="note-famille" style="margin-top:10px;${contexte.compagnie === 'famille' ? '' : 'display:none'}">
          En famille, CinéMood ne propose que des titres tout public.</p>
      </div>
    </section>

    <section class="pad" style="margin-top:32px" aria-label="Ta sélection">
      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:16px">
        <h2 style="font-size:25px">Ta sélection</h2><span class="muet" id="compte-reco"></span>
      </div>
      <div id="cartes" class="pile">${squeletteCartes(2)}</div>
      <p class="muet centre" style="margin-top:40px">
        Ce produit utilise l’API TMDB mais n’est pas approuvé ni certifié par TMDB.
      </p>
    </section>`, { onglets: true });

  surClic('[data-humeur]', (e) => {
    const h = e.currentTarget.dataset.humeur;
    contexte.humeur = contexte.humeur === h ? null : h;
    accueil();
  });
  surClic('[data-compagnie]', (e) => { contexte.compagnie = e.currentTarget.dataset.compagnie; accueil(); });

  tirerPourActualiser(() => calculerEtAfficher());
  calculerEtAfficher();
}

function calculerEtAfficher() {
  const resultat = recommander(CATALOGUE_DEMO, etat.profil, etat.historique, contexte,
    { taille: 12, anneeCourante: ANNEE, titresAimes: titresAimes() });

  etat.historique = enregistrerExpositions(etat.historique, resultat.recommandations.map((r) => r.titre.id));
  sauvegarder();

  const hote = document.getElementById('cartes');
  if (!hote) return;
  document.getElementById('compte-reco').textContent =
    resultat.recommandations.length ? `${resultat.recommandations.length} titres` : '';

  if (resultat.recommandations.length === 0) {
    hote.innerHTML = etatVide(
      resultat.raisonVide === 'aucune_plateforme' ? 'Aucune plateforme sélectionnée' : 'Rien ne passe les filtres',
      resultat.contraintesLimitantes.length
        ? `Pour élargir : ${resultat.contraintesLimitantes.slice(0, 2).map((c) => `${txt(c.libelle.toLowerCase())} (+${c.gain} titres)`).join(', ')}.`
        : 'Tes critères sont un peu trop serrés pour ce soir. Essaie une autre humeur.');
    surClic('#vider-humeur', () => { contexte.humeur = null; accueil(); });
    return;
  }

  hote.innerHTML = resultat.recommandations.map(carteReco).join('')
    + (resultat.contraintesLimitantes.length
      ? `<p class="muet centre" style="margin-top:8px">Sélection courte : ${txt(resultat.contraintesLimitantes[0].libelle.toLowerCase())} débloquerait ${resultat.contraintesLimitantes[0].gain} titres.</p>`
      : '');

  brancherCartes(resultat.recommandations);
}

function carteReco(reco) {
  const t = reco.titre;
  const dansLaListe = etat.historique.liste.includes(t.id);
  const acces = t.plateformes.find((p) => (etat.profil.plateformes.length ? etat.profil.plateformes : ['arte', 'francetv', 'tf1plus', 'm6plus', 'plutotv']).includes(p)) ?? t.plateformes[0];
  const lien = PLATEFORME_PAR_ID[acces]?.lien;

  return `<article class="carte verre" data-carte="${txt(t.id)}">
      <div class="voile-geste garde"><span>Je garde</span></div>
      <div class="voile-geste passe"><span>Je passe</span></div>
      <div class="haut">
        ${affiche(t, { sansTexte: true })}
        <div class="voile"></div>
        <div class="coin">
          ${acces ? pastille(acces) : ''}
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
            ${reco.pepite ? '<span class="badge pepite">✦ Pépite</span>' : ''}
            <span class="badge">${t.note.toFixed(1)}</span>
          </div>
        </div>
        <div class="titrage">
          <h2>${txt(t.titre)}</h2>
          <p class="muet" style="margin-top:8px;color:var(--cendre)">${t.annee} · ${format(t)} · ${classificationLisible(t.classification)}</p>
          <p class="muet" style="margin-top:2px">${txt(t.genres.slice(0, 3).join(' · '))}</p>
        </div>
      </div>
      <div class="pourquoi">
        <p class="etiquette">Pourquoi pour toi</p>
        <p>${txt(reco.pourquoi)}</p>
      </div>
      <div style="padding:0 20px 16px">
        <button type="button" class="bouton or large" data-bande-annonce="${txt(t.id)}" style="min-height:52px;font-size:16px">
          <svg viewBox="0 0 24 24" style="width:20px;height:20px" fill="currentColor" aria-hidden="true"><path d="M8 5.2v13.6L19 12 8 5.2Z"/></svg>
          Bande-annonce
        </button>
      </div>
      <div class="actions">
        <button type="button" class="rond" data-signal="${dansLaListe ? 'retrait_liste' : 'ajout_liste'}" data-id="${txt(t.id)}"
          aria-pressed="${dansLaListe}" aria-label="${dansLaListe ? 'Retirer de ma liste' : 'Ajouter à ma liste'}">
          <svg viewBox="0 0 24 24" fill="${dansLaListe ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M6.5 3.5h11v17l-5.5-4-5.5 4v-17Z"/></svg>
        </button>
        <button type="button" class="rond" data-signal="deja_vu_aime" data-id="${txt(t.id)}" aria-label="Déjà vu, j’ai aimé">${icone('pouce')}</button>
        <button type="button" class="rond" data-signal="deja_vu_pas_aime" data-id="${txt(t.id)}" aria-label="Déjà vu, je n’ai pas aimé">${icone('pouce', 'style="transform:rotate(180deg)"')}</button>
        <button type="button" class="rond" data-signal="pas_pour_moi" data-id="${txt(t.id)}" aria-label="Pas pour moi">${icone('croix', 'stroke-width="1.7"')}</button>
        ${lien ? `<a href="${txt(lien)}" target="_blank" rel="noreferrer noopener" class="tactile"
          style="display:flex;align-items:center;gap:6px;height:46px;border-radius:999px;padding-inline:16px;
          font-size:13px;text-decoration:none;color:var(--ivoire);background:rgba(255,255,255,0.055);
          border:1px solid rgba(255,255,255,0.075)">Ouvrir
          <svg viewBox="0 0 24 24" style="width:16px;height:16px" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M8 16 16 8M9.5 8H16v6.5"/></svg></a>` : ''}
      </div>
    </article>`;
}

function brancherCartes(recos) {
  const parId = new Map(recos.map((r) => [r.titre.id, r.titre]));

  surClic('[data-bande-annonce]', (e) => {
    const t = parId.get(e.currentTarget.dataset.bandeAnnonce);
    signaler(t, 'bande_annonce');
    ouvrirBandeAnnonce(t);
  });

  surClic('[data-signal]', (e) => {
    const t = parId.get(e.currentTarget.dataset.id);
    const signal = e.currentTarget.dataset.signal;
    signaler(t, signal);
    if (signal === 'pas_pour_moi' || signal === 'deja_vu_pas_aime' || signal === 'deja_vu_aime') {
      retirerCarte(t.id);
    } else {
      calculerEtAfficher();
    }
  });

  // Glissement : droite = je garde, gauche = je passe.
  for (const carte of document.querySelectorAll('[data-carte]')) {
    let departX = 0; let departY = 0; let actif = false;
    const garde = carte.querySelector('.voile-geste.garde');
    const passe = carte.querySelector('.voile-geste.passe');

    carte.addEventListener('touchstart', (e) => {
      departX = e.touches[0].clientX; departY = e.touches[0].clientY; actif = true;
      carte.style.transition = 'none';
    }, { passive: true });

    carte.addEventListener('touchmove', (e) => {
      if (!actif) return;
      const dx = e.touches[0].clientX - departX;
      const dy = e.touches[0].clientY - departY;
      // On ne capte le geste que s'il est franchement horizontal.
      if (Math.abs(dy) > Math.abs(dx)) { actif = false; carte.style.transform = ''; return; }
      carte.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`;
      garde.style.opacity = String(Math.max(0, Math.min(1, (dx - 30) / 80)));
      passe.style.opacity = String(Math.max(0, Math.min(1, (-dx - 30) / 80)));
    }, { passive: true });

    const fin = (e) => {
      if (!actif) return;
      actif = false;
      const dx = (e.changedTouches?.[0]?.clientX ?? departX) - departX;
      carte.style.transition = 'transform .25s ease, opacity .25s ease';
      carte.style.transform = '';
      garde.style.opacity = '0'; passe.style.opacity = '0';
      if (Math.abs(dx) < 110) return;
      const t = parId.get(carte.dataset.carte);
      signaler(t, dx > 0 ? 'swipe_garde' : 'swipe_passe');
      if (dx > 0) calculerEtAfficher(); else retirerCarte(t.id);
    };
    carte.addEventListener('touchend', fin);
    carte.addEventListener('touchcancel', fin);
  }
}

function retirerCarte(id) {
  const el = document.querySelector(`[data-carte="${CSS.escape(id)}"]`);
  if (!el) return calculerEtAfficher();
  el.style.transition = 'opacity .22s ease, transform .22s ease';
  el.style.opacity = '0'; el.style.transform = 'scale(0.94)';
  setTimeout(() => el.remove(), 220);
}

function signaler(titre, signal) {
  etat.profil = appliquerSignal(etat.profil, titre, signal);
  etat.historique = enregistrerSignal(etat.historique, titre.id, signal);
  etat.titresConnus = { ...etat.titresConnus, [titre.id]: titre };
  sauvegarder();
}

function titresAimes() {
  return Object.values(etat.titresConnus).filter((t) => etat.historique.vus[t.id] === 1 || etat.historique.liste.includes(t.id));
}

/* =====================================================================
   Découvrir.
   ===================================================================== */
export function decouvrir() {
  dessinerOnglets('/decouvrir');
  let requete = ''; let genre = null; let plateforme = null; let decennie = null; let dureeMax = null;

  const mesPlateformes = etat.profil?.plateformes ?? [];
  const rangee = (titre, corps) =>
    `<div><p class="muet pad" style="padding-bottom:8px;text-transform:uppercase;letter-spacing:0.14em;font-size:12px">${titre}</p>
     <div class="rail">${corps}<div style="width:4px"></div></div></div>`;

  rendre(`<header class="pad" style="padding-top:max(env(safe-area-inset-top),20px);padding-bottom:8px">
      <h1 style="font-size:38px">Découvrir</h1>
    </header>

    <div class="pad" style="padding-top:20px">
      <label for="recherche" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Rechercher un film ou une série</label>
      <div class="verre" style="display:flex;align-items:center;gap:12px;border-radius:14px;padding-inline:16px">
        ${icone('decouvrir', 'style="width:20px;height:20px;flex:0 0 auto;color:var(--estompe)" stroke-width="1.7"')}
        <input id="recherche" type="search" inputmode="search" autocomplete="off"
          placeholder="Un titre, un réalisateur, un acteur…"
          style="flex:1;min-height:52px;background:none;border:none;font-size:16px;color:var(--ivoire)">
      </div>
    </div>

    <div style="margin-top:20px;display:flex;flex-direction:column;gap:12px">
      ${rangee('Genre', GENRES.map((g) => `<button type="button" class="puce" data-f-genre="${g}" aria-pressed="false">${g}</button>`).join(''))}
      ${mesPlateformes.length > 1 ? rangee('Plateforme', mesPlateformes.map((id) =>
        `<button type="button" class="puce" data-f-plateforme="${id}" aria-pressed="false">${txt(PLATEFORME_PAR_ID[id]?.nom ?? id)}</button>`).join('')) : ''}
      ${rangee('Décennie', [2020, 2010, 2000, 1990, 1980, 1970].map((d) =>
        `<button type="button" class="puce" data-f-decennie="${d}" aria-pressed="false">${d}s</button>`).join(''))}
      ${rangee('Durée', [[90, '- 1 h 30'], [120, '- 2 h'], [150, '- 2 h 30']].map(([v, l]) =>
        `<button type="button" class="puce" data-f-duree="${v}" aria-pressed="false">${l}</button>`).join(''))}
    </div>

    <section class="pad" style="margin-top:32px" aria-label="Résultats"><div id="resultats"></div></section>`,
    { onglets: true });

  const basculer = (attribut, valeur, courant) => {
    const suivant = courant === valeur ? null : valeur;
    for (const b of document.querySelectorAll(`[data-f-${attribut}]`)) {
      b.setAttribute('aria-pressed', String(b.dataset[`f${attribut[0].toUpperCase()}${attribut.slice(1)}`] === String(suivant)));
    }
    return suivant;
  };

  function chercher() {
    let catalogue = CATALOGUE_DEMO;
    const aiguille = sansAccents(requete.trim());
    if (aiguille.length >= 2) {
      catalogue = catalogue.filter((t) =>
        sansAccents(t.titre).includes(aiguille) ||
        t.realisateurs.some((r) => sansAccents(r).includes(aiguille)) ||
        t.acteurs.some((a) => sansAccents(a).includes(aiguille)));
    }
    if (genre) catalogue = catalogue.filter((t) => t.genres.includes(genre));
    if (plateforme) catalogue = catalogue.filter((t) => t.plateformes.includes(plateforme));
    if (decennie) catalogue = catalogue.filter((t) => t.annee >= decennie && t.annee < decennie + 10);
    if (dureeMax) catalogue = catalogue.filter((t) => (t.duree ?? 45) <= dureeMax);

    const resultats = classerPourDecouverte(catalogue, etat.profil, etat.historique, contexte, ANNEE).slice(0, 40);
    const hote = document.getElementById('resultats');

    if (resultats.length === 0) {
      hote.innerHTML = etatVide('Aucun résultat',
        'Rien ne correspond à ces critères sur tes plateformes. Retire un filtre ou tente une autre recherche.');
      return;
    }

    hote.innerHTML = `<ul class="grille-2" style="list-style:none">${resultats.map((r) => `
      <li><button type="button" data-ouvrir="${txt(r.titre.id)}" style="display:block;width:100%;text-align:left;background:none;border:none;padding:0;cursor:pointer">
        <div style="position:relative;border-radius:14px;overflow:hidden">
          ${affiche(r.titre)}
          <div style="position:absolute;left:8px;top:8px">${r.titre.plateformes[0] ? pastille(r.titre.plateformes[0], 'petite') : ''}</div>
        </div>
        <p style="margin-top:8px;font-size:14px;line-height:1.3">${txt(r.titre.titre)}</p>
        <p class="muet">${r.titre.annee} · ${r.titre.note.toFixed(1)}</p>
      </button></li>`).join('')}</ul>`;

    const parId = new Map(resultats.map((r) => [r.titre.id, r.titre]));
    surClic('[data-ouvrir]', (e) => ouvrirBandeAnnonce(parId.get(e.currentTarget.dataset.ouvrir)));
  }

  let minuterie;
  document.getElementById('recherche').addEventListener('input', (e) => {
    requete = e.target.value;
    clearTimeout(minuterie);
    minuterie = setTimeout(chercher, 250);
  });
  surClic('[data-f-genre]', (e) => { genre = basculer('genre', e.currentTarget.dataset.fGenre, genre); chercher(); });
  surClic('[data-f-plateforme]', (e) => { plateforme = basculer('plateforme', e.currentTarget.dataset.fPlateforme, plateforme); chercher(); });
  surClic('[data-f-decennie]', (e) => { decennie = Number(basculer('decennie', e.currentTarget.dataset.fDecennie, decennie ? String(decennie) : null)) || null; chercher(); });
  surClic('[data-f-duree]', (e) => { dureeMax = Number(basculer('duree', e.currentTarget.dataset.fDuree, dureeMax ? String(dureeMax) : null)) || null; chercher(); });

  chercher();
}

/* =====================================================================
   Ma liste.
   ===================================================================== */
export function maListe(onglet = 'a_voir') {
  dessinerOnglets('/ma-liste');

  const aVoir = etat.historique.liste.map((id) => etat.titresConnus[id]).filter(Boolean);
  const vus = Object.entries(etat.historique.vus)
    .map(([id, note]) => ({ titre: etat.titresConnus[id], note }))
    .filter((x) => Boolean(x.titre));
  const liste = onglet === 'a_voir' ? aVoir : vus.map((x) => x.titre);

  rendre(`<header class="pad" style="padding-top:max(env(safe-area-inset-top),20px);padding-bottom:8px">
      <h1 style="font-size:38px">Ma liste</h1></header>

    <div class="pad" style="margin-top:20px">
      <div class="verre" role="tablist" style="display:flex;border-radius:999px;padding:4px">
        ${[['a_voir', `À voir${aVoir.length ? ` · ${aVoir.length}` : ''}`], ['vus', `Déjà vus${vus.length ? ` · ${vus.length}` : ''}`]]
          .map(([cle, libelle]) => `<button type="button" role="tab" data-onglet="${cle}" aria-selected="${onglet === cle}"
            style="flex:1;min-height:44px;border-radius:999px;border:none;cursor:pointer;font-size:14px;
            background:${onglet === cle ? 'var(--voile-or)' : 'transparent'};
            color:${onglet === cle ? 'var(--nuit)' : 'var(--cendre)'};font-weight:${onglet === cle ? 600 : 400}">${libelle}</button>`).join('')}
      </div>
    </div>

    <section class="pad" style="margin-top:28px">
      ${liste.length === 0 ? etatVide(
        onglet === 'a_voir' ? 'Ta liste est vide' : 'Rien de vu pour l’instant',
        onglet === 'a_voir'
          ? 'Ajoute des titres depuis l’accueil : ils t’attendront ici, même hors connexion.'
          : 'Marque un titre comme « déjà vu » et dis si tu as aimé : CinéMood s’en sert pour affiner tes recommandations.')
      : `<ul class="pile" style="list-style:none">${liste.map((t) => {
          const appreciation = vus.find((v) => v.titre.id === t.id)?.note;
          return `<li class="verre" style="display:flex;gap:16px;border-radius:20px;padding:12px">
            <button type="button" data-ouvrir="${txt(t.id)}" aria-label="Bande-annonce de ${txt(t.titre)}"
              style="width:86px;flex:0 0 auto;border:none;background:none;padding:0;cursor:pointer;border-radius:14px;overflow:hidden">
              ${affiche(t)}</button>
            <div style="flex:1;min-width:0;padding-block:2px">
              <p class="serif" style="font-size:19px">${txt(t.titre)}</p>
              <p class="muet" style="margin-top:4px">${t.annee} · ${txt(t.genres.slice(0, 2).join(', '))}</p>
              <div style="margin-top:8px">${t.plateformes[0] ? pastille(t.plateformes[0], 'petite') : ''}</div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">
                ${onglet === 'a_voir'
                  ? `<button type="button" class="puce" data-action="deja_vu_aime" data-id="${txt(t.id)}" style="font-size:12px;padding-inline:14px">Vu, j’ai aimé</button>
                     <button type="button" class="puce" data-action="deja_vu_pas_aime" data-id="${txt(t.id)}" style="font-size:12px;padding-inline:14px">Vu, bof</button>
                     <button type="button" class="puce" data-action="retrait_liste" data-id="${txt(t.id)}" style="font-size:12px;padding-inline:14px">Retirer</button>`
                  : `<span class="muet">${appreciation === 1 ? '👍 Tu as aimé' : '👎 Tu n’as pas aimé'}</span>`}
              </div>
            </div></li>`;
        }).join('')}</ul>`}
    </section>`, { onglets: true });

  surClic('[data-onglet]', (e) => maListe(e.currentTarget.dataset.onglet));
  surClic('[data-ouvrir]', (e) => ouvrirBandeAnnonce(etat.titresConnus[e.currentTarget.dataset.ouvrir]));
  surClic('[data-action]', (e) => {
    signaler(etat.titresConnus[e.currentTarget.dataset.id], e.currentTarget.dataset.action);
    maListe(onglet);
  });
  surClic('#vers-accueil', () => aller('/accueil'));
}

/* =====================================================================
   Profil.
   ===================================================================== */
export function profil() {
  dessinerOnglets('/profil');
  const p = etat.profil;
  const carte = profilCinema(p);

  const bloc = (titre, sousTitre, corps) =>
    `<section class="pad" style="margin-top:36px">
      <h2 style="font-size:22px">${titre}</h2>
      ${sousTitre ? `<p class="muet" style="margin-top:4px;margin-bottom:16px">${sousTitre}</p>` : '<div style="height:16px"></div>'}
      ${corps}</section>`;

  const puces = (liste, actifs, attribut) => `<div style="display:flex;flex-wrap:wrap;gap:8px">${
    liste.map((x) => `<button type="button" class="puce" data-${attribut}="${txt(String(x[0] ?? x))}" aria-pressed="${actifs(x)}">${txt(String(x[1] ?? x))}</button>`).join('')}</div>`;

  rendre(`<header class="pad" style="padding-top:max(env(safe-area-inset-top),20px);padding-bottom:8px">
      <h1 style="font-size:38px">Profil</h1></header>

    <section class="pad" style="margin-top:24px">
      <div class="verre grain" style="position:relative;border-radius:20px;padding:24px;overflow:hidden">
        <p style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(216,189,133,0.75)">Ton profil cinéma</p>
        <p class="serif" style="margin-top:8px;font-size:32px">${txt(carte.titre)}</p>
        <p class="cendre" style="margin-top:8px;font-size:14px;line-height:1.6">${txt(carte.resume)}</p>
        <p class="muet" style="margin-top:16px">${txt(p.pseudo)} · ${generation(p.anneeNaissance)} · ${ANNEE - p.anneeNaissance} ans</p>
      </div>
    </section>

    ${bloc('Mes plateformes', 'Aucune recommandation ne sortira de cette liste.',
      `<div class="grille-3">${PLATEFORMES.map((pl) => {
        const actif = p.plateformes.includes(pl.id);
        return `<button type="button" data-plateforme="${pl.id}" aria-pressed="${actif}"
          style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:74px;
          border-radius:14px;padding-inline:6px;cursor:pointer;
          border:1px solid ${actif ? 'rgba(216,189,133,0.6)' : 'rgba(255,255,255,0.07)'};
          background:${actif ? 'rgba(216,189,133,0.1)' : 'rgba(255,255,255,0.02)'};
          color:${actif ? 'var(--or-clair)' : 'var(--estompe)'}">
          ${pastille(pl.id, 'petite')}<span style="font-size:11px;line-height:1.2;text-align:center">${txt(pl.nom)}</span></button>`;
      }).join('')}</div>
      ${p.plateformes.length === 0 ? `<p class="cendre" style="margin-top:12px;font-size:13px;line-height:1.6">
        Aucun abonnement sélectionné : CinéMood ne te proposera que des titres disponibles gratuitement
        (arte.tv, france.tv, TF1+, M6+, Pluto TV).</p>` : ''}`)}

    ${bloc('Genres que j’adore', '', puces(GENRES, (g) => p.genresAdores.includes(g), 'adore'))}
    ${bloc('Genres que j’évite', '', puces(GENRES, (g) => p.genresDetestes.includes(g), 'evite'))}

    ${bloc('Préférences', '', `
      <p class="cendre" style="margin-bottom:10px;font-size:13px">Ambiance préférée</p>
      ${puces(Object.entries(LIBELLE_TONALITE), ([v]) => p.tonalitePreferee === v, 'tonalite')}
      <p class="cendre" style="margin:20px 0 10px;font-size:13px">Durée maximale</p>
      ${puces([[90, '1 h 30'], [120, '2 h'], [150, '2 h 30'], [0, 'Peu importe']], ([v]) => (p.dureeMax ?? 0) === v, 'duree')}
      <p class="cendre" style="margin:20px 0 10px;font-size:13px">Version</p>
      ${puces([['vo', 'VO sous-titrée'], ['vf', 'VF'], ['indifferent', 'Peu importe']], ([v]) => p.languePreferee === v, 'langue')}
      <p class="cendre" style="margin:20px 0 10px;font-size:13px">Époque</p>
      ${puces([['recent', 'Plutôt récent'], ['classique', 'Plutôt classique'], ['indifferent', 'Un peu des deux']], ([v]) => p.epoquePreferee === v, 'epoque')}
      <p class="cendre" style="margin:20px 0 10px;font-size:13px">Animation et anime</p>
      ${puces([['1', 'Oui, j’aime'], ['0', 'Non merci']], ([v]) => p.animationOk === (v === '1'), 'animation')}`)}

    ${bloc('Compte', '', `<div class="pile">
      <button class="bouton verre large" id="refaire">Refaire le test de personnalité</button>
      <button class="bouton fantome large" id="effacer">Effacer mes données</button>
    </div>`)}

    <p class="muet centre pad" style="margin-top:40px">
      Version de démonstration : catalogue local de ${CATALOGUE_DEMO.length} titres, données stockées sur cet appareil.<br>
      Ce produit utilise l’API TMDB mais n’est pas approuvé ni certifié par TMDB.
    </p>`, { onglets: true });

  const maj = (modification) => { etat.profil = { ...etat.profil, ...modification }; sauvegarder(); profil(); };

  surClic('[data-plateforme]', (e) => {
    const id = e.currentTarget.dataset.plateforme;
    maj({ plateformes: bascule(p.plateformes, id) });
  });
  surClic('[data-adore]', (e) => {
    const g = e.currentTarget.dataset.adore;
    maj({ genresAdores: bascule(p.genresAdores, g), genresDetestes: p.genresDetestes.filter((x) => x !== g) });
  });
  surClic('[data-evite]', (e) => {
    const g = e.currentTarget.dataset.evite;
    maj({ genresDetestes: bascule(p.genresDetestes, g), genresAdores: p.genresAdores.filter((x) => x !== g) });
  });
  surClic('[data-tonalite]', (e) => maj({ tonalitePreferee: e.currentTarget.dataset.tonalite }));
  surClic('[data-duree]', (e) => { const v = Number(e.currentTarget.dataset.duree); maj({ dureeMax: v === 0 ? null : v }); });
  surClic('[data-langue]', (e) => maj({ languePreferee: e.currentTarget.dataset.langue }));
  surClic('[data-epoque]', (e) => maj({ epoquePreferee: e.currentTarget.dataset.epoque }));
  surClic('[data-animation]', (e) => maj({ animationOk: e.currentTarget.dataset.animation === '1' }));
  surClic('#refaire', () => aller('/test'));
  surClic('#effacer', () => {
    if (!confirm('Effacer ton profil, ta liste et ton historique sur cet appareil ?')) return;
    reinitialiser(); aller('/');
  });
}

/* =====================================================================
   Utilitaires.
   ===================================================================== */
function etatVide(titre, message) {
  return `<div class="centre" style="max-width:24rem;margin-inline:auto;padding:48px 24px">
      <div class="verre" style="width:64px;height:64px;border-radius:999px;margin:0 auto 24px;display:flex;align-items:center;justify-content:center">
        <svg viewBox="0 0 24 24" style="width:28px;height:28px;color:rgba(216,189,133,0.7)" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M4 5.5h16v13H4zM4 9.5h16M8 5.5v4M16 5.5v4"/></svg>
      </div>
      <h2 style="font-size:26px">${txt(titre)}</h2>
      <p class="cendre" style="margin-top:12px;font-size:15px;line-height:1.6">${txt(message)}</p>
      <button class="bouton verre large" id="vers-accueil" style="margin-top:28px">Voir ma sélection du soir</button>
      <button class="bouton fantome large" id="vider-humeur" style="margin-top:12px">Enlever l’humeur</button>
    </div>`;
}

function salutation() {
  const h = new Date().getHours();
  if (h < 6) return 'CETTE NUIT';
  if (h < 12) return 'CE MATIN';
  if (h < 18) return 'CET APRÈS-MIDI';
  return 'CE SOIR';
}

function bascule(liste, valeur) {
  return liste.includes(valeur) ? liste.filter((x) => x !== valeur) : [...liste, valeur];
}

function decouper(texte) {
  return texte.split(/[,;]/).map((x) => x.trim()).filter((x) => x.length > 1);
}

function sansAccents(texte) {
  return texte.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Échantillon couvrant plusieurs décennies et plusieurs genres. */
function echantillonVarie(catalogue, taille) {
  const parDecennie = new Map();
  for (const t of catalogue) {
    const d = Math.floor(t.annee / 10) * 10;
    if (!parDecennie.has(d)) parDecennie.set(d, []);
    parDecennie.get(d).push(t);
  }
  const decennies = [...parDecennie.keys()].sort((a, b) => b - a);
  const resultat = []; const genresVus = new Set();
  for (let tour = 0; tour < 6 && resultat.length < taille; tour += 1) {
    for (const d of decennies) {
      if (resultat.length >= taille) break;
      const candidats = parDecennie.get(d).filter((t) => !resultat.includes(t))
        .sort((a, b) => b.popularite - a.popularite);
      const choisi = candidats.find((t) => !genresVus.has(t.genres[0])) ?? candidats[0];
      if (choisi) { resultat.push(choisi); genresVus.add(choisi.genres[0]); }
    }
  }
  return resultat.slice(0, taille);
}

function titresDEnfance(catalogue, anneeNaissance, taille) {
  return catalogue
    .filter((t) => t.annee >= anneeNaissance + 6 && t.annee <= anneeNaissance + 16)
    .sort((a, b) => b.popularite - a.popularite)
    .slice(0, taille);
}

/** Tirer vers le bas pour recharger — Safari iOS ne l'offre pas en PWA. */
function tirerPourActualiser(action) {
  const jauge = document.getElementById('tirer');
  if (!jauge) return;
  let depart = null; let enCours = false;

  document.addEventListener('touchstart', (e) => {
    if (window.scrollY > 2 || enCours) return;
    depart = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (depart === null) return;
    const delta = e.touches[0].clientY - depart;
    jauge.style.height = `${Math.max(0, Math.min(120, delta / 2.1))}px`;
  }, { passive: true });

  const fin = async () => {
    if (depart === null) return;
    const hauteur = parseFloat(jauge.style.height || '0');
    depart = null;
    if (hauteur >= 78 && !enCours) {
      enCours = true;
      jauge.querySelector('i').classList.add('tourne');
      await action();
      enCours = false;
      jauge.querySelector('i').classList.remove('tourne');
    }
    jauge.style.height = '0px';
  };
  document.addEventListener('touchend', fin);
  document.addEventListener('touchcancel', fin);
}
