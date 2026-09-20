/* Mood — interface */

const $ = function (s) { return document.querySelector(s); };
const el = function (t, c, h) { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };

let profil = chargerProfil();
let session = null;
let resultats = { film: [], musique: [] };
let elargi = {};
let ongletCourant = 'film';
let retourProfil = false;          // édition des goûts depuis l'onglet « Mes goûts »
const NB_QUESTIONS = 6;

function vibre(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) {} }
function echap(s) {
  return String(s).replace(/[&<>"]/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; })
    .replace(/ ([?!:;»])/g, '\u00A0$1').replace(/« /g, '«\u00A0');   /* espaces insécables à la française */
}

/* ───────── Navigation ───────── */

function aller(id) {
  document.querySelectorAll('.ecran').forEach(function (e) { e.classList.remove('actif'); });
  const cible = document.getElementById(id);
  cible.classList.add('actif');
  cible.scrollTop = 0;
  const ongle = ['ecr-home', 'ecr-favoris', 'ecr-profil'].indexOf(id) >= 0;
  $('#nav').classList.toggle('visible', ongle);
  document.querySelectorAll('#nav button').forEach(function (b) {
    b.classList.toggle('actif', b.dataset.ecran === id);
  });
}

/* Teinte l'ambiance selon l'humeur visée */
function teinter(cible) {
  const lu = cible ? cible.lu : .5, te = cible ? cible.te : .4;
  document.documentElement.style.setProperty('--h1', Math.round(232 + lu * 118));
  document.documentElement.style.setProperty('--h2', Math.round(232 + lu * 118 + 22 + te * 26));
}

document.querySelectorAll('#nav button').forEach(function (b) {
  b.addEventListener('click', function () {
    vibre();
    if (b.dataset.ecran === 'ecr-favoris') rendreFavoris();
    if (b.dataset.ecran === 'ecr-profil') rendreProfil();
    if (b.dataset.ecran === 'ecr-home') rendreHome();
    aller(b.dataset.ecran);
  });
});

/* ───────── Onboarding ───────── */

let onbEtape = 0;
let onbBrouillon = null;

const DUREES = [{ v: 100, l: 'Court, 1h30 max' }, { v: 140, l: 'Jusqu’à 2h20' }, { v: 999, l: 'Peu importe' }];
const EPOQUES = [{ v: 'peu', l: 'Peu importe' }, { v: 'recent', l: 'Plutôt récent' }, { v: 'avant', l: 'Plutôt les classiques' }];

function etapesOnboarding() {
  const m = onbBrouillon.medias;
  const l = ['base'];
  if (m.indexOf('film') >= 0) l.push('gFilm');
  if (m.indexOf('musique') >= 0) l.push('gMus');
  if (m.indexOf('film') >= 0) l.push('rFilm');
  if (m.indexOf('musique') >= 0) l.push('rMus');
  l.push('habitudes', 'interdits');
  return l;
}

function ouvrirOnboarding(depuisProfil) {
  retourProfil = !!depuisProfil;
  onbBrouillon = JSON.parse(JSON.stringify(profil));
  if (!onbBrouillon.medias.length) onbBrouillon.medias = ['film', 'musique'];
  onbEtape = 0;
  rendreOnboarding();
  aller('ecr-onboard');
}

function rendreOnboarding() {
  const etapes = etapesOnboarding();
  const nom = etapes[Math.min(onbEtape, etapes.length - 1)];
  const c = $('#onbContenu');
  c.innerHTML = '';
  $('#onbPas').textContent = (onbEtape + 1) + '/' + etapes.length;
  $('#onbProgres').style.width = ((onbEtape + 1) / etapes.length * 100) + '%';
  $('#onbSuivant').textContent = onbEtape === etapes.length - 1 ? 'C’est parti' : 'Continuer';

  if (nom === 'base') {
    $('#onbTitre').textContent = 'On fait connaissance';
    c.appendChild(el('div', 'etiquette', 'Étape 1'));
    c.appendChild(el('div', 'question', 'Tu t’appelles comment ?'));
    const champ = el('input', 'champ');
    champ.type = 'text'; champ.placeholder = 'Ton prénom (facultatif)'; champ.value = onbBrouillon.prenom || '';
    champ.maxLength = 20;
    champ.addEventListener('input', function () { onbBrouillon.prenom = champ.value.trim(); });
    c.appendChild(champ);
    c.appendChild(el('div', 'question', 'Tu veux des conseils sur quoi ?'));
    const g = el('div', 'grille deux');
    [{ id: 'film', e: '🎬', l: 'Des films' }, { id: 'musique', e: '🎵', l: 'De la musique' }].forEach(function (o, i) {
      const t = el('button', 'tuile' + (onbBrouillon.medias.indexOf(o.id) >= 0 ? ' choisi' : ''),
        '<span class="emo">' + o.e + '</span>' + o.l);
      t.style.animationDelay = (i * .05) + 's';
      t.addEventListener('click', function () {
        vibre();
        const i2 = onbBrouillon.medias.indexOf(o.id);
        if (i2 >= 0) { if (onbBrouillon.medias.length > 1) onbBrouillon.medias.splice(i2, 1); }
        else onbBrouillon.medias.push(o.id);
        rendreOnboarding();
      });
      g.appendChild(t);
    });
    c.appendChild(g);
    c.appendChild(el('p', 'note', 'Tu pourras changer d’avis à chaque séance.'));
  }

  if (nom === 'gFilm' || nom === 'gMus') {
    const film = nom === 'gFilm';
    $('#onbTitre').textContent = film ? 'Tes genres de films' : 'Tes genres de musique';
    c.appendChild(el('div', 'etiquette', film ? 'Cinéma' : 'Musique'));
    c.appendChild(el('div', 'question', film ? 'Tu regardes quoi, d’habitude ?' : 'Tu écoutes quoi, d’habitude ?'));
    const table = film ? onbBrouillon.gFilm : onbBrouillon.gMus;
    const p = el('div', 'puces');
    (film ? GENRES_FILM : GENRES_MUSIQUE).forEach(function (genre) {
      const b = el('button', 'puce' + (table[genre] ? ' choisi' : ''), echap(genre));
      b.addEventListener('click', function () {
        vibre();
        if (table[genre]) delete table[genre]; else table[genre] = .8;
        b.classList.toggle('choisi', !!table[genre]);
        majBoutonOnb();
      });
      p.appendChild(b);
    });
    c.appendChild(p);
    c.appendChild(el('p', 'note', 'Choisis-en au moins 3. Sélectionne large : c’est l’humeur qui fera le tri ensuite.'));
  }

  if (nom === 'rFilm' || nom === 'rMus') {
    const film = nom === 'rFilm';
    $('#onbTitre').textContent = film ? 'Tes repères ciné' : 'Tes repères musicaux';
    c.appendChild(el('div', 'etiquette', film ? 'Cinéma' : 'Musique'));
    c.appendChild(el('div', 'question', film ? 'Lesquels te ressemblent ?' : 'Lesquels te ressemblent ?'));
    const grille = el('div', 'refs');
    (film ? REFS_FILM : REFS_MUSIQUE).forEach(function (titre, i) {
      const it = parTitre(titre);
      if (!it) return;
      const choisi = onbBrouillon.refs.indexOf(it.id) >= 0;
      const b = el('button', 'ref' + (choisi ? ' choisi' : ''), '<b>' + echap(it.t) + '</b><span>' + echap(it.m) + '</span>');
      b.style.animationDelay = (i * .03) + 's';
      b.addEventListener('click', function () {
        vibre();
        const idx = onbBrouillon.refs.indexOf(it.id);
        if (idx >= 0) onbBrouillon.refs.splice(idx, 1); else onbBrouillon.refs.push(it.id);
        b.classList.toggle('choisi', idx < 0);
        majBoutonOnb();
      });
      grille.appendChild(b);
    });
    c.appendChild(grille);
    c.appendChild(el('p', 'note', 'Au moins 2. Ça me sert de boussole : je vise ce qui tourne autour.'));
  }

  if (nom === 'habitudes') {
    $('#onbTitre').textContent = 'Tes habitudes';
    c.appendChild(el('div', 'etiquette', 'Réglages'));
    c.appendChild(el('div', 'question', 'Deux ou trois détails'));

    const bloc1 = el('div', 'carte bloc');
    const l1 = el('div', 'ligne', '<span class="lbl">Les sous-titres, ça va ?</span>');
    const sw = el('button', 'switch' + (onbBrouillon.vo ? ' on' : ''));
    sw.addEventListener('click', function () { vibre(); onbBrouillon.vo = !onbBrouillon.vo; sw.classList.toggle('on', onbBrouillon.vo); });
    l1.appendChild(sw);
    bloc1.appendChild(l1);
    c.appendChild(bloc1);

    c.appendChild(el('div', 'mini-titre', 'Époque'));
    const pe = el('div', 'puces');
    EPOQUES.forEach(function (o) {
      const b = el('button', 'puce' + (onbBrouillon.epoque === o.v ? ' choisi' : ''), o.l);
      b.addEventListener('click', function () {
        vibre(); onbBrouillon.epoque = o.v;
        pe.querySelectorAll('.puce').forEach(function (x) { x.classList.remove('choisi'); });
        b.classList.add('choisi');
      });
      pe.appendChild(b);
    });
    c.appendChild(pe);

    if (onbBrouillon.medias.indexOf('film') >= 0) {
      c.appendChild(el('div', 'mini-titre', 'Longueur des films'));
      const pd = el('div', 'puces');
      DUREES.forEach(function (o) {
        const b = el('button', 'puce' + (onbBrouillon.dureeConfort === o.v ? ' choisi' : ''), o.l);
        b.addEventListener('click', function () {
          vibre(); onbBrouillon.dureeConfort = o.v;
          pd.querySelectorAll('.puce').forEach(function (x) { x.classList.remove('choisi'); });
          b.classList.add('choisi');
        });
        pd.appendChild(b);
      });
      c.appendChild(pd);
    }

    c.appendChild(el('div', 'mini-titre', 'Doudou ou découverte ?'));
    const cur = el('input', 'curseur');
    cur.type = 'range'; cur.min = 0; cur.max = 100; cur.value = Math.round(onbBrouillon.ouverture * 100);
    const lbl = el('p', 'note', '');
    function majCur() {
      const v = cur.value / 100;
      onbBrouillon.ouverture = v;
      lbl.textContent = v < .3 ? 'Je préfère revoir ce que j’aime déjà.'
        : v < .6 ? 'Un peu des deux, selon les jours.'
        : v < .85 ? 'J’aime bien découvrir des trucs.'
        : 'Surprends-moi tout le temps.';
    }
    cur.addEventListener('input', majCur);
    majCur();
    c.appendChild(cur);
    c.appendChild(lbl);
  }

  if (nom === 'interdits') {
    $('#onbTitre').textContent = 'Tes lignes rouges';
    c.appendChild(el('div', 'etiquette', 'Dernière étape'));
    c.appendChild(el('div', 'question', 'Ce qu’il ne faut jamais me proposer'));
    const p = el('div', 'puces');
    SENSIBILITES.forEach(function (s) {
      if (s.id === 'vo' && onbBrouillon.medias.indexOf('film') < 0) return;
      if (s.id === 'long' && onbBrouillon.medias.indexOf('film') < 0) return;
      if (s.id === 'agressif' && onbBrouillon.medias.indexOf('musique') < 0) return;
      if (s.id === 'horreur' && onbBrouillon.medias.indexOf('film') < 0) return;
      const choisi = onbBrouillon.interdits.indexOf(s.id) >= 0;
      const b = el('button', 'puce' + (choisi ? ' choisi' : ''), echap(s.l));
      b.addEventListener('click', function () {
        vibre();
        const i = onbBrouillon.interdits.indexOf(s.id);
        if (i >= 0) onbBrouillon.interdits.splice(i, 1); else onbBrouillon.interdits.push(s.id);
        b.classList.toggle('choisi', i < 0);
      });
      p.appendChild(b);
    });
    c.appendChild(p);
    c.appendChild(el('p', 'note', 'Ces contenus seront écartés à vie. Rien de coché ? Tant mieux, j’aurai plus de choix.'));
  }

  majBoutonOnb();
}

function etapeValide() {
  const etapes = etapesOnboarding();
  const nom = etapes[onbEtape];
  if (nom === 'gFilm') return Object.keys(onbBrouillon.gFilm).length >= 3;
  if (nom === 'gMus') return Object.keys(onbBrouillon.gMus).length >= 3;
  if (nom === 'rFilm') return onbBrouillon.refs.filter(function (id) { return parId(id) && parId(id).type === 'film'; }).length >= 2;
  if (nom === 'rMus') return onbBrouillon.refs.filter(function (id) { return parId(id) && parId(id).type === 'musique'; }).length >= 2;
  return true;
}

function majBoutonOnb() { $('#onbSuivant').disabled = !etapeValide(); }

$('#onbSuivant').addEventListener('click', function () {
  vibre(12);
  const etapes = etapesOnboarding();
  if (onbEtape < etapes.length - 1) { onbEtape++; rendreOnboarding(); $('#ecr-onboard').scrollTop = 0; return; }
  /* Fin : on fige le profil */
  profil = onbBrouillon;
  profil.fini = true;
  appliquerRefs(profil);
  sauverProfil(profil);
  rendreHome();
  aller(retourProfil ? 'ecr-profil' : 'ecr-home');
  if (retourProfil) rendreProfil();
  retourProfil = false;
});

$('#onbRetour').addEventListener('click', function () {
  vibre();
  if (onbEtape > 0) { onbEtape--; rendreOnboarding(); }
  else if (retourProfil) { retourProfil = false; rendreProfil(); aller('ecr-profil'); }
  else aller('ecr-intro');
});

$('#btnCommencer').addEventListener('click', function () { vibre(12); ouvrirOnboarding(false); });

/* ───────── Accueil ───────── */

function rendreHome() {
  const heure = new Date().getHours();
  const bonjour = heure < 6 ? 'Encore debout' : heure < 12 ? 'Bonjour' : heure < 18 ? 'Salut' : 'Bonsoir';
  $('#homeSalut').textContent = bonjour + (profil.prenom ? ' ' + profil.prenom : '') + ' 👋';

  /* Choix du média pour la séance */
  const q = $('#homeQuoi');
  q.innerHTML = '';
  if (profil.medias.length > 1) {
    q.appendChild(el('div', 'mini-titre', 'Ce soir, je veux…'));
    const p = el('div', 'puces');
    [{ v: 'les2', l: '🎬 + 🎵 Les deux' }, { v: 'film', l: '🎬 Un film' }, { v: 'musique', l: '🎵 De la musique' }].forEach(function (o) {
      const actif = (choixMedia === o.v);
      const b = el('button', 'puce' + (actif ? ' choisi' : ''), o.l);
      b.addEventListener('click', function () {
        vibre(); choixMedia = o.v;
        p.querySelectorAll('.puce').forEach(function (x) { x.classList.remove('choisi'); });
        b.classList.add('choisi');
      });
      p.appendChild(b);
    });
    q.appendChild(p);
  }

  /* Dernière séance */
  const d = $('#homeDerniere');
  d.innerHTML = '';
  if (profil.histo.length) {
    const h = profil.histo[0];
    const items = (h.ids || []).map(parId).filter(Boolean);
    if (items.length) {
      d.appendChild(el('div', 'mini-titre', 'La dernière fois'));
      const carte = el('div', 'carte', '');
      const hum = HUMEURS.filter(function (x) { return x.id === h.humeur; })[0];
      carte.appendChild(el('div', 'ligne',
        '<span class="lbl">' + (hum ? hum.e + ' ' + echap(hum.l) : 'Séance') + '</span><span class="val">' + dateCourte(h.t) + '</span>'));
      items.slice(0, 2).forEach(function (it) {
        carte.appendChild(el('div', 'ligne',
          '<span class="lbl">' + (it.type === 'film' ? '🎬 ' : '🎵 ') + echap(it.t) + '</span><span class="val">' + echap(it.type === 'film' ? (it.m.split(' · ')[1] || it.m) : it.m.split(' · ')[0]) + '</span>'));
      });
      d.appendChild(carte);
    }
  }
}

let choixMedia = 'les2';

function dateCourte(t) {
  const d = new Date(t), j = Math.floor((Date.now() - t) / 86400000);
  if (j === 0) return 'aujourd’hui';
  if (j === 1) return 'hier';
  if (j < 7) return 'il y a ' + j + ' jours';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/* ───────── Quiz d'humeur ───────── */

let quizEtape = 0;
let quizQuestion = null;
let modeAffiner = false;

$('#btnAnalyse').addEventListener('click', function () {
  vibre(12);
  let medias = profil.medias.slice();
  if (profil.medias.length > 1 && choixMedia !== 'les2') medias = [choixMedia];
  session = nouvelleSession(medias);
  modeAffiner = false;
  quizEtape = 0;
  rendreQuiz();
  aller('ecr-quiz');
});

$('#quizRetour').addEventListener('click', function () {
  vibre();
  if (quizEtape === 0) { aller('ecr-home'); return; }
  quizEtape--;
  if (quizEtape >= 2) { session.posees.pop(); session.reponses.pop(); }
  rendreQuiz();
});

function rendreQuiz() {
  const total = modeAffiner ? affinerFin : 2 + NB_QUESTIONS;
  const c = $('#quizContenu');
  c.innerHTML = '';
  $('#quizPas').textContent = (quizEtape + 1) + '/' + total;
  $('#quizProgres').style.width = ((quizEtape + 1) / total * 100) + '%';

  if (quizEtape === 0) {
    $('#quizTitre').textContent = 'Ton humeur';
    c.appendChild(el('div', 'etiquette', 'Le point de départ'));
    c.appendChild(el('div', 'question', 'Comment tu te sens, là ?'));
    const g = el('div', 'grille');
    HUMEURS.forEach(function (h, i) {
      const t = el('button', 'tuile', '<span class="emo">' + h.e + '</span>' + echap(h.l));
      t.style.animationDelay = (i * .025) + 's';
      t.addEventListener('click', function () {
        vibre(12);
        session.humeurChoisie = h;
        quizEtape = 1;
        rendreQuiz();
      });
      g.appendChild(t);
    });
    c.appendChild(g);
    c.appendChild(el('p', 'note', 'Prends celle qui domine. Les questions suivantes affineront le reste.'));
    teinter(null);
    return;
  }

  if (quizEtape === 1) {
    const h = session.humeurChoisie;
    $('#quizTitre').textContent = h.e + ' ' + h.l;
    c.appendChild(el('div', 'etiquette', h.s));
    c.appendChild(el('div', 'question', 'Tu veux que ça fasse quoi ?'));
    const box = el('div', 'opts');
    DIRECTIONS.forEach(function (d, i) {
      const b = el('button', 'opt', '<span class="emo">' + d.e + '</span><span class="txt">' + echap(d.l) + '<span class="sst">' + echap(d.s) + '</span></span>');
      b.style.animationDelay = (i * .05) + 's';
      b.addEventListener('click', function () {
        vibre(12);
        appliquerHumeur(session, h, d);
        teinter(session.cible);
        quizEtape = 2;
        rendreQuiz();
      });
      box.appendChild(b);
    });
    c.appendChild(box);
    return;
  }

  /* Questions adaptatives */
  const q = prochaineQuestion(session);
  if (!q || quizEtape >= total) { lancerAnalyse(); return; }
  quizQuestion = q;
  $('#quizTitre').textContent = modeAffiner ? 'On précise' : 'On affine';
  c.appendChild(el('div', 'etiquette', modeAffiner
    ? 'On précise ' + (quizEtape - affinerFin + 3) + '/2'
    : 'Question ' + (quizEtape - 1) + ' sur ' + NB_QUESTIONS));
  c.appendChild(el('div', 'question', echap(q.q)));
  const box = el('div', 'opts');
  q.opts.forEach(function (o, i) {
    const b = el('button', 'opt', '<span class="emo">' + o.e + '</span><span class="txt">' + echap(o.l) + '</span>');
    b.style.animationDelay = (i * .05) + 's';
    b.addEventListener('click', function () {
      vibre(12);
      repondre(session, q, o);
      teinter(session.cible);
      quizEtape++;
      if (modeAffiner && quizEtape >= affinerFin) { modeAffiner = false; lancerAnalyse(); return; }
      if (quizEtape >= total && !modeAffiner) { lancerAnalyse(); return; }
      rendreQuiz();
    });
    box.appendChild(b);
  });
  c.appendChild(box);
}

/* ───────── Analyse ───────── */

const MESSAGES = [
  'Je relis ton humeur…',
  'Je croise avec tes goûts…',
  'J’écarte ce qui ne colle pas…',
  'Je garde le meilleur.'
];

function lancerAnalyse() {
  aller('ecr-analyse');
  teinter(session.cible);
  const t = $('#analyseTxt');
  let i = 0;
  t.textContent = MESSAGES[0];
  const tick = setInterval(function () {
    i++;
    if (i < MESSAGES.length) { t.textContent = MESSAGES[i]; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = 'monte .4s'; }
  }, 520);
  setTimeout(function () {
    clearInterval(tick);
    calculer();
    aller('ecr-reco');
  }, 2150);
}

function calculer(garderVus) {
  if (!garderVus) session.montres = [];
  elargi = {};
  session.medias.forEach(function (type) {
    let brut = recommander(session, profil, type, 30)
      .filter(function (r) { return session.montres.indexOf(r.item.id) < 0; });
    if (brut.length < 3) {                      // filtres trop serrés : on élargit
      const large = recommander(session, profil, type, 30, true)
        .filter(function (r) { return session.montres.indexOf(r.item.id) < 0; });
      if (large.length > brut.length) { brut = large; elargi[type] = true; }
    }
    resultats[type] = brut.slice(0, 5);
    resultats[type].forEach(function (r) { session.montres.push(r.item.id); });
  });
  ongletCourant = session.medias[0];
  /* Mémoire de séance */
  const ids = [];
  session.medias.forEach(function (t) { if (resultats[t][0]) ids.push(resultats[t][0].item.id); });
  profil.histo.unshift({ t: Date.now(), humeur: session.humeur.id, direction: session.direction.id, ids: ids });
  profil.histo = profil.histo.slice(0, 20);
  sauverProfil(profil);
  rendreReco();
}

/* ───────── Résultats ───────── */

function lienVers(it) {
  if (it.type === 'film') return 'https://www.google.com/search?q=' + encodeURIComponent(it.t + ' film où regarder');
  return 'https://open.spotify.com/search/' + encodeURIComponent(it.t + ' ' + it.m.split(' · ')[0]);
}

function carteReco(r, i) {
  const it = r.item;
  const top = i === 0;
  const c = el('div', 'reco' + (top ? ' top' : ''));
  c.style.animationDelay = (i * .07) + 's';
  const rs = raisons(it, session, profil);
  const duree = it.type === 'film' ? ' · ' + it.du + ' min' + (it.la === 'vo' ? ' · VO' : '') : '';
  c.innerHTML =
    '<div class="rang' + (top ? ' top-badge' : '') + '">' + (top ? '★ Le meilleur match' : 'Aussi possible') + '</div>' +
    '<h4>' + echap(it.t) + '</h4>' +
    '<div class="meta">' + echap(it.m) + duree + '</div>' +
    '<div class="desc">' + echap(it.d) + '</div>' +
    '<div class="raisons">' + rs.map(function (x) { return '<span class="raison">' + echap(x) + '</span>'; }).join('') + '</div>';

  const acts = el('div', 'actions');
  const aime = el('button', 'act col aime' + (profil.aimes.indexOf(it.id) >= 0 ? ' on' : ''), '<span>❤️</span><span>J’aime</span>');
  aime.addEventListener('click', function () {
    vibre(14);
    const i2 = profil.aimes.indexOf(it.id);
    if (i2 >= 0) profil.aimes.splice(i2, 1);
    else {
      profil.aimes.push(it.id);
      const table = it.type === 'film' ? profil.gFilm : profil.gMus;
      it.g.forEach(function (g) { table[g] = Math.min(1, (table[g] || 0) + .18); });
      majGout(profil);
    }
    aime.classList.toggle('on', profil.aimes.indexOf(it.id) >= 0);
    sauverProfil(profil);
  });
  const vu = el('button', 'act col', '<span>' + (it.type === 'film' ? '👀' : '🎧') + '</span><span>' + (it.type === 'film' ? 'Déjà vu' : 'Déjà écouté') + '</span>');
  vu.addEventListener('click', function () {
    vibre();
    if (profil.vus.indexOf(it.id) < 0) profil.vus.push(it.id);
    sauverProfil(profil);
    vu.classList.add('plein');
    vu.innerHTML = '<span>✓</span><span>Noté</span>';
  });
  const non = el('button', 'act col', '<span>🚫</span><span>Non merci</span>');
  non.addEventListener('click', function () {
    vibre();
    if (profil.rejets.indexOf(it.id) < 0) profil.rejets.push(it.id);
    const table = it.type === 'film' ? profil.gFilm : profil.gMus;
    it.g.forEach(function (g) { if (table[g]) table[g] = Math.max(0, table[g] - .12); });
    sauverProfil(profil);
    c.style.transition = 'opacity .3s, transform .3s';
    c.style.opacity = '0'; c.style.transform = 'scale(.95)';
    setTimeout(function () { remplacer(it.type, i); }, 300);
  });
  const ouvrir = el('button', 'act col plein', '<span>↗</span><span>' + (it.type === 'film' ? 'Où le voir' : 'Écouter') + '</span>');
  ouvrir.addEventListener('click', function () { vibre(); window.open(lienVers(it), '_blank'); });

  [aime, vu, non, ouvrir].forEach(function (b) { acts.appendChild(b); });
  c.appendChild(acts);
  return c;
}

/* Remplace une carte rejetée par la suivante du classement */
function remplacer(type, index) {
  const suite = recommander(session, profil, type, 30)
    .filter(function (r) { return session.montres.indexOf(r.item.id) < 0; });
  if (suite.length) {
    resultats[type][index] = suite[0];
    session.montres.push(suite[0].item.id);
  } else {
    resultats[type].splice(index, 1);
  }
  rendreReco();
}

function rendreReco() {
  $('#recoResume').innerHTML = echap(resumeHumeur(session));
  const ong = $('#recoOnglets');
  ong.classList.toggle('cache', session.medias.length < 2);
  ong.querySelectorAll('.onglet').forEach(function (b) {
    b.classList.toggle('actif', b.dataset.type === ongletCourant);
  });
  const liste = $('#recoListe');
  liste.innerHTML = '';
  const rs = resultats[ongletCourant] || [];
  if (elargi[ongletCourant] && rs.length) {
    liste.appendChild(el('p', 'note', 'Avec tes critères du moment, le choix était très mince : j\u2019ai un peu élargi.'));
  }
  if (!rs.length) {
    liste.appendChild(el('div', 'vide', 'Rien ne passe tes filtres ce soir 😅<br>Essaie d’assouplir tes lignes rouges dans « Mes goûts ».'));
    return;
  }
  rs.forEach(function (r, i) { liste.appendChild(carteReco(r, i)); });
}

$('#recoOnglets').addEventListener('click', function (e) {
  const b = e.target.closest('.onglet');
  if (!b) return;
  vibre();
  ongletCourant = b.dataset.type;
  rendreReco();
});

$('#recoRetour').addEventListener('click', function () { vibre(); rendreHome(); aller('ecr-home'); });

$('#btnAutres').addEventListener('click', function () {
  vibre(12);
  session.medias.forEach(function (type) {
    const suite = recommander(session, profil, type, 40)
      .filter(function (r) { return session.montres.indexOf(r.item.id) < 0; });
    if (suite.length) {
      resultats[type] = suite.slice(0, 5);
      resultats[type].forEach(function (r) { session.montres.push(r.item.id); });
    }
  });
  rendreReco();
  $('#ecr-reco').scrollTop = 0;
});

let affinerFin = 0;
$('#btnAffiner').addEventListener('click', function () {
  vibre(12);
  modeAffiner = true;
  affinerFin = quizEtape + 2;
  rendreQuiz();
  aller('ecr-quiz');
});

/* ───────── Coups de cœur ───────── */

function rendreFavoris() {
  const c = $('#favListe');
  c.innerHTML = '';
  const items = profil.aimes.map(parId).filter(Boolean);
  if (!items.length) {
    c.appendChild(el('div', 'vide', 'Rien ici pour l’instant.<br>Touche ❤️ sur une reco et elle atterrira là.'));
    return;
  }
  items.reverse().forEach(function (it, i) {
    const carte = el('div', 'reco');
    carte.style.animationDelay = (i * .05) + 's';
    carte.innerHTML = '<div class="rang">' + (it.type === 'film' ? '🎬 Film' : '🎵 Musique') + '</div>' +
      '<h4>' + echap(it.t) + '</h4><div class="meta">' + echap(it.m) + '</div>' +
      '<div class="desc">' + echap(it.d) + '</div>';
    const acts = el('div', 'actions');
    const ouvrir = el('button', 'act plein', (it.type === 'film' ? '↗ Où le voir' : '↗ Écouter'));
    ouvrir.addEventListener('click', function () { vibre(); window.open(lienVers(it), '_blank'); });
    const sup = el('button', 'act', '💔 Retirer');
    sup.addEventListener('click', function () {
      vibre();
      profil.aimes.splice(profil.aimes.indexOf(it.id), 1);
      majGout(profil); sauverProfil(profil); rendreFavoris();
    });
    acts.appendChild(ouvrir); acts.appendChild(sup);
    carte.appendChild(acts);
    c.appendChild(carte);
  });
}

/* ───────── Profil ───────── */

function rendreProfil() {
  const c = $('#profilContenu');
  c.innerHTML = '';
  const gf = Object.keys(profil.gFilm).sort(function (a, b) { return profil.gFilm[b] - profil.gFilm[a]; });
  const gm = Object.keys(profil.gMus).sort(function (a, b) { return profil.gMus[b] - profil.gMus[a]; });

  const bloc = el('div', 'carte bloc');
  bloc.appendChild(el('div', 'ligne', '<span class="lbl">Prénom</span><span class="val">' + (profil.prenom ? echap(profil.prenom) : '—') + '</span>'));
  bloc.appendChild(el('div', 'ligne', '<span class="lbl">Je veux</span><span class="val">' + profil.medias.map(function (m) { return m === 'film' ? 'des films' : 'de la musique'; }).join(' + ') + '</span>'));
  if (gf.length) bloc.appendChild(el('div', 'ligne', '<span class="lbl">Genres ciné</span><span class="val">' + echap(gf.slice(0, 4).join(', ')) + (gf.length > 4 ? '…' : '') + '</span>'));
  if (gm.length) bloc.appendChild(el('div', 'ligne', '<span class="lbl">Genres musique</span><span class="val">' + echap(gm.slice(0, 4).join(', ')) + (gm.length > 4 ? '…' : '') + '</span>'));
  bloc.appendChild(el('div', 'ligne', '<span class="lbl">Époque</span><span class="val">' + (EPOQUES.filter(function (e) { return e.v === profil.epoque; })[0] || EPOQUES[0]).l + '</span>'));
  bloc.appendChild(el('div', 'ligne', '<span class="lbl">Sous-titres</span><span class="val">' + (profil.vo ? 'ça va' : 'non merci') + '</span>'));
  bloc.appendChild(el('div', 'ligne', '<span class="lbl">Lignes rouges</span><span class="val">' + (profil.interdits.length
    ? echap(profil.interdits.map(function (i) { return (SENSIBILITES.filter(function (s) { return s.id === i; })[0] || {}).l; }).join(', '))
    : 'aucune') + '</span>'));
  c.appendChild(bloc);

  const bloc2 = el('div', 'carte bloc');
  bloc2.appendChild(el('div', 'ligne', '<span class="lbl">Coups de cœur</span><span class="val">' + profil.aimes.length + '</span>'));
  bloc2.appendChild(el('div', 'ligne', '<span class="lbl">Déjà vus / écoutés</span><span class="val">' + profil.vus.length + '</span>'));
  bloc2.appendChild(el('div', 'ligne', '<span class="lbl">Écartés</span><span class="val">' + profil.rejets.length + '</span>'));
  bloc2.appendChild(el('div', 'ligne', '<span class="lbl">Séances</span><span class="val">' + profil.histo.length + '</span>'));
  c.appendChild(bloc2);

  const modif = el('button', 'btn fantome', '⚙️ Modifier mes goûts');
  modif.addEventListener('click', function () { vibre(12); ouvrirOnboarding(true); });
  c.appendChild(modif);

  const vider = el('button', 'btn fantome', '↺ Réinitialiser les écartés');
  vider.style.marginTop = '10px';
  vider.addEventListener('click', function () {
    vibre();
    profil.rejets = []; profil.vus = [];
    sauverProfil(profil); rendreProfil();
  });
  c.appendChild(vider);

  const reset = el('button', 'btn fantome danger', 'Tout effacer');
  reset.style.marginTop = '10px';
  reset.addEventListener('click', function () {
    if (!confirm('Effacer ton profil, tes coups de cœur et ton historique ?')) return;
    try { localStorage.removeItem(CLE); } catch (e) {}
    profil = profilVide();
    aller('ecr-intro');
  });
  c.appendChild(reset);
  c.appendChild(el('p', 'note', 'Mood fonctionne hors ligne : tout est stocké dans ton navigateur, rien ne part ailleurs.'));
}

/* ───────── Démarrage ───────── */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
}


(function demarrer() {
  if (profil.fini) { rendreHome(); aller('ecr-home'); }
  else aller('ecr-intro');
  teinter(null);
})();
